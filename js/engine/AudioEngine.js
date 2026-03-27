/**
 * NOVA DAW - Core Audio Engine
 *
 * Manages the Web Audio API graph, clock scheduling, and routing.
 * Handles master bus processing, channel strips, send buses,
 * and sample-accurate step sequencer timing.
 */

const NUM_CHANNELS = 8;
const SYNTH_CHANNELS = [0, 1, 2, 3];
const DRUM_CHANNELS = [4, 5, 6, 7];
const MIN_BPM = 20;
const MAX_BPM = 300;
const DEFAULT_BPM = 120;
const DEFAULT_VOLUME = 0.8;
const SCHEDULE_AHEAD_TIME = 0.1; // seconds
const LOOKAHEAD_MS = 25; // milliseconds
const TOTAL_STEPS = 16;

class AudioEngine {
    constructor() {
        // ---- Audio Context ----
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();

        // ---- Master Bus: gain -> compressor (limiter) -> destination ----
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = DEFAULT_VOLUME;

        this.limiter = this.audioContext.createDynamicsCompressor();
        this.limiter.threshold.value = -3;
        this.limiter.knee.value = 6;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.25;

        this.masterAnalyser = this.audioContext.createAnalyser();
        this.masterAnalyser.fftSize = 2048;
        this.masterAnalyser.smoothingTimeConstant = 0.8;

        // Routing: masterGain -> masterAnalyser -> limiter -> destination
        this.masterGain.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.limiter);
        this.limiter.connect(this.audioContext.destination);

        // ---- Transport State ----
        this.bpm = DEFAULT_BPM;
        this.timeSignature = { beats: 4, unit: 4 };
        this.isPlaying = false;
        this.currentStep = 0;
        this.totalSteps = TOTAL_STEPS;
        this.swing = 0; // 0-100

        // ---- Scheduler State ----
        this.nextStepTime = 0;
        this.scheduleAheadTime = SCHEDULE_AHEAD_TIME;
        this.lookahead = LOOKAHEAD_MS;
        this._schedulerTimerId = null;

        // ---- Callbacks ----
        this.onStep = [];
        this.onBeat = [];
        this.onBar = [];
        this.onStop = [];

        // ---- Channel Strips ----
        this.channels = [];
        for (let i = 0; i < NUM_CHANNELS; i++) {
            const gain = this.audioContext.createGain();
            gain.gain.value = DEFAULT_VOLUME;

            const panner = this.audioContext.createStereoPanner();
            panner.pan.value = 0;

            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8;

            // Routing: gain -> panner -> analyser -> masterGain
            gain.connect(panner);
            panner.connect(analyser);
            analyser.connect(this.masterGain);

            this.channels.push({
                gain,
                panner,
                analyser,
                muted: false,
                solo: false,
                volume: DEFAULT_VOLUME,
                pan: 0,
                type: i < 4 ? 'synth' : 'drum',
                sendLevels: { reverb: 0, delay: 0 },
                _sendGains: {}
            });
        }

        // ---- Send Buses ----
        this.sends = {};

        // Reverb send
        this.sends.reverb = this.audioContext.createGain();
        this.sends.reverb.gain.value = 0.3;
        this.sends.reverb.connect(this.masterGain);

        // Delay send
        this.sends.delay = this.audioContext.createGain();
        this.sends.delay.gain.value = 0.3;
        this.sends.delay.connect(this.masterGain);

        // Create per-channel send gain nodes
        for (let i = 0; i < NUM_CHANNELS; i++) {
            const ch = this.channels[i];

            // Reverb send from this channel
            const reverbSendGain = this.audioContext.createGain();
            reverbSendGain.gain.value = 0;
            ch.gain.connect(reverbSendGain);
            reverbSendGain.connect(this.sends.reverb);
            ch._sendGains.reverb = reverbSendGain;

            // Delay send from this channel
            const delaySendGain = this.audioContext.createGain();
            delaySendGain.gain.value = 0;
            ch.gain.connect(delaySendGain);
            delaySendGain.connect(this.sends.delay);
            ch._sendGains.delay = delaySendGain;
        }

        // ---- Metronome state ----
        this.metronomeEnabled = false;

        // ---- Analyser data buffers (reuse to avoid GC) ----
        this._masterAnalyserData = new Float32Array(this.masterAnalyser.fftSize);
        this._channelAnalyserData = new Float32Array(2048);

        // Bind scheduler to preserve context
        this._scheduler = this._scheduler.bind(this);
    }

    // =====================================================================
    // Transport
    // =====================================================================

    /**
     * Start playback. Resumes AudioContext if suspended (required by browsers
     * after user gesture policy).
     */
    async play() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.nextStepTime = this.audioContext.currentTime;
        this._scheduler();
    }

    /**
     * Stop playback and reset step position.
     */
    stop() {
        this.isPlaying = false;
        this.currentStep = 0;

        if (this._schedulerTimerId !== null) {
            clearTimeout(this._schedulerTimerId);
            this._schedulerTimerId = null;
        }

        for (let i = 0; i < this.onStop.length; i++) {
            try {
                this.onStop[i]();
            } catch (e) {
                console.error('[AudioEngine] onStop callback error:', e);
            }
        }
    }

    // =====================================================================
    // Scheduler (private)
    // =====================================================================

    /**
     * Lookahead scheduler. Runs on a setTimeout loop and schedules audio
     * events ahead of time for sample-accurate timing.
     * @private
     */
    _scheduler() {
        while (this.nextStepTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this._processStep(this.currentStep, this.nextStepTime);
            this.nextStepTime += this._getStepDuration(this.currentStep);
            this.currentStep = (this.currentStep + 1) % this.totalSteps;
        }

        if (this.isPlaying) {
            this._schedulerTimerId = setTimeout(this._scheduler, this.lookahead);
        }
    }

    /**
     * Process a single step: fire callbacks for step, beat, and bar events.
     * @private
     */
    _processStep(step, time) {
        // Fire step callbacks
        for (let i = 0; i < this.onStep.length; i++) {
            try {
                this.onStep[i](step, time);
            } catch (e) {
                console.error('[AudioEngine] onStep callback error:', e);
            }
        }

        // Beat detection: steps per beat = totalSteps / timeSignature.beats
        const stepsPerBeat = this.totalSteps / this.timeSignature.beats;
        if (step % stepsPerBeat === 0) {
            const beatIndex = step / stepsPerBeat;
            for (let i = 0; i < this.onBeat.length; i++) {
                try {
                    this.onBeat[i](beatIndex, time);
                } catch (e) {
                    console.error('[AudioEngine] onBeat callback error:', e);
                }
            }
        }

        // Bar detection: step 0
        if (step === 0) {
            for (let i = 0; i < this.onBar.length; i++) {
                try {
                    this.onBar[i](time);
                } catch (e) {
                    console.error('[AudioEngine] onBar callback error:', e);
                }
            }
        }

        // Metronome
        if (this.metronomeEnabled) {
            const isDownbeat = step % stepsPerBeat === 0 && step === 0;
            const isBeat = step % stepsPerBeat === 0;
            if (isBeat) {
                this.playMetronome(time, isDownbeat);
            }
        }
    }

    /**
     * Calculate the duration of a single step (16th note) in seconds,
     * with optional swing applied to odd-numbered steps.
     * @private
     */
    _getStepDuration(step) {
        // Base 16th-note duration: one beat = 4 sixteenth notes
        const baseDuration = (60 / this.bpm) / 4;

        if (this.swing <= 0) return baseDuration;

        // Swing shifts timing of odd steps. A swing of 100 means full
        // triplet feel (2/3 + 1/3 split). At swing=50 it is halfway
        // between straight and triplet.
        const swingFactor = (this.swing / 100) * 0.333; // max 1/3 shift

        if (step % 2 === 0) {
            // Even steps are lengthened
            return baseDuration * (1 + swingFactor);
        } else {
            // Odd steps are shortened
            return baseDuration * (1 - swingFactor);
        }
    }

    // =====================================================================
    // Tempo & Time Signature
    // =====================================================================

    /**
     * Set BPM, clamped to 20-300.
     * @param {number} bpm
     */
    setBPM(bpm) {
        this.bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
    }

    /**
     * Set swing amount.
     * @param {number} amount - 0 to 100
     */
    setSwing(amount) {
        this.swing = Math.max(0, Math.min(100, amount));
    }

    /**
     * Set time signature.
     * @param {number} beats - Numerator (e.g., 4)
     * @param {number} unit - Denominator (e.g., 4)
     */
    setTimeSignature(beats, unit) {
        this.timeSignature = { beats, unit };
    }

    // =====================================================================
    // Channel Control
    // =====================================================================

    /**
     * Set channel volume.
     * @param {number} channel - Channel index 0-7
     * @param {number} value - 0 to 1
     */
    setChannelVolume(channel, value) {
        if (channel < 0 || channel >= NUM_CHANNELS) return;
        const ch = this.channels[channel];
        const clamped = Math.max(0, Math.min(1, value));
        ch.volume = clamped;

        // Apply volume only if not muted (or if soloed)
        if (!ch.muted || ch.solo) {
            ch.gain.gain.setTargetAtTime(clamped, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Set channel pan.
     * @param {number} channel - Channel index 0-7
     * @param {number} value - -1 (left) to 1 (right)
     */
    setChannelPan(channel, value) {
        if (channel < 0 || channel >= NUM_CHANNELS) return;
        const clamped = Math.max(-1, Math.min(1, value));
        this.channels[channel].pan = clamped;
        this.channels[channel].panner.pan.setTargetAtTime(
            clamped, this.audioContext.currentTime, 0.01
        );
    }

    /**
     * Mute or unmute a channel.
     * @param {number} channel - Channel index 0-7
     * @param {boolean} muted
     */
    setChannelMute(channel, muted) {
        if (channel < 0 || channel >= NUM_CHANNELS) return;
        this.channels[channel].muted = muted;
        this._updateChannelGains();
    }

    /**
     * Solo or unsolo a channel. When any channel is soloed, all non-soloed
     * channels are muted (unless they are also soloed).
     * @param {number} channel - Channel index 0-7
     * @param {boolean} solo
     */
    setChannelSolo(channel, solo) {
        if (channel < 0 || channel >= NUM_CHANNELS) return;
        this.channels[channel].solo = solo;
        this._updateChannelGains();
    }

    /**
     * Recalculate effective gain for all channels based on mute/solo state.
     * Uses setTargetAtTime for click-free transitions.
     * @private
     */
    _updateChannelGains() {
        const anySoloed = this.channels.some(ch => ch.solo);
        const now = this.audioContext.currentTime;

        for (let i = 0; i < NUM_CHANNELS; i++) {
            const ch = this.channels[i];
            let effectiveGain;

            if (anySoloed) {
                // If any channel is soloed, only soloed channels are audible
                effectiveGain = ch.solo ? ch.volume : 0;
            } else {
                // Normal mode: respect mute state
                effectiveGain = ch.muted ? 0 : ch.volume;
            }

            ch.gain.gain.setTargetAtTime(effectiveGain, now, 0.01);
        }
    }

    /**
     * Set send level from a channel to a send bus.
     * @param {number} channel - Channel index 0-7
     * @param {string} sendType - 'reverb' or 'delay'
     * @param {number} amount - 0 to 1
     */
    setSendLevel(channel, sendType, amount) {
        if (channel < 0 || channel >= NUM_CHANNELS) return;
        if (!this.sends[sendType]) return;

        const clamped = Math.max(0, Math.min(1, amount));
        const ch = this.channels[channel];
        ch.sendLevels[sendType] = clamped;

        const sendGain = ch._sendGains[sendType];
        if (sendGain) {
            sendGain.gain.setTargetAtTime(clamped, this.audioContext.currentTime, 0.01);
        }
    }

    // =====================================================================
    // Metering
    // =====================================================================

    /**
     * Read the master bus level from the AnalyserNode.
     * Returns a normalized 0-1 value representing peak amplitude.
     * @returns {{ left: number, right: number }}
     */
    getMasterLevel() {
        this.masterAnalyser.getFloatTimeDomainData(this._masterAnalyserData);
        const data = this._masterAnalyserData;
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > peak) peak = abs;
        }
        // Clamp to 0-1
        const level = Math.min(1, peak);
        // Without a true stereo splitter on the analyser, we approximate
        // L/R from the single analyser. For true stereo metering, a
        // ChannelSplitter would be needed upstream.
        return { left: level, right: level };
    }

    /**
     * Read a channel's level from its AnalyserNode.
     * @param {number} channel - Channel index 0-7
     * @returns {number} 0-1 peak level
     */
    getChannelLevel(channel) {
        if (channel < 0 || channel >= NUM_CHANNELS) return 0;
        const analyser = this.channels[channel].analyser;
        analyser.getFloatTimeDomainData(this._channelAnalyserData);
        let peak = 0;
        for (let i = 0; i < this._channelAnalyserData.length; i++) {
            const abs = Math.abs(this._channelAnalyserData[i]);
            if (abs > peak) peak = abs;
        }
        return Math.min(1, peak);
    }

    // =====================================================================
    // Metronome
    // =====================================================================

    /**
     * Play a short oscillator burst as a metronome click at the given time.
     * Uses a precise gain envelope to prevent clicks and pops.
     * @param {number} time - AudioContext schedule time
     * @param {boolean} isDownbeat - If true, higher pitch and longer duration
     */
    playMetronome(time, isDownbeat) {
        const osc = this.audioContext.createOscillator();
        const clickGain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = isDownbeat ? 1000 : 800;

        const duration = isDownbeat ? 0.05 : 0.03;
        const attackTime = 0.001;
        const releaseTime = 0.005;

        // Gain envelope: quick attack, sustain, quick release
        clickGain.gain.setValueAtTime(0, time);
        clickGain.gain.linearRampToValueAtTime(0.5, time + attackTime);
        clickGain.gain.setValueAtTime(0.5, time + duration - releaseTime);
        clickGain.gain.linearRampToValueAtTime(0, time + duration);

        osc.connect(clickGain);
        clickGain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + duration + 0.001); // tiny buffer past envelope end

        // Clean up references after playback
        osc.onended = () => {
            osc.disconnect();
            clickGain.disconnect();
        };
    }

    // =====================================================================
    // Accessors
    // =====================================================================

    /**
     * @returns {AudioContext}
     */
    getAudioContext() {
        return this.audioContext;
    }

    /**
     * @returns {GainNode} The master gain node
     */
    getMasterGain() {
        return this.masterGain;
    }

    /**
     * Get a channel's gain node for external routing (e.g., connecting
     * synth or sampler output).
     * @param {number} channel - Channel index 0-7
     * @returns {GainNode|null}
     */
    getChannelOutput(channel) {
        if (channel < 0 || channel >= NUM_CHANNELS) return null;
        return this.channels[channel].gain;
    }

    // =====================================================================
    // Event System
    // =====================================================================

    /**
     * Register a callback for a transport event.
     * @param {'step'|'beat'|'bar'|'stop'} event
     * @param {Function} callback
     */
    on(event, callback) {
        const map = this._getCallbackArray(event);
        if (map && typeof callback === 'function') {
            map.push(callback);
        }
    }

    /**
     * Unregister a callback for a transport event.
     * @param {'step'|'beat'|'bar'|'stop'} event
     * @param {Function} callback
     */
    off(event, callback) {
        const map = this._getCallbackArray(event);
        if (!map) return;
        const idx = map.indexOf(callback);
        if (idx !== -1) {
            map.splice(idx, 1);
        }
    }

    /**
     * @private
     */
    _getCallbackArray(event) {
        switch (event) {
            case 'step': return this.onStep;
            case 'beat': return this.onBeat;
            case 'bar': return this.onBar;
            case 'stop': return this.onStop;
            default: return null;
        }
    }

    // =====================================================================
    // Cleanup
    // =====================================================================

    /**
     * Dispose of all audio nodes and close the AudioContext.
     * Call this when the DAW is being destroyed.
     */
    async dispose() {
        this.stop();

        // Disconnect all channel strips
        for (let i = 0; i < NUM_CHANNELS; i++) {
            const ch = this.channels[i];
            ch.gain.disconnect();
            ch.panner.disconnect();
            ch.analyser.disconnect();
            if (ch._sendGains.reverb) ch._sendGains.reverb.disconnect();
            if (ch._sendGains.delay) ch._sendGains.delay.disconnect();
        }

        // Disconnect send buses
        this.sends.reverb.disconnect();
        this.sends.delay.disconnect();

        // Disconnect master bus
        this.masterGain.disconnect();
        this.masterAnalyser.disconnect();
        this.limiter.disconnect();

        // Clear callback arrays
        this.onStep.length = 0;
        this.onBeat.length = 0;
        this.onBar.length = 0;
        this.onStop.length = 0;

        // Close context
        if (this.audioContext.state !== 'closed') {
            await this.audioContext.close();
        }
    }
}

export default AudioEngine;
