/**
 * Synthesizer.js — Polyphonic synthesizer engine for NOVA DAW
 *
 * Professional-grade virtual analog synth with dual oscillators,
 * resonant filter, ADSR envelopes, LFO modulation, glide, and
 * voice stealing. Designed for zero-click, zero-glitch playback.
 */

const MAX_POLYPHONY = 8;
const FREQ_MIN = 20;
const FREQ_MAX = 20000;
const VOICE_STEAL_FADE_MS = 0.005; // 5ms fade to prevent clicks

function clampFreq(f) {
    return Math.max(FREQ_MIN, Math.min(FREQ_MAX, f));
}

function clampGain(g) {
    return Math.max(0, Math.min(1, g));
}

function midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export default class Synthesizer {
    /**
     * @param {AudioContext} audioContext
     * @param {AudioNode} destinationNode
     */
    constructor(audioContext, destinationNode) {
        this.audioContext = audioContext;
        this.destination = destinationNode;

        // Master output with conservative gain to prevent clipping at full polyphony
        this.output = this.audioContext.createGain();
        this.output.gain.value = 0.3;
        this.output.connect(this.destination);

        // Voice management
        this.voices = new Map();   // MIDI note → voice object
        this.voiceOrder = [];      // oldest-first for voice stealing

        // Last played note frequency for glide
        this._lastNoteFreq = null;

        // Default patch: warm saw pad
        this.params = {
            osc1: { type: 'sawtooth', octave: 0, detune: 0, gain: 0.8 },
            osc2: { type: 'square', octave: 0, detune: 7, gain: 0.3 },
            filter: { type: 'lowpass', frequency: 2000, Q: 1 },
            filterEnv: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3, amount: 3000 },
            ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
            lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
            glide: 0,
            masterGain: 0.3
        };
    }

    /**
     * Trigger a note.
     * @param {number} midiNote  — 0-127 MIDI note number
     * @param {number} velocity  — 0-1 normalized velocity
     * @param {number|null} time — AudioContext time, defaults to now
     */
    noteOn(midiNote, velocity = 1, time = null) {
        const t = time ?? this.audioContext.currentTime;
        const ctx = this.audioContext;
        velocity = clampGain(velocity);

        // If this note is already sounding, release it first
        if (this.voices.has(midiNote)) {
            this._stealVoice(midiNote, t);
        }

        // Voice stealing: if at max polyphony, kill the oldest voice
        if (this.voices.size >= MAX_POLYPHONY && this.voiceOrder.length > 0) {
            const oldestNote = this.voiceOrder[0];
            this._stealVoice(oldestNote, t);
        }

        const p = this.params;
        const baseFreq = midiToFreq(midiNote);

        // --- Oscillator 1 ---
        const osc1 = ctx.createOscillator();
        osc1.type = p.osc1.type;
        const osc1Freq = clampFreq(baseFreq * Math.pow(2, p.osc1.octave));
        osc1.frequency.setValueAtTime(osc1Freq, t);
        osc1.detune.setValueAtTime(p.osc1.detune, t);

        const osc1Gain = ctx.createGain();
        osc1Gain.gain.setValueAtTime(clampGain(p.osc1.gain), t);

        // --- Oscillator 2 ---
        const osc2 = ctx.createOscillator();
        osc2.type = p.osc2.type;
        const osc2Freq = clampFreq(baseFreq * Math.pow(2, p.osc2.octave));
        osc2.frequency.setValueAtTime(osc2Freq, t);
        osc2.detune.setValueAtTime(p.osc2.detune, t);

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(clampGain(p.osc2.gain), t);

        // --- Glide (portamento) ---
        if (p.glide > 0 && this._lastNoteFreq !== null) {
            osc1.frequency.setValueAtTime(
                clampFreq(this._lastNoteFreq * Math.pow(2, p.osc1.octave)), t
            );
            osc1.frequency.linearRampToValueAtTime(osc1Freq, t + p.glide);

            osc2.frequency.setValueAtTime(
                clampFreq(this._lastNoteFreq * Math.pow(2, p.osc2.octave)), t
            );
            osc2.frequency.linearRampToValueAtTime(osc2Freq, t + p.glide);
        }
        this._lastNoteFreq = baseFreq;

        // --- Filter ---
        const filter = ctx.createBiquadFilter();
        filter.type = p.filter.type;
        filter.Q.setValueAtTime(p.filter.Q, t);

        const filterBase = clampFreq(p.filter.frequency);
        const filterPeak = clampFreq(filterBase + p.filterEnv.amount);
        const filterSustainFreq = clampFreq(
            filterBase + p.filterEnv.amount * p.filterEnv.sustain
        );

        // Filter envelope
        const fAttack = Math.max(0.001, p.filterEnv.attack);
        const fDecay = Math.max(0.001, p.filterEnv.decay);

        filter.frequency.setValueAtTime(filterBase, t);
        filter.frequency.linearRampToValueAtTime(filterPeak, t + fAttack);
        filter.frequency.setTargetAtTime(filterSustainFreq, t + fAttack, fDecay / 3);

        // --- Amp envelope ---
        const ampGain = ctx.createGain();
        const aAttack = Math.max(0.001, p.ampEnv.attack);
        const aDecay = Math.max(0.001, p.ampEnv.decay);
        const aSustain = clampGain(p.ampEnv.sustain) * velocity;

        ampGain.gain.setValueAtTime(0, t);
        ampGain.gain.linearRampToValueAtTime(velocity, t + aAttack);
        ampGain.gain.setTargetAtTime(aSustain, t + aAttack, aDecay / 3);

        // --- Routing ---
        osc1.connect(osc1Gain);
        osc2.connect(osc2Gain);
        osc1Gain.connect(filter);
        osc2Gain.connect(filter);
        filter.connect(ampGain);
        ampGain.connect(this.output);

        // --- LFO ---
        let lfo = null;
        let lfoGain = null;

        if (p.lfo.rate > 0 && p.lfo.destination !== 'none') {
            lfo = ctx.createOscillator();
            lfo.type = p.lfo.type;
            lfo.frequency.setValueAtTime(p.lfo.rate, t);

            lfoGain = ctx.createGain();

            switch (p.lfo.destination) {
                case 'filter':
                    lfoGain.gain.setValueAtTime(p.lfo.depth, t);
                    lfo.connect(lfoGain);
                    lfoGain.connect(filter.frequency);
                    break;
                case 'pitch':
                    // Depth in cents for pitch modulation
                    lfoGain.gain.setValueAtTime(p.lfo.depth, t);
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc1.detune);
                    lfoGain.connect(osc2.detune);
                    break;
                case 'amplitude':
                    lfoGain.gain.setValueAtTime(clampGain(p.lfo.depth), t);
                    lfo.connect(lfoGain);
                    lfoGain.connect(ampGain.gain);
                    break;
            }

            lfo.start(t);
        }

        // --- Start oscillators ---
        osc1.start(t);
        osc2.start(t);

        // --- Store voice ---
        const voice = {
            osc1,
            osc1Gain,
            osc2,
            osc2Gain,
            filter,
            ampGain,
            lfo,
            lfoGain,
            noteNumber: midiNote,
            velocity,
            startTime: t
        };

        this.voices.set(midiNote, voice);
        this.voiceOrder.push(midiNote);
    }

    /**
     * Release a note.
     * @param {number} midiNote
     * @param {number|null} time
     */
    noteOff(midiNote, time = null) {
        const t = time ?? this.audioContext.currentTime;
        const voice = this.voices.get(midiNote);
        if (!voice) return;

        const p = this.params;
        const release = Math.max(0.001, p.ampEnv.release);
        const filterRelease = Math.max(0.001, p.filterEnv.release);
        const filterBase = clampFreq(p.filter.frequency);

        // Cancel any scheduled envelope ramps and apply release
        voice.ampGain.gain.cancelScheduledValues(t);
        voice.ampGain.gain.setValueAtTime(voice.ampGain.gain.value, t);
        voice.ampGain.gain.setTargetAtTime(0, t, release / 3);

        voice.filter.frequency.cancelScheduledValues(t);
        voice.filter.frequency.setValueAtTime(voice.filter.frequency.value, t);
        voice.filter.frequency.setTargetAtTime(filterBase, t, filterRelease / 3);

        // Schedule full stop after release tail finishes
        // 5 time constants ≈ 99% of exponential decay
        const stopTime = t + release + 0.1;

        voice.osc1.stop(stopTime);
        voice.osc2.stop(stopTime);
        if (voice.lfo) {
            voice.lfo.stop(stopTime);
        }

        // Clean up after stop
        this._scheduleCleanup(voice, stopTime);

        // Remove from tracking
        this.voices.delete(midiNote);
        const idx = this.voiceOrder.indexOf(midiNote);
        if (idx !== -1) this.voiceOrder.splice(idx, 1);
    }

    /**
     * Quick-steal a voice with a fast fadeout to prevent clicks.
     * @private
     */
    _stealVoice(midiNote, time) {
        const voice = this.voices.get(midiNote);
        if (!voice) return;

        const t = time;

        // Quick 5ms fade to avoid clicks
        voice.ampGain.gain.cancelScheduledValues(t);
        voice.ampGain.gain.setValueAtTime(voice.ampGain.gain.value, t);
        voice.ampGain.gain.linearRampToValueAtTime(0, t + VOICE_STEAL_FADE_MS);

        const stopTime = t + VOICE_STEAL_FADE_MS + 0.01;
        voice.osc1.stop(stopTime);
        voice.osc2.stop(stopTime);
        if (voice.lfo) {
            voice.lfo.stop(stopTime);
        }

        this._scheduleCleanup(voice, stopTime);

        this.voices.delete(midiNote);
        const idx = this.voiceOrder.indexOf(midiNote);
        if (idx !== -1) this.voiceOrder.splice(idx, 1);
    }

    /**
     * Disconnect all nodes in a voice after it has stopped.
     * @private
     */
    _scheduleCleanup(voice, stopTime) {
        const delayMs = Math.max(0, (stopTime - this.audioContext.currentTime) * 1000) + 50;
        setTimeout(() => {
            try {
                voice.osc1.disconnect();
                voice.osc1Gain.disconnect();
                voice.osc2.disconnect();
                voice.osc2Gain.disconnect();
                voice.filter.disconnect();
                voice.ampGain.disconnect();
                if (voice.lfo) voice.lfo.disconnect();
                if (voice.lfoGain) voice.lfoGain.disconnect();
            } catch (_) {
                // Nodes may already be disconnected
            }
        }, delayMs);
    }

    /**
     * Update a single parameter by dot-path (e.g. 'filter.frequency').
     * Applies immediately to all active voices for real-time parameters.
     * @param {string} path
     * @param {*} value
     */
    setParam(path, value) {
        // Update stored params
        const keys = path.split('.');
        let target = this.params;
        for (let i = 0; i < keys.length - 1; i++) {
            target = target[keys[i]];
            if (target === undefined) return;
        }
        target[keys[keys.length - 1]] = value;

        // Update master gain
        if (path === 'masterGain') {
            this.output.gain.setTargetAtTime(
                clampGain(value),
                this.audioContext.currentTime,
                0.01
            );
            return;
        }

        // Apply real-time changes to all active voices
        const now = this.audioContext.currentTime;

        for (const voice of this.voices.values()) {
            switch (path) {
                case 'filter.frequency':
                    voice.filter.frequency.setTargetAtTime(
                        clampFreq(value), now, 0.01
                    );
                    break;
                case 'filter.Q':
                    voice.filter.Q.setTargetAtTime(value, now, 0.01);
                    break;
                case 'filter.type':
                    voice.filter.type = value;
                    break;
                case 'osc1.type':
                    voice.osc1.type = value;
                    break;
                case 'osc2.type':
                    voice.osc2.type = value;
                    break;
                case 'osc1.gain':
                    voice.osc1Gain.gain.setTargetAtTime(
                        clampGain(value), now, 0.01
                    );
                    break;
                case 'osc2.gain':
                    voice.osc2Gain.gain.setTargetAtTime(
                        clampGain(value), now, 0.01
                    );
                    break;
                case 'osc1.detune':
                    voice.osc1.detune.setTargetAtTime(value, now, 0.01);
                    break;
                case 'osc2.detune':
                    voice.osc2.detune.setTargetAtTime(value, now, 0.01);
                    break;
                case 'lfo.rate':
                    if (voice.lfo) {
                        voice.lfo.frequency.setTargetAtTime(value, now, 0.01);
                    }
                    break;
                case 'lfo.depth':
                    if (voice.lfoGain) {
                        voice.lfoGain.gain.setTargetAtTime(value, now, 0.01);
                    }
                    break;
            }
        }
    }

    /**
     * Load a full preset, replacing all params and updating active voices.
     * @param {object} preset — object matching the shape of this.params
     */
    loadPreset(preset) {
        this.params = deepCopy(preset);

        // Apply master gain
        this.output.gain.setTargetAtTime(
            clampGain(this.params.masterGain),
            this.audioContext.currentTime,
            0.01
        );

        // Update real-time params on active voices
        const now = this.audioContext.currentTime;
        for (const voice of this.voices.values()) {
            voice.osc1.type = this.params.osc1.type;
            voice.osc2.type = this.params.osc2.type;
            voice.osc1Gain.gain.setTargetAtTime(
                clampGain(this.params.osc1.gain), now, 0.01
            );
            voice.osc2Gain.gain.setTargetAtTime(
                clampGain(this.params.osc2.gain), now, 0.01
            );
            voice.osc1.detune.setTargetAtTime(this.params.osc1.detune, now, 0.01);
            voice.osc2.detune.setTargetAtTime(this.params.osc2.detune, now, 0.01);
            voice.filter.type = this.params.filter.type;
            voice.filter.frequency.setTargetAtTime(
                clampFreq(this.params.filter.frequency), now, 0.01
            );
            voice.filter.Q.setTargetAtTime(this.params.filter.Q, now, 0.01);
            if (voice.lfo) {
                voice.lfo.frequency.setTargetAtTime(this.params.lfo.rate, now, 0.01);
            }
            if (voice.lfoGain) {
                voice.lfoGain.gain.setTargetAtTime(this.params.lfo.depth, now, 0.01);
            }
        }
    }

    /**
     * Release all active voices.
     */
    allNotesOff() {
        const notes = [...this.voices.keys()];
        for (const note of notes) {
            this.noteOff(note);
        }
    }

    /**
     * @returns {number} Number of currently active voices
     */
    getActiveVoiceCount() {
        return this.voices.size;
    }

    /**
     * @returns {object} Deep copy of current patch parameters
     */
    getParams() {
        return deepCopy(this.params);
    }

    /**
     * Tear down the synthesizer: release all voices and disconnect output.
     */
    dispose() {
        this.allNotesOff();
        try {
            this.output.disconnect();
        } catch (_) {
            // Already disconnected
        }
    }
}
