/**
 * DrumMachine - Synthesized drum machine for NOVA DAW
 * All sounds generated via Web Audio API, no samples required.
 */
export default class DrumMachine {
    constructor(audioContext, destinationNode) {
        this.ctx = audioContext;
        this.destination = destinationNode;

        // Master output gain
        this.outputGain = this.ctx.createGain();
        this.outputGain.gain.value = 0.8;
        this.outputGain.connect(this.destination);

        // Per-sound parameters
        this.sounds = {
            kick:   { pitch: 150,  decay: 0.5,  tone: 0.5, volume: 1.0 },
            snare:  { pitch: 200,  decay: 0.3,  tone: 0.6, volume: 0.9 },
            hihatC: { pitch: 8000, decay: 0.05, tone: 0.8, volume: 0.6 },
            hihatO: { pitch: 8000, decay: 0.3,  tone: 0.8, volume: 0.6 },
            clap:   { pitch: 1000, decay: 0.15, tone: 0.7, volume: 0.8 },
            rim:    { pitch: 800,  decay: 0.05, tone: 0.9, volume: 0.7 },
            tom:    { pitch: 100,  decay: 0.3,  tone: 0.5, volume: 0.8 },
            cymbal: { pitch: 6000, decay: 0.8,  tone: 0.7, volume: 0.5 }
        };

        // Shared noise buffer
        const bufferSize = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        // Open hihat choke reference
        this._openHihatNodes = null;

        // Patterns: 64 patterns, each has 16 steps per sound
        this.patterns = [];
        for (let i = 0; i < 64; i++) {
            this.patterns.push(this._createEmptyPattern());
        }
        this.currentPattern = 0;
    }

    // ─── Pattern Helpers ───────────────────────────────────────────────

    _createEmptyPattern() {
        const pattern = {};
        for (const name of Object.keys(this.sounds)) {
            pattern[name] = new Array(16).fill(null);
        }
        return pattern;
    }

    // ─── Trigger Dispatch ──────────────────────────────────────────────

    trigger(soundName, time, velocity = 1) {
        const params = this.sounds[soundName];
        if (!params) return;

        const scaledParams = { ...params, volume: params.volume * velocity };

        switch (soundName) {
            case 'kick':   this.triggerKick(time, scaledParams); break;
            case 'snare':  this.triggerSnare(time, scaledParams); break;
            case 'hihatC': this.triggerHihatClosed(time, scaledParams); break;
            case 'hihatO': this.triggerHihatOpen(time, scaledParams); break;
            case 'clap':   this.triggerClap(time, scaledParams); break;
            case 'rim':    this.triggerRim(time, scaledParams); break;
            case 'tom':    this.triggerTom(time, scaledParams); break;
            case 'cymbal': this.triggerCymbal(time, scaledParams); break;
        }
    }

    // ─── Utility: schedule cleanup ─────────────────────────────────────

    _scheduleCleanup(nodes, time) {
        const ms = Math.max(0, (time - this.ctx.currentTime) * 1000) + 50;
        setTimeout(() => {
            for (const node of nodes) {
                try { node.disconnect(); } catch (_) { /* already disconnected */ }
            }
        }, ms);
    }

    _createNoiseSource() {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;
        return source;
    }

    // ─── KICK ──────────────────────────────────────────────────────────

    triggerKick(time, params) {
        const { pitch, decay, tone, volume } = params;
        const endTime = time + decay + 0.1;
        const nodes = [];

        // Output gain for this hit
        const hitGain = this.ctx.createGain();
        hitGain.gain.setValueAtTime(0.45 * volume, time);
        hitGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        hitGain.gain.setValueAtTime(0, time + decay + 0.01);
        hitGain.connect(this.outputGain);
        nodes.push(hitGain);

        // Lowpass filter shaped by tone
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 60 + tone * 200;
        filter.Q.value = 1;
        filter.connect(hitGain);
        nodes.push(filter);

        // Main body oscillator (sine)
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, time);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.25, time + 0.1);
        osc.connect(filter);
        osc.start(time);
        osc.stop(endTime);
        nodes.push(osc);

        // Sub layer for low-end weight
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(pitch * 0.5, time);
        sub.frequency.exponentialRampToValueAtTime(pitch * 0.125, time + 0.1);
        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.35 * volume, time);
        subGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        subGain.gain.setValueAtTime(0, time + decay + 0.01);
        sub.connect(subGain);
        subGain.connect(this.outputGain);
        sub.start(time);
        sub.stop(endTime);
        nodes.push(sub, subGain);

        // Transient click (short noise burst ~2ms)
        const click = this._createNoiseSource();
        const clickGain = this.ctx.createGain();
        clickGain.gain.setValueAtTime(0.3 * volume, time);
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.002);
        clickGain.gain.setValueAtTime(0, time + 0.003);
        click.connect(clickGain);
        clickGain.connect(this.outputGain);
        click.start(time);
        click.stop(time + 0.003);
        nodes.push(click, clickGain);

        this._scheduleCleanup(nodes, endTime);
    }

    // ─── SNARE ─────────────────────────────────────────────────────────

    triggerSnare(time, params) {
        const { pitch, decay, tone, volume } = params;
        const endTime = time + decay + 0.05;
        const nodes = [];

        // Body: triangle oscillator
        const bodyOsc = this.ctx.createOscillator();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(pitch, time);
        bodyOsc.frequency.exponentialRampToValueAtTime(pitch * 0.5, time + decay * 0.6);

        const bodyGain = this.ctx.createGain();
        bodyGain.gain.setValueAtTime(0.4 * volume, time);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, time + decay * 0.6);
        bodyGain.gain.setValueAtTime(0, time + decay * 0.6 + 0.01);

        bodyOsc.connect(bodyGain);
        bodyGain.connect(this.outputGain);
        bodyOsc.start(time);
        bodyOsc.stop(endTime);
        nodes.push(bodyOsc, bodyGain);

        // Noise layer through bandpass
        const noise = this._createNoiseSource();
        const noiseBP = this.ctx.createBiquadFilter();
        noiseBP.type = 'bandpass';
        noiseBP.frequency.value = 5000 + tone * 5000;
        noiseBP.Q.value = 1;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5 * volume, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        noiseGain.gain.setValueAtTime(0, time + decay + 0.01);

        noise.connect(noiseBP);
        noiseBP.connect(noiseGain);
        noiseGain.connect(this.outputGain);
        noise.start(time);
        noise.stop(endTime);
        nodes.push(noise, noiseBP, noiseGain);

        this._scheduleCleanup(nodes, endTime);
    }

    // ─── HI-HAT CLOSED ────────────────────────────────────────────────

    triggerHihatClosed(time, params) {
        const { pitch, decay, volume } = params;
        const endTime = time + decay + 0.05;

        // Choke open hihat with quick 3ms fade
        if (this._openHihatNodes) {
            const { gainNode, oscs } = this._openHihatNodes;
            try {
                gainNode.gain.cancelScheduledValues(time);
                gainNode.gain.setValueAtTime(gainNode.gain.value, time);
                gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.003);
                gainNode.gain.setValueAtTime(0, time + 0.004);
            } catch (_) { /* already done */ }
            for (const o of oscs) {
                try { o.stop(time + 0.005); } catch (_) {}
            }
            this._openHihatNodes = null;
        }

        this._synthesizeHihat(time, pitch, decay, volume, endTime, false);
    }

    // ─── HI-HAT OPEN ──────────────────────────────────────────────────

    triggerHihatOpen(time, params) {
        const { pitch, decay, volume } = params;
        const endTime = time + decay + 0.05;
        this._synthesizeHihat(time, pitch, decay, volume, endTime, true);
    }

    _synthesizeHihat(time, pitch, decay, volume, endTime, isOpen) {
        const nodes = [];
        const oscs = [];
        const ratios = [1, 1.34, 1.5, 1.8, 2.14, 2.6];

        // Highpass filter
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 7000;
        hp.Q.value = 1;
        nodes.push(hp);

        // Hit gain envelope
        const hitGain = this.ctx.createGain();
        hitGain.gain.setValueAtTime(0.3 * volume, time);
        hitGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        hitGain.gain.setValueAtTime(0, time + decay + 0.01);
        hp.connect(hitGain);
        hitGain.connect(this.outputGain);
        nodes.push(hitGain);

        // 6 detuned square oscillators
        for (const ratio of ratios) {
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = pitch * ratio;
            osc.connect(hp);
            osc.start(time);
            osc.stop(endTime);
            nodes.push(osc);
            oscs.push(osc);
        }

        if (isOpen) {
            this._openHihatNodes = { gainNode: hitGain, oscs };
        }

        this._scheduleCleanup(nodes, endTime);
    }

    // ─── CLAP ──────────────────────────────────────────────────────────

    triggerClap(time, params) {
        const { decay, volume } = params;
        const burstSpacing = [0, 0.012, 0.024, 0.035];
        const endTime = time + burstSpacing[3] + decay + 0.1;
        const nodes = [];

        for (let i = 0; i < burstSpacing.length; i++) {
            const t = time + burstSpacing[i];
            const isLast = i === burstSpacing.length - 1;
            const burstDecay = isLast ? decay : 0.012;

            const noise = this._createNoiseSource();
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 1200;
            bp.Q.value = 0.5;

            const burstGain = this.ctx.createGain();
            burstGain.gain.setValueAtTime(0.4 * volume, t);
            burstGain.gain.exponentialRampToValueAtTime(0.001, t + burstDecay);
            burstGain.gain.setValueAtTime(0, t + burstDecay + 0.005);

            noise.connect(bp);
            bp.connect(burstGain);
            burstGain.connect(this.outputGain);
            noise.start(t);
            noise.stop(t + burstDecay + 0.01);
            nodes.push(noise, bp, burstGain);
        }

        this._scheduleCleanup(nodes, endTime);
    }

    // ─── RIM ───────────────────────────────────────────────────────────

    triggerRim(time, params) {
        const { pitch, decay, volume } = params;
        const endTime = time + decay + 0.05;
        const nodes = [];

        // Short sine burst with quick pitch drop
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, time);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, time + 0.005);

        // Bandpass for body
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = pitch * 0.8;
        bp.Q.value = 2;

        const hitGain = this.ctx.createGain();
        hitGain.gain.setValueAtTime(0.4 * volume, time);
        hitGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        hitGain.gain.setValueAtTime(0, time + decay + 0.01);

        osc.connect(bp);
        bp.connect(hitGain);
        hitGain.connect(this.outputGain);
        osc.start(time);
        osc.stop(endTime);
        nodes.push(osc, bp, hitGain);

        this._scheduleCleanup(nodes, endTime);
    }

    // ─── TOM ───────────────────────────────────────────────────────────

    triggerTom(time, params) {
        const { pitch, decay, tone, volume } = params;
        const endTime = time + decay + 0.1;
        const nodes = [];

        // Sine oscillator with pitch envelope
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, time);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, time + 0.15);

        const bodyGain = this.ctx.createGain();
        bodyGain.gain.setValueAtTime(0.45 * volume, time);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        bodyGain.gain.setValueAtTime(0, time + decay + 0.01);

        // Lowpass filter shaped by tone
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 200 + tone * 800;
        lp.Q.value = 1;

        osc.connect(lp);
        lp.connect(bodyGain);
        bodyGain.connect(this.outputGain);
        osc.start(time);
        osc.stop(endTime);
        nodes.push(osc, lp, bodyGain);

        // Noise attack layer
        const noise = this._createNoiseSource();
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.15 * volume, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        noiseGain.gain.setValueAtTime(0, time + 0.035);

        noise.connect(noiseGain);
        noiseGain.connect(this.outputGain);
        noise.start(time);
        noise.stop(time + 0.04);
        nodes.push(noise, noiseGain);

        this._scheduleCleanup(nodes, endTime);
    }

    // ─── CYMBAL ────────────────────────────────────────────────────────

    triggerCymbal(time, params) {
        const { pitch, decay, volume } = params;
        const endTime = time + decay + 0.1;
        const nodes = [];
        const ratios = [1, 1.28, 1.53, 1.87, 2.11, 2.47, 2.83, 3.17];

        // Highpass
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 3000;
        hp.Q.value = 0.5;
        nodes.push(hp);

        // Bandpass shimmer
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 8000;
        bp.Q.value = 0.8;
        hp.connect(bp);
        nodes.push(bp);

        // Gain envelope
        const hitGain = this.ctx.createGain();
        hitGain.gain.setValueAtTime(0.25 * volume, time);
        hitGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        hitGain.gain.setValueAtTime(0, time + decay + 0.01);
        bp.connect(hitGain);
        hitGain.connect(this.outputGain);
        nodes.push(hitGain);

        // Multiple detuned square oscillators
        for (const ratio of ratios) {
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = pitch * ratio;
            osc.connect(hp);
            osc.start(time);
            osc.stop(endTime);
            nodes.push(osc);
        }

        // Noise layer
        const noise = this._createNoiseSource();
        const noiseBP = this.ctx.createBiquadFilter();
        noiseBP.type = 'bandpass';
        noiseBP.frequency.value = 6000;
        noiseBP.Q.value = 0.5;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.15 * volume, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        noiseGain.gain.setValueAtTime(0, time + decay + 0.01);

        noise.connect(noiseBP);
        noiseBP.connect(noiseGain);
        noiseGain.connect(this.outputGain);
        noise.start(time);
        noise.stop(endTime);
        nodes.push(noise, noiseBP, noiseGain);

        this._scheduleCleanup(nodes, endTime);
    }

    // ─── Pattern Methods ───────────────────────────────────────────────

    setStep(soundName, step, velocity) {
        if (!this.sounds[soundName] || step < 0 || step > 15) return;
        this.patterns[this.currentPattern][soundName][step] = velocity === null ? null : Math.max(0.01, Math.min(1.0, velocity));
    }

    getStep(soundName, step) {
        if (!this.sounds[soundName] || step < 0 || step > 15) return null;
        return this.patterns[this.currentPattern][soundName][step];
    }

    clearPattern() {
        this.patterns[this.currentPattern] = this._createEmptyPattern();
    }

    loadPattern(patternData) {
        const pattern = this._createEmptyPattern();
        for (const soundName of Object.keys(patternData)) {
            if (!this.sounds[soundName]) continue;
            const steps = patternData[soundName];
            if (!steps) continue;
            for (let i = 0; i < 16 && i < steps.length; i++) {
                const step = steps[i];
                if (step && typeof step === 'object' && step.v !== undefined) {
                    pattern[soundName][i] = step.v;
                } else if (typeof step === 'number') {
                    pattern[soundName][i] = step;
                } else {
                    pattern[soundName][i] = null;
                }
            }
        }
        this.patterns[this.currentPattern] = pattern;
    }

    getPattern() {
        return JSON.parse(JSON.stringify(this.patterns[this.currentPattern]));
    }

    selectPattern(index) {
        if (index >= 0 && index < 64) {
            this.currentPattern = index;
        }
    }

    copyPattern(from, to) {
        if (from >= 0 && from < 64 && to >= 0 && to < 64) {
            this.patterns[to] = JSON.parse(JSON.stringify(this.patterns[from]));
        }
    }

    // ─── Sound Parameter Methods ───────────────────────────────────────

    setSoundParam(soundName, param, value) {
        if (this.sounds[soundName] && param in this.sounds[soundName]) {
            this.sounds[soundName][param] = value;
        }
    }

    getSoundNames() {
        return Object.keys(this.sounds);
    }
}
