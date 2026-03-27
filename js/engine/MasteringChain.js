/**
 * NOVA DAW - One-Click AI Mastering Engine
 *
 * Professional mastering signal chain:
 * input → inputGain → EQ(4-band) → stereoWidener → multiband compression → limiter → outputGain → output
 *
 * Provides instant mastering with a single toggle. Includes presets for
 * different mastering styles, approximate LUFS metering, and full
 * parameter control for manual tweaking.
 */

const SMOOTH_TIME = 0.01;
const METER_FFT = 2048;
const LUFS_WINDOW = 0.4;

const PRESETS = {
    balanced: {
        inputGain: 1.0,
        eq: { low: 1.5, lowMid: -1.5, presence: 2.0, air: 1.5 },
        stereoWidth: 1.3,
        comp: {
            low:  { threshold: -18, ratio: 3,   attack: 0.01,  release: 0.2  },
            mid:  { threshold: -15, ratio: 2.5, attack: 0.005, release: 0.15 },
            high: { threshold: -20, ratio: 2,   attack: 0.002, release: 0.1  }
        },
        limiterThreshold: -1,
        outputGain: 1.0
    },
    loud: {
        inputGain: 1.41,
        eq: { low: 2.0, lowMid: -2.0, presence: 2.5, air: 1.0 },
        stereoWidth: 1.2,
        comp: {
            low:  { threshold: -14, ratio: 4,   attack: 0.008, release: 0.15 },
            mid:  { threshold: -12, ratio: 3.5, attack: 0.003, release: 0.1  },
            high: { threshold: -16, ratio: 3,   attack: 0.002, release: 0.08 }
        },
        limiterThreshold: -0.5,
        outputGain: 1.1
    },
    warm: {
        inputGain: 1.0,
        eq: { low: 3.0, lowMid: -1.0, presence: 1.0, air: -0.5 },
        stereoWidth: 1.15,
        comp: {
            low:  { threshold: -16, ratio: 2.5, attack: 0.012, release: 0.25 },
            mid:  { threshold: -14, ratio: 2,   attack: 0.008, release: 0.2  },
            high: { threshold: -22, ratio: 1.8, attack: 0.003, release: 0.12 }
        },
        limiterThreshold: -1,
        outputGain: 1.0
    },
    bright: {
        inputGain: 1.0,
        eq: { low: 0.5, lowMid: -1.0, presence: 3.5, air: 3.0 },
        stereoWidth: 1.4,
        comp: {
            low:  { threshold: -20, ratio: 2,   attack: 0.01,  release: 0.2  },
            mid:  { threshold: -18, ratio: 2,   attack: 0.005, release: 0.15 },
            high: { threshold: -16, ratio: 1.8, attack: 0.002, release: 0.1  }
        },
        limiterThreshold: -1,
        outputGain: 1.0
    },
    radio: {
        inputGain: 1.58,
        eq: { low: 1.0, lowMid: -4.0, presence: 3.0, air: 2.0 },
        stereoWidth: 1.1,
        comp: {
            low:  { threshold: -12, ratio: 5,   attack: 0.005, release: 0.1  },
            mid:  { threshold: -10, ratio: 4,   attack: 0.003, release: 0.08 },
            high: { threshold: -14, ratio: 3.5, attack: 0.002, release: 0.06 }
        },
        limiterThreshold: -0.3,
        outputGain: 1.2
    }
};

export default class MasteringChain {
    constructor(audioContext) {
        this.ctx = audioContext;
        this._enabled = false;
        this._sourceNode = null;
        this._destNode = null;

        this._buildChain();
    }

    // ── Signal chain construction ──────────────────────────────────────

    _buildChain() {
        const ctx = this.ctx;

        // Input / output gain stages
        this.inputGain = ctx.createGain();
        this.outputGain = ctx.createGain();

        // 4-band mastering EQ
        this.eqLow = ctx.createBiquadFilter();
        this.eqLow.type = 'lowshelf';
        this.eqLow.frequency.value = 120;
        this.eqLow.gain.value = 1.5;

        this.eqLowMid = ctx.createBiquadFilter();
        this.eqLowMid.type = 'peaking';
        this.eqLowMid.frequency.value = 400;
        this.eqLowMid.Q.value = 0.7;
        this.eqLowMid.gain.value = -1.5;

        this.eqHighMid = ctx.createBiquadFilter();
        this.eqHighMid.type = 'peaking';
        this.eqHighMid.frequency.value = 3500;
        this.eqHighMid.Q.value = 0.8;
        this.eqHighMid.gain.value = 2.0;

        this.eqAir = ctx.createBiquadFilter();
        this.eqAir.type = 'highshelf';
        this.eqAir.frequency.value = 12000;
        this.eqAir.gain.value = 1.5;

        // Stereo widener
        this._buildStereoWidener();

        // Multiband compression
        this._buildMultibandCompressor();

        // Brickwall limiter
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -1;
        this.limiter.ratio.value = 20;
        this.limiter.knee.value = 0;
        this.limiter.attack.value = 0.001;
        this.limiter.release.value = 0.05;

        // Metering
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = METER_FFT;
        this._meterBuf = new Float32Array(this.analyser.fftSize);

        // K-weighting filter for LUFS approximation
        this._kFilter = ctx.createBiquadFilter();
        this._kFilter.type = 'highshelf';
        this._kFilter.frequency.value = 1500;
        this._kFilter.gain.value = 4;

        // Wire the main chain
        this.inputGain.connect(this.eqLow);
        this.eqLow.connect(this.eqLowMid);
        this.eqLowMid.connect(this.eqHighMid);
        this.eqHighMid.connect(this.eqAir);
        this.eqAir.connect(this._widenerInput);
        this._widenerOutput.connect(this._mbInput);
        this._mbOutput.connect(this.limiter);
        this.limiter.connect(this.outputGain);
        this.outputGain.connect(this._kFilter);
        this._kFilter.connect(this.analyser);
    }

    _buildStereoWidener() {
        const ctx = this.ctx;

        this._splitter = ctx.createChannelSplitter(2);
        this._merger = ctx.createChannelMerger(2);

        // Mid = (L + R) / 2
        const midGainL = ctx.createGain();
        midGainL.gain.value = 0.5;
        const midGainR = ctx.createGain();
        midGainR.gain.value = 0.5;
        this._midSum = ctx.createGain();

        // Side = (L - R) / 2
        const sideGainL = ctx.createGain();
        sideGainL.gain.value = 0.5;
        const sideGainR = ctx.createGain();
        sideGainR.gain.value = -0.5;
        this._sideSum = ctx.createGain();

        // Highpass on side channel — only widen above ~200Hz
        this._sideHP = ctx.createBiquadFilter();
        this._sideHP.type = 'highpass';
        this._sideHP.frequency.value = 200;
        this._sideHP.Q.value = 0.7;

        // Side width control
        this._sideGain = ctx.createGain();
        this._sideGain.gain.value = 1.3;

        // Decode: L = Mid + Side, R = Mid - Side
        this._decodeL_mid = ctx.createGain();
        this._decodeL_mid.gain.value = 1;
        this._decodeL_side = ctx.createGain();
        this._decodeL_side.gain.value = 1;
        this._decodeR_mid = ctx.createGain();
        this._decodeR_mid.gain.value = 1;
        this._decodeR_side = ctx.createGain();
        this._decodeR_side.gain.value = -1;

        // Routing: split → encode → process → decode → merge
        this._splitter.connect(midGainL, 0);
        this._splitter.connect(midGainR, 1);
        midGainL.connect(this._midSum);
        midGainR.connect(this._midSum);

        this._splitter.connect(sideGainL, 0);
        this._splitter.connect(sideGainR, 1);
        sideGainL.connect(this._sideSum);
        sideGainR.connect(this._sideSum);

        this._sideSum.connect(this._sideHP);
        this._sideHP.connect(this._sideGain);

        // Decode to L
        this._midSum.connect(this._decodeL_mid);
        this._sideGain.connect(this._decodeL_side);
        this._decodeL_mid.connect(this._merger, 0, 0);
        this._decodeL_side.connect(this._merger, 0, 0);

        // Decode to R
        this._midSum.connect(this._decodeR_mid);
        this._sideGain.connect(this._decodeR_side);
        this._decodeR_mid.connect(this._merger, 0, 1);
        this._decodeR_side.connect(this._merger, 0, 1);

        // Expose entry/exit points
        this._widenerInput = this._splitter;
        this._widenerOutput = this._merger;
    }

    _buildMultibandCompressor() {
        const ctx = this.ctx;

        // Crossover filters split into 3 bands
        // Low: lowpass at 200Hz
        this._xLowLP = ctx.createBiquadFilter();
        this._xLowLP.type = 'lowpass';
        this._xLowLP.frequency.value = 200;
        this._xLowLP.Q.value = 0.7;

        // Mid: bandpass 200-4000Hz (highpass 200 + lowpass 4000)
        this._xMidHP = ctx.createBiquadFilter();
        this._xMidHP.type = 'highpass';
        this._xMidHP.frequency.value = 200;
        this._xMidHP.Q.value = 0.7;
        this._xMidLP = ctx.createBiquadFilter();
        this._xMidLP.type = 'lowpass';
        this._xMidLP.frequency.value = 4000;
        this._xMidLP.Q.value = 0.7;

        // High: highpass at 4000Hz
        this._xHighHP = ctx.createBiquadFilter();
        this._xHighHP.type = 'highpass';
        this._xHighHP.frequency.value = 4000;
        this._xHighHP.Q.value = 0.7;

        // Compressors
        this.compLow = ctx.createDynamicsCompressor();
        this.compLow.threshold.value = -18;
        this.compLow.ratio.value = 3;
        this.compLow.attack.value = 0.01;
        this.compLow.release.value = 0.2;

        this.compMid = ctx.createDynamicsCompressor();
        this.compMid.threshold.value = -15;
        this.compMid.ratio.value = 2.5;
        this.compMid.attack.value = 0.005;
        this.compMid.release.value = 0.15;

        this.compHigh = ctx.createDynamicsCompressor();
        this.compHigh.threshold.value = -20;
        this.compHigh.ratio.value = 2;
        this.compHigh.attack.value = 0.002;
        this.compHigh.release.value = 0.1;

        // Summing node after compression
        this._mbSum = ctx.createGain();

        // Entry point for multiband section
        this._mbInput = ctx.createGain();

        // Wire: input → crossover → compressors → sum
        this._mbInput.connect(this._xLowLP);
        this._mbInput.connect(this._xMidHP);
        this._mbInput.connect(this._xHighHP);

        this._xLowLP.connect(this.compLow);
        this._xMidHP.connect(this._xMidLP);
        this._xMidLP.connect(this.compMid);
        this._xHighHP.connect(this.compHigh);

        this.compLow.connect(this._mbSum);
        this.compMid.connect(this._mbSum);
        this.compHigh.connect(this._mbSum);

        this._mbOutput = this._mbSum;
    }

    // ── Public API ─────────────────────────────────────────────────────

    connectChain(inputNode, outputNode) {
        this._sourceNode = inputNode;
        this._destNode = outputNode;

        if (this._enabled) {
            this._insertChain();
        } else {
            inputNode.connect(outputNode);
        }
    }

    disconnectChain() {
        try {
            if (this._sourceNode) {
                this._sourceNode.disconnect();
            }
        } catch (_) { /* already disconnected */ }
        this._sourceNode = null;
        this._destNode = null;
        this._enabled = false;
    }

    enable() {
        if (this._enabled) return;
        this._enabled = true;

        if (this._sourceNode && this._destNode) {
            try { this._sourceNode.disconnect(this._destNode); } catch (_) {}
            this._insertChain();
        }
    }

    disable() {
        if (!this._enabled) return;
        this._enabled = false;

        if (this._sourceNode && this._destNode) {
            try { this._sourceNode.disconnect(this.inputGain); } catch (_) {}
            try { this.outputGain.disconnect(this._destNode); } catch (_) {}
            this._sourceNode.connect(this._destNode);
        }
    }

    isEnabled() {
        return this._enabled;
    }

    setPreset(name) {
        const p = PRESETS[name];
        if (!p) return;

        const t = this.ctx.currentTime;

        this.inputGain.gain.setTargetAtTime(p.inputGain, t, SMOOTH_TIME);
        this.outputGain.gain.setTargetAtTime(p.outputGain, t, SMOOTH_TIME);

        this.eqLow.gain.setTargetAtTime(p.eq.low, t, SMOOTH_TIME);
        this.eqLowMid.gain.setTargetAtTime(p.eq.lowMid, t, SMOOTH_TIME);
        this.eqHighMid.gain.setTargetAtTime(p.eq.presence, t, SMOOTH_TIME);
        this.eqAir.gain.setTargetAtTime(p.eq.air, t, SMOOTH_TIME);

        this._sideGain.gain.setTargetAtTime(p.stereoWidth, t, SMOOTH_TIME);

        this._applyComp(this.compLow, p.comp.low);
        this._applyComp(this.compMid, p.comp.mid);
        this._applyComp(this.compHigh, p.comp.high);

        this.limiter.threshold.setTargetAtTime(p.limiterThreshold, t, SMOOTH_TIME);
    }

    setParam(param, value) {
        const t = this.ctx.currentTime;

        const actions = {
            inputGain:        () => this.inputGain.gain.setTargetAtTime(value, t, SMOOTH_TIME),
            outputGain:       () => this.outputGain.gain.setTargetAtTime(value, t, SMOOTH_TIME),
            stereoWidth:      () => this._sideGain.gain.setTargetAtTime(value, t, SMOOTH_TIME),
            limiterThreshold: () => this.limiter.threshold.setTargetAtTime(value, t, SMOOTH_TIME),
            eqLow:            () => this.eqLow.gain.setTargetAtTime(value, t, SMOOTH_TIME),
            eqLowMid:         () => this.eqLowMid.gain.setTargetAtTime(value, t, SMOOTH_TIME),
            eqPresence:       () => this.eqHighMid.gain.setTargetAtTime(value, t, SMOOTH_TIME),
            eqAir:            () => this.eqAir.gain.setTargetAtTime(value, t, SMOOTH_TIME)
        };

        if (actions[param]) actions[param]();
    }

    getLevel() {
        this.analyser.getFloatTimeDomainData(this._meterBuf);

        const len = this._meterBuf.length;
        const windowSize = Math.floor(this.ctx.sampleRate * LUFS_WINDOW);
        const start = Math.max(0, len - windowSize);

        let sumSq = 0;
        let peak = 0;

        for (let i = start; i < len; i++) {
            const s = this._meterBuf[i];
            sumSq += s * s;
            const abs = Math.abs(s);
            if (abs > peak) peak = abs;
        }

        const rms = Math.sqrt(sumSq / (len - start));
        const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
        const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;

        // Approximate LUFS: K-weighted RMS with -0.691 offset (EBU R128 constant)
        const lufs = rms > 0 ? 10 * Math.log10(rms * rms) - 0.691 : -Infinity;

        return { rms: rmsDb, peak: peakDb, lufs };
    }

    dispose() {
        this.disable();
        this.disconnectChain();

        const nodes = [
            this.inputGain, this.outputGain, this.eqLow, this.eqLowMid,
            this.eqHighMid, this.eqAir, this.limiter, this.analyser,
            this._kFilter, this._splitter, this._merger, this._midSum,
            this._sideSum, this._sideHP, this._sideGain,
            this._decodeL_mid, this._decodeL_side, this._decodeR_mid, this._decodeR_side,
            this._mbInput, this._mbSum, this._xLowLP, this._xMidHP, this._xMidLP,
            this._xHighHP, this.compLow, this.compMid, this.compHigh
        ];

        for (const node of nodes) {
            try { node.disconnect(); } catch (_) {}
        }
    }

    // ── Private helpers ────────────────────────────────────────────────

    _insertChain() {
        this._sourceNode.connect(this.inputGain);
        this.outputGain.connect(this._destNode);
    }

    _applyComp(comp, settings) {
        const t = this.ctx.currentTime;
        comp.threshold.setTargetAtTime(settings.threshold, t, SMOOTH_TIME);
        comp.ratio.setTargetAtTime(settings.ratio, t, SMOOTH_TIME);
        comp.attack.setTargetAtTime(settings.attack, t, SMOOTH_TIME);
        comp.release.setTargetAtTime(settings.release, t, SMOOTH_TIME);
    }
}
