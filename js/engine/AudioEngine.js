/**
 * NOVA DAW - Core Audio Engine
 * Manages AudioContext, master bus, transport, scheduling, and export.
 * Uses the "look-ahead" scheduling pattern for sample-accurate timing.
 */

/** Anti-click ramp time in seconds */
const RAMP_TIME = 0.005;

/** Look-ahead scheduling interval in ms */
const SCHEDULER_INTERVAL_MS = 25;

/** How far ahead to schedule audio events (seconds) */
const SCHEDULE_AHEAD_TIME = 0.1;

/**
 * @typedef {Object} TimeSignature
 * @property {number} numerator - Beats per measure (e.g. 4)
 * @property {number} denominator - Beat unit (e.g. 4 = quarter note)
 */

/**
 * @typedef {'stopped'|'playing'|'paused'} TransportState
 */

class AudioEngine {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;

    // Master bus nodes (created lazily)
    /** @type {GainNode|null} */
    this._masterGain = null;
    /** @type {DynamicsCompressorNode|null} */
    this._masterCompressor = null;
    /** @type {GainNode|null} */
    this._preGain = null;
    /** @type {DynamicsCompressorNode|null} */
    this._limiter = null;

    // Transport state
    /** @type {TransportState} */
    this._state = 'stopped';
    this._bpm = 120;
    this._swing = 0; // 0-1, 0 = no swing
    /** @type {TimeSignature} */
    this._timeSignature = { numerator: 4, denominator: 4 };

    // Loop
    this._loopEnabled = false;
    this._loopStart = 0; // in beats
    this._loopEnd = 16; // in beats

    // Scheduling — 16th-note resolution
    this._currentStep = 0; // 16th-note step counter (global)
    this._currentBeat = 0;
    this._currentMeasure = 0;
    this._nextNoteTime = 0;
    this._schedulerTimerId = null;

    // Callbacks
    /** @type {Set<function>} */
    this._stepCallbacks = new Set();
    /** @type {Set<function>} */
    this._beatCallbacks = new Set();
    /** @type {Set<function>} */
    this._measureCallbacks = new Set();
    /** @type {Set<function>} */
    this._tickCallbacks = new Set();
    /** @type {Set<function>} */
    this._transportCallbacks = new Set();

    // For pause/resume tracking
    this._pauseTime = 0;
    this._startOffset = 0;
  }

  // ---------------------------------------------------------------------------
  // Context & Master Bus
  // ---------------------------------------------------------------------------

  /**
   * Initialise (or resume) the AudioContext. Must be called from a user gesture.
   * @returns {Promise<AudioContext>}
   */
  async init() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._buildMasterBus();
    }
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }
    return this._ctx;
  }

  /** @returns {AudioContext} */
  get context() {
    return this._ctx;
  }

  /**
   * The node to connect instruments/tracks to.
   * @returns {GainNode}
   */
  get masterInput() {
    return this._preGain;
  }

  /** Alias for masterInput — instruments connect here. */
  get destination() {
    return this._preGain;
  }

  /** @returns {GainNode} */
  get masterOutput() {
    return this._masterGain;
  }

  /** @param {number} value - 0 to 1 */
  set masterVolume(value) {
    if (!this._masterGain) return;
    this._masterGain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, value)),
      this._ctx.currentTime + RAMP_TIME
    );
  }

  get masterVolume() {
    return this._masterGain ? this._masterGain.gain.value : 1;
  }

  /**
   * Build master bus: preGain -> compressor -> limiter -> masterGain -> destination.
   * Uses a DynamicsCompressorNode as a brick-wall limiter for maximum
   * transparency compared to waveshaper distortion at unity gain levels.
   */
  _buildMasterBus() {
    const ctx = this._ctx;

    this._preGain = ctx.createGain();
    this._preGain.gain.value = 1.0;

    // Master compressor – gentle glue
    this._masterCompressor = ctx.createDynamicsCompressor();
    this._masterCompressor.threshold.value = -8;
    this._masterCompressor.knee.value = 10;
    this._masterCompressor.ratio.value = 4;
    this._masterCompressor.attack.value = 0.003;
    this._masterCompressor.release.value = 0.25;

    // Brick-wall limiter via DynamicsCompressor with extreme settings
    this._limiter = ctx.createDynamicsCompressor();
    this._limiter.threshold.value = -1.0;
    this._limiter.knee.value = 0;
    this._limiter.ratio.value = 20;
    this._limiter.attack.value = 0.001;
    this._limiter.release.value = 0.05;

    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = 0.8;

    // Chain
    this._preGain.connect(this._masterCompressor);
    this._masterCompressor.connect(this._limiter);
    this._limiter.connect(this._masterGain);
    this._masterGain.connect(ctx.destination);
  }

  /**
   * Set master compressor parameters in real-time.
   * @param {Object} params
   * @param {number} [params.threshold]
   * @param {number} [params.knee]
   * @param {number} [params.ratio]
   * @param {number} [params.attack]
   * @param {number} [params.release]
   */
  setCompressorParams(params) {
    if (!this._masterCompressor) return;
    const c = this._masterCompressor;
    const t = this._ctx.currentTime + RAMP_TIME;
    if (params.threshold !== undefined) c.threshold.linearRampToValueAtTime(params.threshold, t);
    if (params.knee !== undefined) c.knee.linearRampToValueAtTime(params.knee, t);
    if (params.ratio !== undefined) c.ratio.linearRampToValueAtTime(params.ratio, t);
    if (params.attack !== undefined) c.attack.linearRampToValueAtTime(params.attack, t);
    if (params.release !== undefined) c.release.linearRampToValueAtTime(params.release, t);
  }

  // ---------------------------------------------------------------------------
  // Transport
  // ---------------------------------------------------------------------------

  /** @returns {TransportState} */
  get state() {
    return this._state;
  }

  /** @param {number} bpm - 40 to 300 */
  set bpm(bpm) {
    this._bpm = Math.max(40, Math.min(300, bpm));
  }

  get bpm() {
    return this._bpm;
  }

  /**
   * Set tempo. Fluent alternative to the bpm setter.
   * @param {number} bpm - 40 to 300
   */
  setBPM(bpm) {
    this.bpm = bpm;
  }

  /** @param {number} amount - 0 (straight) to 1 (full swing) */
  set swing(amount) {
    this._swing = Math.max(0, Math.min(1, amount));
  }

  get swing() {
    return this._swing;
  }

  /**
   * Set swing amount.
   * @param {number} amount - 0 to 1
   */
  setSwing(amount) {
    this.swing = amount;
  }

  /**
   * Set time signature.
   * @param {number} numerator - Beats per measure
   * @param {number} denominator - Note value that gets one beat (2, 4, 8, 16)
   */
  setTimeSignature(numerator, denominator) {
    this._timeSignature = {
      numerator: Math.max(1, Math.min(16, numerator)),
      denominator: [2, 4, 8, 16].includes(denominator) ? denominator : 4,
    };
  }

  get timeSignature() {
    return { ...this._timeSignature };
  }

  /** Enable/disable loop. */
  set loopEnabled(val) {
    this._loopEnabled = !!val;
  }

  get loopEnabled() {
    return this._loopEnabled;
  }

  /**
   * Set loop region in beats.
   * @param {number} start
   * @param {number} end
   */
  setLoopRegion(start, end) {
    this._loopStart = Math.max(0, start);
    this._loopEnd = Math.max(this._loopStart + 1, end);
  }

  /**
   * Duration of one quarter note in seconds at the current BPM.
   * @returns {number}
   */
  get secondsPerBeat() {
    return 60.0 / this._bpm;
  }

  /**
   * Duration of one 16th note in seconds.
   * @returns {number}
   */
  get secondsPer16th() {
    return this.secondsPerBeat / 4;
  }

  /**
   * Number of 16th-note steps per measure, derived from the time signature.
   * E.g. 4/4 = 16, 3/4 = 12, 6/8 = 12.
   * @returns {number}
   */
  get stepsPerMeasure() {
    const { numerator, denominator } = this._timeSignature;
    const stepsPerBeat = 16 / denominator;
    return numerator * stepsPerBeat;
  }

  /**
   * Start playback.
   * @param {number} [fromBeat=0] - Beat to start from.
   */
  play(fromBeat) {
    if (!this._ctx) {
      throw new Error('AudioEngine not initialised. Call init() first.');
    }
    if (this._state === 'playing') return;

    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }

    if (this._state === 'paused') {
      // Resume from paused position
      this._nextNoteTime = this._ctx.currentTime;
    } else {
      // Fresh start
      this._currentStep = fromBeat !== undefined ? fromBeat * 4 : 0;
      this._currentBeat = fromBeat !== undefined ? fromBeat : 0;
      this._currentMeasure = 0;
      this._nextNoteTime = this._ctx.currentTime;
    }

    this._state = 'playing';
    this._notifyTransport();
    this._startScheduler();
  }

  /** Pause playback (retains position). */
  pause() {
    if (this._state !== 'playing') return;
    this._state = 'paused';
    this._stopScheduler();
    this._notifyTransport();
  }

  /** Stop playback and reset position. */
  stop() {
    this._state = 'stopped';
    this._stopScheduler();
    this._currentStep = 0;
    this._currentBeat = 0;
    this._currentMeasure = 0;
    this._notifyTransport();
  }

  /** @returns {number} Current 16th-note step position (global). */
  get currentStep() {
    return this._currentStep;
  }

  /** @returns {number} Current beat position. */
  get currentBeat() {
    return this._currentBeat;
  }

  /** @returns {number} Current measure (0-based). */
  get currentMeasure() {
    return this._currentMeasure;
  }

  // ---------------------------------------------------------------------------
  // Callback Registration
  // ---------------------------------------------------------------------------

  /**
   * Register a callback that fires for every 16th-note step.
   * @param {function(step: number, time: number, info: Object): void} fn
   * @returns {function} Unsubscribe function
   */
  onStep(fn) {
    this._stepCallbacks.add(fn);
    return () => this._stepCallbacks.delete(fn);
  }

  /**
   * Register a callback that fires for every beat (quarter note).
   * @param {function(beat: number, time: number, bpm: number): void} fn
   * @returns {function} Unsubscribe function
   */
  onBeat(fn) {
    this._beatCallbacks.add(fn);
    return () => this._beatCallbacks.delete(fn);
  }

  /**
   * Register a callback that fires at the start of each measure.
   * @param {function(measure: number, time: number): void} fn
   * @returns {function} Unsubscribe function
   */
  onMeasure(fn) {
    this._measureCallbacks.add(fn);
    return () => this._measureCallbacks.delete(fn);
  }

  /**
   * Register a callback for every scheduler tick (for UI updates).
   * @param {function(currentStep: number): void} fn
   * @returns {function} Unsubscribe function
   */
  onTick(fn) {
    this._tickCallbacks.add(fn);
    return () => this._tickCallbacks.delete(fn);
  }

  /**
   * Register a callback for transport state changes.
   * @param {function(state: TransportState): void} fn
   * @returns {function} Unsubscribe function
   */
  onTransportChange(fn) {
    this._transportCallbacks.add(fn);
    return () => this._transportCallbacks.delete(fn);
  }

  /** @private */
  _notifyTransport() {
    for (const cb of this._transportCallbacks) {
      try { cb(this._state); } catch (e) { console.error('Transport callback error:', e); }
    }
  }

  // ---------------------------------------------------------------------------
  // High-precision scheduler (look-ahead pattern)
  // ---------------------------------------------------------------------------

  _startScheduler() {
    this._schedule(); // immediate first pass
    this._schedulerTimerId = setInterval(() => this._schedule(), SCHEDULER_INTERVAL_MS);
  }

  _stopScheduler() {
    if (this._schedulerTimerId !== null) {
      clearInterval(this._schedulerTimerId);
      this._schedulerTimerId = null;
    }
  }

  /**
   * Core scheduling loop. Runs on setInterval and schedules 16th-note steps
   * that fall within the look-ahead window.
   */
  _schedule() {
    if (this._state !== 'playing') return;

    const now = this._ctx.currentTime;
    const stepsPerMeasure = this.stepsPerMeasure;

    while (this._nextNoteTime < now + SCHEDULE_AHEAD_TIME) {
      // Apply swing: delay odd-numbered 16th notes (the "e" and "a")
      let swingOffset = 0;
      if (this._swing > 0 && this._currentStep % 2 === 1) {
        swingOffset = this.secondsPer16th * this._swing * 0.5;
      }

      const scheduledTime = this._nextNoteTime + swingOffset;
      const stepInMeasure = this._currentStep % stepsPerMeasure;
      const beatInMeasure = Math.floor(stepInMeasure / 4);

      const info = {
        step: this._currentStep,
        stepInMeasure,
        beat: this._currentBeat,
        beatInMeasure,
        measure: this._currentMeasure,
        bpm: this._bpm,
      };

      // Fire step callbacks
      for (const cb of this._stepCallbacks) {
        try { cb(this._currentStep, scheduledTime, info); }
        catch (e) { console.error('Step callback error:', e); }
      }

      // Fire beat callbacks on quarter-note boundaries
      if (stepInMeasure % 4 === 0) {
        for (const cb of this._beatCallbacks) {
          try { cb(this._currentBeat, scheduledTime, this._bpm); }
          catch (e) { console.error('Beat callback error:', e); }
        }
      }

      // Fire measure callbacks on measure boundaries
      if (stepInMeasure === 0) {
        for (const cb of this._measureCallbacks) {
          try { cb(this._currentMeasure, scheduledTime); }
          catch (e) { console.error('Measure callback error:', e); }
        }
      }

      // Advance by one 16th note
      this._nextNoteTime += this.secondsPer16th;
      this._currentStep++;

      // Update beat and measure counters
      const newStepInMeasure = this._currentStep % stepsPerMeasure;
      if (newStepInMeasure % 4 === 0) {
        this._currentBeat++;
      }
      if (newStepInMeasure === 0 && this._currentStep > 0) {
        this._currentMeasure++;
      }

      // Loop
      if (this._loopEnabled) {
        const loopStartStep = this._loopStart * 4;
        const loopEndStep = this._loopEnd * 4;
        if (this._currentStep >= loopEndStep) {
          this._currentStep = loopStartStep;
          this._currentBeat = this._loopStart;
          this._currentMeasure = Math.floor(this._loopStart / this._timeSignature.numerator);
        }
      }
    }

    // UI tick callbacks (on every scheduler pass)
    for (const cb of this._tickCallbacks) {
      try { cb(this._currentStep); } catch (_) { /* swallow */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert a MIDI note number to frequency.
   * @param {number} note - MIDI note (0-127)
   * @returns {number} Frequency in Hz
   */
  static midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  /**
   * Convert beats to seconds at the current BPM.
   * @param {number} beats
   * @returns {number}
   */
  beatsToSeconds(beats) {
    return beats * this.secondsPerBeat;
  }

  /**
   * Convert seconds to beats at the current BPM.
   * @param {number} seconds
   * @returns {number}
   */
  secondsToBeats(seconds) {
    return seconds / this.secondsPerBeat;
  }

  /**
   * Current audio time shorthand.
   * @returns {number}
   */
  get now() {
    return this._ctx ? this._ctx.currentTime : 0;
  }

  // ---------------------------------------------------------------------------
  // Export to WAV
  // ---------------------------------------------------------------------------

  /**
   * Render a section of the project to a WAV Blob via OfflineAudioContext.
   *
   * @param {Object} options
   * @param {number} options.duration - Duration in seconds
   * @param {number} [options.sampleRate=44100]
   * @param {number} [options.numberOfChannels=2]
   * @param {function(OfflineAudioContext, GainNode): void} options.renderCallback
   *   Called with the offline context and a master gain node.
   *   The caller should build the audio graph on the offline context.
   * @returns {Promise<Blob>} WAV blob
   */
  async exportWAV({
    duration,
    sampleRate = 44100,
    numberOfChannels = 2,
    renderCallback,
  }) {
    const length = Math.ceil(sampleRate * duration);
    const offlineCtx = new OfflineAudioContext(numberOfChannels, length, sampleRate);

    const master = offlineCtx.createGain();
    master.gain.value = 0.8;
    master.connect(offlineCtx.destination);

    if (renderCallback) {
      await renderCallback(offlineCtx, master);
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return this._audioBufferToWavBlob(renderedBuffer);
  }

  /**
   * Encode an AudioBuffer as a WAV Blob (PCM 16-bit).
   * @param {AudioBuffer} buffer
   * @returns {Blob}
   */
  _audioBufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);  // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave channels and write 16-bit PCM
    const channels = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(buffer.getChannelData(ch));
    }

    let offset = headerSize;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channels[ch][i];
        sample = Math.max(-1, Math.min(1, sample));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample | 0, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Tear down the engine and release resources.
   */
  async destroy() {
    this.stop();
    if (this._ctx && this._ctx.state !== 'closed') {
      await this._ctx.close();
    }
    this._ctx = null;
    this._masterGain = null;
    this._masterCompressor = null;
    this._preGain = null;
    this._limiter = null;
    this._stepCallbacks.clear();
    this._beatCallbacks.clear();
    this._measureCallbacks.clear();
    this._tickCallbacks.clear();
    this._transportCallbacks.clear();
  }
}

// Singleton
const engine = new AudioEngine();
export default engine;
export { AudioEngine };
