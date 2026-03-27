/**
 * NOVA DAW - Professional Subtractive Synthesizer
 *
 * Features: 2 oscillators + sub + noise, ADSR filter & amplitude envelopes,
 * LFO, polyphony with voice stealing, portamento, and preset loading.
 */

/** Anti-click ramp time */
const RAMP = 0.005;

/**
 * Convert MIDI note to frequency.
 * @param {number} note
 * @returns {number}
 */
function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Clamp a value between min and max.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ─── Voice ──────────────────────────────────────────────────────────────

/**
 * A single synth voice. Created/managed internally by the Synthesizer.
 */
class Voice {
  /**
   * @param {AudioContext} ctx
   * @param {Object} params - Shared reference to Synthesizer params
   */
  constructor(ctx, params) {
    this._ctx = ctx;
    this._params = params;
    this._note = -1;
    this._active = false;
    this._releaseTime = 0;
    this._startTime = 0;

    // Output gain (amplitude envelope target)
    this._output = ctx.createGain();
    this._output.gain.value = 0;

    // Filter
    this._filter = ctx.createBiquadFilter();
    this._filter.type = params.filterType;
    this._filter.frequency.value = params.filterCutoff;
    this._filter.Q.value = params.filterResonance;
    this._filter.connect(this._output);

    // Oscillator 1
    this._osc1 = null;
    // Oscillator 2
    this._osc2 = null;
    // Sub oscillator
    this._subOsc = null;
    // Noise
    this._noiseSource = null;
    this._noiseGain = null;

    // Mix gains
    this._osc1Gain = ctx.createGain();
    this._osc1Gain.gain.value = params.osc1Level;
    this._osc1Gain.connect(this._filter);

    this._osc2Gain = ctx.createGain();
    this._osc2Gain.gain.value = params.osc2Level;
    this._osc2Gain.connect(this._filter);

    this._subGain = ctx.createGain();
    this._subGain.gain.value = params.subLevel;
    this._subGain.connect(this._filter);

    this._noiseGain = ctx.createGain();
    this._noiseGain.gain.value = params.noiseLevel;
    this._noiseGain.connect(this._filter);
  }

  get note() { return this._note; }
  get active() { return this._active; }
  get releaseTime() { return this._releaseTime; }
  get startTime() { return this._startTime; }

  /**
   * Start the voice for the given note.
   * @param {number} note - MIDI note
   * @param {number} velocity - 0-1
   * @param {number} time - AudioContext time
   * @param {number} [portamentoFrom=-1] - Previous note for glide
   */
  start(note, velocity, time, portamentoFrom = -1) {
    const ctx = this._ctx;
    const p = this._params;

    this._note = note;
    this._active = true;
    this._startTime = time;
    this._releaseTime = 0;

    const freq = midiToFreq(note);
    const fromFreq = portamentoFrom >= 0 ? midiToFreq(portamentoFrom) : freq;
    const glideTime = p.portamento;

    // ── Create oscillators ──

    // Osc 1
    this._osc1 = ctx.createOscillator();
    this._osc1.type = p.osc1Waveform === 'pulse' ? 'square' : p.osc1Waveform;
    this._osc1.detune.value = p.osc1Detune + (p.osc1Octave * 1200) + (p.osc1Semi * 100);
    if (glideTime > 0 && portamentoFrom >= 0) {
      this._osc1.frequency.setValueAtTime(fromFreq, time);
      this._osc1.frequency.linearRampToValueAtTime(freq, time + glideTime);
    } else {
      this._osc1.frequency.setValueAtTime(freq, time);
    }
    this._osc1.connect(this._osc1Gain);
    this._osc1.start(time);

    // Osc 2
    this._osc2 = ctx.createOscillator();
    this._osc2.type = p.osc2Waveform === 'pulse' ? 'square' : p.osc2Waveform;
    this._osc2.detune.value = p.osc2Detune + (p.osc2Octave * 1200) + (p.osc2Semi * 100);
    if (glideTime > 0 && portamentoFrom >= 0) {
      this._osc2.frequency.setValueAtTime(fromFreq, time);
      this._osc2.frequency.linearRampToValueAtTime(freq, time + glideTime);
    } else {
      this._osc2.frequency.setValueAtTime(freq, time);
    }
    this._osc2.connect(this._osc2Gain);
    this._osc2.start(time);

    // Sub oscillator (1 octave down)
    this._subOsc = ctx.createOscillator();
    this._subOsc.type = p.subWaveform;
    const subFreq = freq / 2;
    const subFromFreq = fromFreq / 2;
    if (glideTime > 0 && portamentoFrom >= 0) {
      this._subOsc.frequency.setValueAtTime(subFromFreq, time);
      this._subOsc.frequency.linearRampToValueAtTime(subFreq, time + glideTime);
    } else {
      this._subOsc.frequency.setValueAtTime(subFreq, time);
    }
    this._subOsc.connect(this._subGain);
    this._subOsc.start(time);

    // Noise
    this._noiseSource = this._createNoiseSource(p.noiseType);
    this._noiseSource.connect(this._noiseGain);
    this._noiseSource.start(time);

    // ── Amplitude Envelope ──
    const ampEnv = this._output.gain;
    const vel = velocity * velocity; // Exponential velocity curve
    ampEnv.cancelScheduledValues(time);
    ampEnv.setValueAtTime(0, time);
    ampEnv.linearRampToValueAtTime(vel, time + Math.max(p.ampAttack, 0.001));
    ampEnv.linearRampToValueAtTime(
      vel * p.ampSustain,
      time + p.ampAttack + p.ampDecay
    );

    // ── Filter Envelope ──
    this._applyFilterEnvelope(time, freq);
  }

  /**
   * Apply the filter ADSR envelope.
   */
  _applyFilterEnvelope(time, baseFreq) {
    const p = this._params;
    const cutoff = p.filterCutoff;
    const envAmount = p.filterEnvAmount; // In Hz offset
    const peak = clamp(cutoff + envAmount, 20, 20000);

    const fFreq = this._filter.frequency;
    fFreq.cancelScheduledValues(time);
    fFreq.setValueAtTime(cutoff, time);
    fFreq.linearRampToValueAtTime(peak, time + Math.max(p.filterAttack, 0.001));
    fFreq.linearRampToValueAtTime(
      cutoff + envAmount * p.filterSustain,
      time + p.filterAttack + p.filterDecay
    );
  }

  /**
   * Release the voice.
   * @param {number} time
   */
  release(time) {
    if (!this._active) return;
    const p = this._params;
    this._releaseTime = time;

    // Amplitude release
    const ampEnv = this._output.gain;
    ampEnv.cancelScheduledValues(time);
    ampEnv.setValueAtTime(ampEnv.value, time);
    ampEnv.linearRampToValueAtTime(0, time + Math.max(p.ampRelease, 0.005));

    // Filter release
    const fFreq = this._filter.frequency;
    fFreq.cancelScheduledValues(time);
    fFreq.setValueAtTime(fFreq.value, time);
    fFreq.linearRampToValueAtTime(p.filterCutoff, time + Math.max(p.filterRelease, 0.005));

    // Schedule cleanup
    const stopTime = time + p.ampRelease + 0.05;
    this._scheduleStop(stopTime);
  }

  /** Hard-kill voice immediately (for voice stealing). */
  kill(time) {
    const t = time + RAMP;
    this._output.gain.cancelScheduledValues(time);
    this._output.gain.setValueAtTime(this._output.gain.value, time);
    this._output.gain.linearRampToValueAtTime(0, t);
    this._scheduleStop(t + 0.01);
  }

  _scheduleStop(time) {
    const stopAndClean = (osc) => {
      try { osc.stop(time); } catch (_) { /* already stopped */ }
    };
    if (this._osc1) stopAndClean(this._osc1);
    if (this._osc2) stopAndClean(this._osc2);
    if (this._subOsc) stopAndClean(this._subOsc);
    if (this._noiseSource) stopAndClean(this._noiseSource);

    // Mark inactive after release
    const ms = Math.max(0, (time - this._ctx.currentTime) * 1000) + 50;
    setTimeout(() => {
      this._active = false;
      this._note = -1;
    }, ms);
  }

  /** Create a noise buffer source. */
  _createNoiseSource(type) {
    const ctx = this._ctx;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'pink') {
      // Pink noise using Paul Kellet's algorithm
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      // White noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  /** Connect voice output to a destination. */
  connect(dest) {
    this._output.connect(dest);
    return this;
  }

  disconnect() {
    this._output.disconnect();
  }
}

// ─── Synthesizer ────────────────────────────────────────────────────────

/**
 * Professional polyphonic subtractive synthesizer.
 *
 * @example
 * const synth = new Synthesizer(audioContext);
 * synth.connect(audioContext.destination);
 * synth.noteOn(60, 0.8, audioContext.currentTime);
 * synth.noteOff(60, audioContext.currentTime + 1);
 */
class Synthesizer {
  /**
   * @param {AudioContext} audioContext
   * @param {Object} [options]
   * @param {number} [options.maxVoices=8]
   */
  constructor(audioContext, options = {}) {
    this._ctx = audioContext;
    this._maxVoices = options.maxVoices || 8;

    // Output node
    this._output = this._ctx.createGain();
    this._output.gain.value = 0.7;

    // LFO (shared across voices, modulates parameters)
    this._lfo = this._ctx.createOscillator();
    this._lfo.type = 'sine';
    this._lfo.frequency.value = 2;
    this._lfoGain = this._ctx.createGain();
    this._lfoGain.gain.value = 0;
    this._lfo.connect(this._lfoGain);
    this._lfo.start();

    // LFO routing gains
    this._lfoPitchGain = this._ctx.createGain();
    this._lfoPitchGain.gain.value = 0;
    this._lfoFilterGain = this._ctx.createGain();
    this._lfoFilterGain.gain.value = 0;
    this._lfoAmpGain = this._ctx.createGain();
    this._lfoAmpGain.gain.value = 0;

    this._lfoGain.connect(this._lfoPitchGain);
    this._lfoGain.connect(this._lfoFilterGain);
    this._lfoGain.connect(this._lfoAmpGain);

    // Connect LFO amp modulation to output gain
    this._lfoAmpGain.connect(this._output.gain);

    /** @type {Voice[]} */
    this._voices = [];
    this._lastNote = -1;

    // Synthesizer parameters (shared with voices)
    this._params = {
      // Oscillator 1
      osc1Waveform: 'sawtooth',
      osc1Detune: 0,
      osc1Octave: 0,
      osc1Semi: 0,
      osc1Level: 0.5,

      // Oscillator 2
      osc2Waveform: 'sawtooth',
      osc2Detune: 7, // Slight detune for width
      osc2Octave: 0,
      osc2Semi: 0,
      osc2Level: 0.5,

      // Sub oscillator
      subWaveform: 'sine',
      subLevel: 0.0,

      // Noise
      noiseType: 'white',
      noiseLevel: 0.0,

      // Filter
      filterType: 'lowpass',
      filterCutoff: 4000,
      filterResonance: 1,

      // Filter envelope
      filterAttack: 0.01,
      filterDecay: 0.3,
      filterSustain: 0.5,
      filterRelease: 0.3,
      filterEnvAmount: 2000, // Hz

      // Amplitude envelope
      ampAttack: 0.01,
      ampDecay: 0.1,
      ampSustain: 0.8,
      ampRelease: 0.3,

      // LFO
      lfoRate: 2,
      lfoWaveform: 'sine',
      lfoDepth: 0,
      lfoTarget: 'filter', // 'pitch', 'filter', 'amplitude'

      // Portamento
      portamento: 0, // seconds

      // Master
      volume: 0.7,
    };
  }

  // ─── Parameter Setters ──────────────────────────────────────────────

  /**
   * Set one or more parameters in real-time.
   * @param {Object} params - Key-value pairs of parameter names and values
   */
  setParams(params) {
    const now = this._ctx.currentTime;

    for (const [key, value] of Object.entries(params)) {
      if (key in this._params) {
        this._params[key] = value;
      }
    }

    // Apply real-time changes
    if ('volume' in params) {
      this._output.gain.linearRampToValueAtTime(
        clamp(params.volume, 0, 1), now + RAMP
      );
    }

    if ('lfoRate' in params) {
      this._lfo.frequency.linearRampToValueAtTime(params.lfoRate, now + RAMP);
    }

    if ('lfoWaveform' in params) {
      this._lfo.type = params.lfoWaveform;
    }

    if ('lfoDepth' in params || 'lfoTarget' in params) {
      this._updateLFORouting();
    }
  }

  /** @returns {Object} Current parameter snapshot */
  getParams() {
    return { ...this._params };
  }

  _updateLFORouting() {
    const p = this._params;
    const now = this._ctx.currentTime;

    this._lfoGain.gain.linearRampToValueAtTime(1, now + RAMP);

    // Reset all routing gains
    this._lfoPitchGain.gain.linearRampToValueAtTime(0, now + RAMP);
    this._lfoFilterGain.gain.linearRampToValueAtTime(0, now + RAMP);
    this._lfoAmpGain.gain.linearRampToValueAtTime(0, now + RAMP);

    switch (p.lfoTarget) {
      case 'pitch':
        this._lfoPitchGain.gain.linearRampToValueAtTime(p.lfoDepth * 100, now + RAMP); // cents
        break;
      case 'filter':
        this._lfoFilterGain.gain.linearRampToValueAtTime(p.lfoDepth * 2000, now + RAMP); // Hz
        break;
      case 'amplitude':
        this._lfoAmpGain.gain.linearRampToValueAtTime(p.lfoDepth * 0.5, now + RAMP);
        break;
    }
  }

  // ─── Note Control ─────────────────────────────────────────────────────

  /**
   * Trigger a note.
   * @param {number} note - MIDI note number (0-127)
   * @param {number} [velocity=0.8] - Velocity (0-1)
   * @param {number} [time] - AudioContext time (defaults to now)
   */
  noteOn(note, velocity = 0.8, time) {
    time = time || this._ctx.currentTime;
    velocity = clamp(velocity, 0, 1);

    // Find or steal a voice
    let voice = this._allocateVoice(time);

    voice.connect(this._output);

    // Connect LFO to voice oscillators for pitch modulation
    if (this._params.lfoTarget === 'pitch') {
      this._lfoPitchGain.connect(voice._osc1 ? voice._osc1.detune : this._ctx.destination);
    }

    const portaFrom = this._params.portamento > 0 ? this._lastNote : -1;
    voice.start(note, velocity, time, portaFrom);

    this._lastNote = note;
  }

  /**
   * Release a note.
   * @param {number} note - MIDI note number
   * @param {number} [time] - AudioContext time
   */
  noteOff(note, time) {
    time = time || this._ctx.currentTime;
    for (const voice of this._voices) {
      if (voice.note === note && voice.active && voice.releaseTime === 0) {
        voice.release(time);
        break;
      }
    }
  }

  /**
   * Release all notes immediately.
   * @param {number} [time]
   */
  allNotesOff(time) {
    time = time || this._ctx.currentTime;
    for (const voice of this._voices) {
      if (voice.active) {
        voice.release(time);
      }
    }
  }

  /** Allocate a voice, stealing the oldest if necessary. */
  _allocateVoice(time) {
    // Clean up finished voices
    this._voices = this._voices.filter(v => v.active);

    // Reuse an inactive slot
    if (this._voices.length < this._maxVoices) {
      const voice = new Voice(this._ctx, this._params);
      this._voices.push(voice);
      return voice;
    }

    // Voice stealing: kill the oldest voice
    let oldest = this._voices[0];
    for (const v of this._voices) {
      if (v.startTime < oldest.startTime) {
        oldest = v;
      }
    }
    oldest.kill(time);

    const voice = new Voice(this._ctx, this._params);
    this._voices.push(voice);
    return voice;
  }

  // ─── Preset ───────────────────────────────────────────────────────────

  /**
   * Load a preset (overwrites all parameters).
   * @param {Object} preset - Parameter key-value pairs
   */
  loadPreset(preset) {
    this.setParams(preset);
  }

  // ─── Routing ──────────────────────────────────────────────────────────

  /**
   * Connect synthesizer output to a destination.
   * @param {AudioNode} destination
   * @returns {Synthesizer}
   */
  connect(destination) {
    this._output.connect(destination);
    return this;
  }

  /**
   * Disconnect from all or a specific destination.
   * @param {AudioNode} [destination]
   */
  disconnect(destination) {
    if (destination) {
      this._output.disconnect(destination);
    } else {
      this._output.disconnect();
    }
  }

  /** Clean up all resources. */
  dispose() {
    this.allNotesOff();
    this._lfo.stop();
    this._output.disconnect();
  }
}

// ─── Presets ────────────────────────────────────────────────────────────

export const SynthPresets = {
  init: {
    osc1Waveform: 'sawtooth', osc1Detune: 0, osc1Octave: 0, osc1Semi: 0, osc1Level: 0.5,
    osc2Waveform: 'sawtooth', osc2Detune: 7, osc2Octave: 0, osc2Semi: 0, osc2Level: 0.5,
    subWaveform: 'sine', subLevel: 0,
    noiseType: 'white', noiseLevel: 0,
    filterType: 'lowpass', filterCutoff: 4000, filterResonance: 1,
    filterAttack: 0.01, filterDecay: 0.3, filterSustain: 0.5, filterRelease: 0.3, filterEnvAmount: 2000,
    ampAttack: 0.01, ampDecay: 0.1, ampSustain: 0.8, ampRelease: 0.3,
    lfoRate: 2, lfoWaveform: 'sine', lfoDepth: 0, lfoTarget: 'filter',
    portamento: 0, volume: 0.7,
  },

  supersaw: {
    osc1Waveform: 'sawtooth', osc1Detune: -12, osc1Level: 0.5,
    osc2Waveform: 'sawtooth', osc2Detune: 12, osc2Level: 0.5,
    subWaveform: 'sawtooth', subLevel: 0.3,
    filterType: 'lowpass', filterCutoff: 6000, filterResonance: 2,
    filterAttack: 0.05, filterDecay: 0.5, filterSustain: 0.4, filterRelease: 0.5, filterEnvAmount: 4000,
    ampAttack: 0.02, ampDecay: 0.3, ampSustain: 0.7, ampRelease: 0.5,
    volume: 0.6,
  },

  bass: {
    osc1Waveform: 'sawtooth', osc1Detune: 0, osc1Octave: -1, osc1Level: 0.6,
    osc2Waveform: 'square', osc2Detune: 3, osc2Octave: -1, osc2Level: 0.4,
    subWaveform: 'sine', subLevel: 0.5,
    filterType: 'lowpass', filterCutoff: 800, filterResonance: 4,
    filterAttack: 0.005, filterDecay: 0.2, filterSustain: 0.2, filterRelease: 0.15, filterEnvAmount: 3000,
    ampAttack: 0.005, ampDecay: 0.15, ampSustain: 0.6, ampRelease: 0.15,
    volume: 0.7,
  },

  pad: {
    osc1Waveform: 'sawtooth', osc1Detune: -8, osc1Level: 0.4,
    osc2Waveform: 'sawtooth', osc2Detune: 8, osc2Level: 0.4,
    subWaveform: 'sine', subLevel: 0.2,
    noiseType: 'white', noiseLevel: 0.02,
    filterType: 'lowpass', filterCutoff: 3000, filterResonance: 1.5,
    filterAttack: 0.8, filterDecay: 1.0, filterSustain: 0.6, filterRelease: 1.5, filterEnvAmount: 2000,
    ampAttack: 0.5, ampDecay: 0.8, ampSustain: 0.7, ampRelease: 1.5,
    lfoRate: 0.3, lfoWaveform: 'triangle', lfoDepth: 0.15, lfoTarget: 'filter',
    volume: 0.5,
  },

  lead: {
    osc1Waveform: 'square', osc1Detune: 0, osc1Level: 0.5,
    osc2Waveform: 'sawtooth', osc2Detune: 5, osc2Level: 0.4,
    subLevel: 0,
    filterType: 'lowpass', filterCutoff: 2500, filterResonance: 6,
    filterAttack: 0.01, filterDecay: 0.2, filterSustain: 0.3, filterRelease: 0.2, filterEnvAmount: 5000,
    ampAttack: 0.01, ampDecay: 0.1, ampSustain: 0.7, ampRelease: 0.2,
    portamento: 0.05,
    volume: 0.6,
  },

  pluck: {
    osc1Waveform: 'sawtooth', osc1Detune: 0, osc1Level: 0.5,
    osc2Waveform: 'square', osc2Detune: 3, osc2Level: 0.3,
    filterType: 'lowpass', filterCutoff: 800, filterResonance: 2,
    filterAttack: 0.001, filterDecay: 0.15, filterSustain: 0.0, filterRelease: 0.1, filterEnvAmount: 6000,
    ampAttack: 0.001, ampDecay: 0.3, ampSustain: 0.0, ampRelease: 0.1,
    volume: 0.7,
  },

  strings: {
    osc1Waveform: 'sawtooth', osc1Detune: -10, osc1Level: 0.45,
    osc2Waveform: 'sawtooth', osc2Detune: 10, osc2Level: 0.45,
    noiseType: 'white', noiseLevel: 0.01,
    filterType: 'lowpass', filterCutoff: 5000, filterResonance: 0.5,
    filterAttack: 0.4, filterDecay: 0.5, filterSustain: 0.7, filterRelease: 0.8, filterEnvAmount: 1000,
    ampAttack: 0.3, ampDecay: 0.5, ampSustain: 0.8, ampRelease: 0.8,
    lfoRate: 5, lfoWaveform: 'sine', lfoDepth: 0.05, lfoTarget: 'pitch',
    volume: 0.5,
  },
};

export { Synthesizer };
export default Synthesizer;
