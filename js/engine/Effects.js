/**
 * NOVA DAW - Professional Effects Processor
 *
 * Full effects chain with per-effect bypass and wet/dry mix:
 * EQ -> Distortion -> Chorus -> Delay -> Reverb -> Compressor
 *
 * Includes algorithmic Schroeder reverb, stereo ping-pong delay,
 * waveshaper distortion with multiple curve types, modulated chorus,
 * parametric 3-band EQ, and dynamics compressor with makeup gain.
 */

const SAMPLE_RATE = 44100;

const COMB_DELAYS = [1557, 1617, 1491, 1422];
const ALLPASS_DELAYS = [225, 556];

const DIVISION_MULTIPLIERS = {
    '1/4':  1.0,
    '1/8':  0.5,
    '1/16': 0.25,
    '1/8d': 0.75,
    '1/8t': 1 / 3
};

const CURVE_SAMPLES = 44100;

class Effects {
    constructor(audioContext) {
        this.audioContext = audioContext;

        this.input = audioContext.createGain();
        this.output = audioContext.createGain();

        this.params = {
            reverb:     { roomSize: 0.5, damping: 0.5, wetDry: 0, preDelay: 0.01, bypass: true },
            delay:      { time: 0.375, feedback: 0.3, pingPong: true, wetDry: 0, sync: true, division: '1/8', bypass: true },
            distortion: { amount: 0, type: 'soft', wetDry: 0, bypass: true },
            chorus:     { rate: 1.5, depth: 0.5, wetDry: 0, bypass: true },
            compressor: { threshold: -12, ratio: 4, knee: 10, attack: 0.01, release: 0.15, makeupGain: 0, bypass: false },
            eq: {
                low:  { frequency: 200,  gain: 0, Q: 1 },
                mid:  { frequency: 1000, gain: 0, Q: 1 },
                high: { frequency: 5000, gain: 0, Q: 1 },
                bypass: true
            }
        };

        this._bpm = 120;

        this._effects = {};
        this._createEQ();
        this._createDistortion();
        this._createChorus();
        this._createDelay();
        this._createReverb();
        this._createCompressor();

        this._connectChain();
    }

    // ----------------------------------------------------------------
    //  Parametric EQ (3-band)
    // ----------------------------------------------------------------

    _createEQ() {
        const ctx = this.audioContext;

        const low = ctx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = this.params.eq.low.frequency;
        low.gain.value = this.params.eq.low.gain;

        const mid = ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = this.params.eq.mid.frequency;
        mid.gain.value = this.params.eq.mid.gain;
        mid.Q.value = this.params.eq.mid.Q;

        const high = ctx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = this.params.eq.high.frequency;
        high.gain.value = this.params.eq.high.gain;

        low.connect(mid);
        mid.connect(high);

        const dry = ctx.createGain();
        dry.gain.value = 1;

        this._effects.eq = {
            input:  low,
            output: high,
            dry,
            bands: { low, mid, high }
        };
    }

    setEQParam(band, param, value) {
        const bandNode = this._effects.eq.bands[band];
        if (!bandNode) return;

        if (param === 'frequency') {
            bandNode.frequency.value = value;
        } else if (param === 'gain') {
            bandNode.gain.value = value;
        } else if (param === 'Q') {
            bandNode.Q.value = value;
        }

        if (this.params.eq[band]) {
            this.params.eq[band][param] = value;
        }
    }

    // ----------------------------------------------------------------
    //  Distortion (waveshaper with multiple curve types)
    // ----------------------------------------------------------------

    _createDistortion() {
        const ctx = this.audioContext;

        const preGain = ctx.createGain();
        preGain.gain.value = 1;

        const shaper = ctx.createWaveShaper();
        shaper.oversample = '4x';
        shaper.curve = this._makeDistortionCurve(
            this.params.distortion.amount,
            this.params.distortion.type
        );

        const postGain = ctx.createGain();
        postGain.gain.value = 1;

        const wet = ctx.createGain();
        wet.gain.value = this.params.distortion.wetDry;

        const dry = ctx.createGain();
        dry.gain.value = 1 - this.params.distortion.wetDry;

        const merger = ctx.createGain();

        preGain.connect(shaper);
        shaper.connect(postGain);
        postGain.connect(wet);
        wet.connect(merger);

        preGain.connect(dry);
        dry.connect(merger);

        this._effects.distortion = {
            input:  preGain,
            output: merger,
            dry,
            preGain,
            shaper,
            postGain,
            wet,
            merger
        };
    }

    _makeDistortionCurve(amount, type) {
        const curve = new Float32Array(CURVE_SAMPLES);
        const half = (CURVE_SAMPLES - 1) / 2;

        for (let i = 0; i < CURVE_SAMPLES; i++) {
            const x = (i - half) / half; // -1 to 1

            switch (type) {
                case 'hard':
                    curve[i] = Math.max(-1, Math.min(1, x * (1 + amount * 20)));
                    break;

                case 'tube': {
                    const drive = 1 + amount * 10;
                    if (x >= 0) {
                        curve[i] = Math.tanh(x * drive * 0.8);
                    } else {
                        curve[i] = Math.tanh(x * drive * 1.2);
                    }
                    break;
                }

                case 'fuzz': {
                    const exp = 1 / (1 + amount * 5);
                    curve[i] = Math.sign(x) * Math.pow(Math.abs(x), exp);
                    break;
                }

                case 'soft':
                default:
                    curve[i] = Math.tanh(x * (1 + amount * 10));
                    break;
            }
        }

        return curve;
    }

    setDistortionParam(param, value) {
        this.params.distortion[param] = value;
        const fx = this._effects.distortion;

        switch (param) {
            case 'amount':
            case 'type':
                fx.shaper.curve = this._makeDistortionCurve(
                    this.params.distortion.amount,
                    this.params.distortion.type
                );
                // Volume compensation: reduce post-gain as drive increases
                fx.postGain.gain.value = 1 / (1 + this.params.distortion.amount * 2);
                break;

            case 'wetDry':
                fx.wet.gain.value = value;
                fx.dry.gain.value = 1 - value;
                break;
        }
    }

    // ----------------------------------------------------------------
    //  Chorus (modulated delay line with LFO)
    // ----------------------------------------------------------------

    _createChorus() {
        const ctx = this.audioContext;

        const inputGain = ctx.createGain();

        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = 0.007; // 7ms base

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = this.params.chorus.rate;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = this.params.chorus.depth * 0.003; // depth scaled to 0-3ms

        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start();

        const wet = ctx.createGain();
        wet.gain.value = this.params.chorus.wetDry;

        const dry = ctx.createGain();
        dry.gain.value = 1 - this.params.chorus.wetDry;

        const merger = ctx.createGain();

        inputGain.connect(delay);
        delay.connect(wet);
        wet.connect(merger);

        inputGain.connect(dry);
        dry.connect(merger);

        this._effects.chorus = {
            input:  inputGain,
            output: merger,
            dry,
            delay,
            lfo,
            lfoGain,
            wet,
            merger
        };
    }

    setChorusParam(param, value) {
        this.params.chorus[param] = value;
        const fx = this._effects.chorus;

        switch (param) {
            case 'rate':
                fx.lfo.frequency.value = Math.max(0.1, Math.min(10, value));
                break;

            case 'depth':
                fx.lfoGain.gain.value = Math.max(0, Math.min(1, value)) * 0.003;
                break;

            case 'wetDry':
                fx.wet.gain.value = value;
                fx.dry.gain.value = 1 - value;
                break;
        }
    }

    // ----------------------------------------------------------------
    //  Stereo Delay (with ping-pong cross-feed)
    // ----------------------------------------------------------------

    _createDelay() {
        const ctx = this.audioContext;

        const inputGain = ctx.createGain();

        const delayL = ctx.createDelay(2.0);
        delayL.delayTime.value = this.params.delay.time;

        const delayR = ctx.createDelay(2.0);
        delayR.delayTime.value = this.params.delay.time;

        const feedbackL = ctx.createGain();
        feedbackL.gain.value = this.params.delay.feedback;

        const feedbackR = ctx.createGain();
        feedbackR.gain.value = this.params.delay.feedback;

        // Standard feedback loops
        delayL.connect(feedbackL);
        delayR.connect(feedbackR);

        // Cross-feed for ping-pong
        const crossL = ctx.createGain();
        const crossR = ctx.createGain();

        if (this.params.delay.pingPong) {
            crossL.gain.value = 1;
            crossR.gain.value = 1;
            feedbackL.connect(crossL);
            crossL.connect(delayR);
            feedbackR.connect(crossR);
            crossR.connect(delayL);
        } else {
            crossL.gain.value = 0;
            crossR.gain.value = 0;
            feedbackL.connect(delayL);
            feedbackR.connect(delayR);
        }

        inputGain.connect(delayL);
        inputGain.connect(delayR);

        const wet = ctx.createGain();
        wet.gain.value = this.params.delay.wetDry;

        const dry = ctx.createGain();
        dry.gain.value = 1 - this.params.delay.wetDry;

        const merger = ctx.createGain();

        delayL.connect(wet);
        delayR.connect(wet);
        wet.connect(merger);

        inputGain.connect(dry);
        dry.connect(merger);

        this._effects.delay = {
            input:  inputGain,
            output: merger,
            dry,
            delayL,
            delayR,
            feedbackL,
            feedbackR,
            crossL,
            crossR,
            wet,
            merger
        };
    }

    setDelayParam(param, value) {
        this.params.delay[param] = value;
        const fx = this._effects.delay;

        switch (param) {
            case 'time':
                fx.delayL.delayTime.value = value;
                fx.delayR.delayTime.value = value;
                break;

            case 'feedback':
                value = Math.min(0.9, value);
                this.params.delay.feedback = value;
                fx.feedbackL.gain.value = value;
                fx.feedbackR.gain.value = value;
                break;

            case 'wetDry':
                fx.wet.gain.value = value;
                fx.dry.gain.value = 1 - value;
                break;

            case 'sync':
            case 'division':
                if (this.params.delay.sync) {
                    this.syncDelayToBPM(this._bpm);
                }
                break;

            case 'pingPong':
                this._rebuildDelay();
                break;
        }
    }

    syncDelayToBPM(bpm) {
        this._bpm = bpm;
        if (!this.params.delay.sync) return;

        const quarterNote = 60 / bpm;
        const mult = DIVISION_MULTIPLIERS[this.params.delay.division] || 0.5;
        const time = quarterNote * mult;

        this.params.delay.time = time;

        const fx = this._effects.delay;
        fx.delayL.delayTime.value = time;
        fx.delayR.delayTime.value = time;
    }

    _rebuildDelay() {
        const fx = this._effects.delay;

        // Disconnect current feedback routing
        fx.feedbackL.disconnect();
        fx.feedbackR.disconnect();
        fx.crossL.disconnect();
        fx.crossR.disconnect();

        if (this.params.delay.pingPong) {
            fx.crossL.gain.value = 1;
            fx.crossR.gain.value = 1;
            fx.feedbackL.connect(fx.crossL);
            fx.crossL.connect(fx.delayR);
            fx.feedbackR.connect(fx.crossR);
            fx.crossR.connect(fx.delayL);
        } else {
            fx.crossL.gain.value = 0;
            fx.crossR.gain.value = 0;
            fx.feedbackL.connect(fx.delayL);
            fx.feedbackR.connect(fx.delayR);
        }
    }

    // ----------------------------------------------------------------
    //  Algorithmic Reverb (Schroeder)
    // ----------------------------------------------------------------

    _createReverb() {
        const ctx = this.audioContext;
        const p = this.params.reverb;

        const inputGain = ctx.createGain();

        // Pre-delay
        const preDelay = ctx.createDelay(0.1);
        preDelay.delayTime.value = p.preDelay;

        inputGain.connect(preDelay);

        // 4 parallel comb filters
        const combMix = ctx.createGain();
        combMix.gain.value = 0.25; // normalize 4 combs

        const combs = COMB_DELAYS.map(delaySamples => {
            const delay = ctx.createDelay(1.0);
            delay.delayTime.value = delaySamples / SAMPLE_RATE;

            const feedback = ctx.createGain();
            feedback.gain.value = this._roomSizeToFeedback(p.roomSize);

            const damping = ctx.createBiquadFilter();
            damping.type = 'lowpass';
            damping.frequency.value = this._dampingToFreq(p.damping);

            // Comb loop: preDelay -> delay -> damping -> feedback -> delay
            preDelay.connect(delay);
            delay.connect(damping);
            damping.connect(feedback);
            feedback.connect(delay);

            delay.connect(combMix);

            return { delay, feedback, damping };
        });

        // 2 allpass filters in series
        const allpasses = ALLPASS_DELAYS.map(delaySamples => {
            const delay = ctx.createDelay(0.1);
            delay.delayTime.value = delaySamples / SAMPLE_RATE;

            const feedbackGain = ctx.createGain();
            feedbackGain.gain.value = 0.5;

            const feedforwardGain = ctx.createGain();
            feedforwardGain.gain.value = -0.5;

            const sumNode = ctx.createGain();

            return { delay, feedbackGain, feedforwardGain, sumNode };
        });

        // Wire allpass chain: combMix -> allpass1 -> allpass2
        // Allpass structure per stage:
        //   input -> (+) -> delay -> output
        //               \-> feedforward -> output
        //   delay -> feedback -> (+)
        //
        // Simplified with Web Audio: input -> delay -> output, with gain taps
        let apInput = combMix;

        allpasses.forEach(ap => {
            const apIn = ctx.createGain();
            apInput.connect(apIn);

            // Feedforward path: input * -g + delayed
            apIn.connect(ap.feedforwardGain);
            apIn.connect(ap.delay);

            // Feedback from delay output
            ap.delay.connect(ap.feedbackGain);
            ap.feedbackGain.connect(apIn);

            // Sum feedforward + delay to output
            ap.feedforwardGain.connect(ap.sumNode);
            ap.delay.connect(ap.sumNode);

            apInput = ap.sumNode;
        });

        const reverbOut = apInput;

        // Wet/dry mix
        const wet = ctx.createGain();
        wet.gain.value = p.wetDry;

        const dry = ctx.createGain();
        dry.gain.value = 1 - p.wetDry;

        const merger = ctx.createGain();

        reverbOut.connect(wet);
        wet.connect(merger);

        inputGain.connect(dry);
        dry.connect(merger);

        this._effects.reverb = {
            input:  inputGain,
            output: merger,
            dry,
            preDelay,
            combs,
            allpasses,
            wet,
            merger,
            combMix
        };
    }

    _roomSizeToFeedback(roomSize) {
        // Map 0-1 to 0.7-0.95
        return 0.7 + roomSize * 0.25;
    }

    _dampingToFreq(damping) {
        // Map 0-1 to 15000-1000 Hz (inverse)
        return 15000 - damping * 14000;
    }

    setReverbParam(param, value) {
        this.params.reverb[param] = value;
        const fx = this._effects.reverb;

        switch (param) {
            case 'roomSize':
                fx.combs.forEach(c => {
                    c.feedback.gain.value = this._roomSizeToFeedback(value);
                });
                break;

            case 'damping':
                fx.combs.forEach(c => {
                    c.damping.frequency.value = this._dampingToFreq(value);
                });
                break;

            case 'wetDry':
                fx.wet.gain.value = value;
                fx.dry.gain.value = 1 - value;
                break;

            case 'preDelay':
                fx.preDelay.delayTime.value = Math.max(0, Math.min(0.1, value));
                break;
        }
    }

    // ----------------------------------------------------------------
    //  Compressor (dynamics with makeup gain)
    // ----------------------------------------------------------------

    _createCompressor() {
        const ctx = this.audioContext;
        const p = this.params.compressor;

        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = p.threshold;
        comp.ratio.value = p.ratio;
        comp.knee.value = p.knee;
        comp.attack.value = p.attack;
        comp.release.value = p.release;

        const makeupGain = ctx.createGain();
        makeupGain.gain.value = Math.pow(10, p.makeupGain / 20);

        const dry = ctx.createGain();
        dry.gain.value = 1;

        comp.connect(makeupGain);

        this._effects.compressor = {
            input:  comp,
            output: makeupGain,
            dry,
            comp,
            makeupGain
        };
    }

    setCompressorParam(param, value) {
        this.params.compressor[param] = value;
        const fx = this._effects.compressor;

        switch (param) {
            case 'threshold':
                fx.comp.threshold.value = Math.max(-60, Math.min(0, value));
                break;
            case 'ratio':
                fx.comp.ratio.value = Math.max(1, Math.min(20, value));
                break;
            case 'knee':
                fx.comp.knee.value = Math.max(0, Math.min(40, value));
                break;
            case 'attack':
                fx.comp.attack.value = Math.max(0, Math.min(1, value));
                break;
            case 'release':
                fx.comp.release.value = Math.max(0.01, Math.min(1, value));
                break;
            case 'makeupGain':
                fx.makeupGain.gain.value = Math.pow(10, Math.max(0, Math.min(24, value)) / 20);
                break;
        }
    }

    // ----------------------------------------------------------------
    //  Chain Management
    // ----------------------------------------------------------------

    _connectChain() {
        const order = ['eq', 'distortion', 'chorus', 'delay', 'reverb', 'compressor'];

        // Disconnect everything first
        this.input.disconnect();
        order.forEach(name => {
            const fx = this._effects[name];
            if (fx.output) fx.output.disconnect();
        });

        let source = this.input;

        order.forEach(name => {
            const fx = this._effects[name];
            const bypassed = name === 'eq'
                ? this.params.eq.bypass
                : this.params[name] && this.params[name].bypass;

            if (bypassed) {
                source.connect(fx.output);
                // Dry path: skip processing
                fx._bypassNode = source;
            } else {
                source.connect(fx.input);
            }

            source = fx.output;
        });

        source.connect(this.output);
    }

    connectChain(inputNode, outputNode) {
        if (inputNode) {
            inputNode.connect(this.input);
        }
        if (outputNode) {
            this.output.connect(outputNode);
        }
    }

    setBypass(effectName, bypassed) {
        if (effectName === 'eq') {
            this.params.eq.bypass = bypassed;
        } else if (this.params[effectName]) {
            this.params[effectName].bypass = bypassed;
        }

        this._connectChain();
    }

    getEffectParams(effectName) {
        if (effectName === 'eq') {
            return { ...this.params.eq };
        }
        return this.params[effectName] ? { ...this.params[effectName] } : null;
    }

    getAllParams() {
        return JSON.parse(JSON.stringify(this.params));
    }

    dispose() {
        // Stop oscillators
        try {
            if (this._effects.chorus && this._effects.chorus.lfo) {
                this._effects.chorus.lfo.stop();
            }
        } catch (_) {
            // Already stopped
        }

        // Disconnect all nodes
        const disconnect = (node) => {
            try {
                if (node && typeof node.disconnect === 'function') {
                    node.disconnect();
                }
            } catch (_) {
                // Already disconnected
            }
        };

        disconnect(this.input);
        disconnect(this.output);

        Object.values(this._effects).forEach(fx => {
            Object.values(fx).forEach(node => {
                if (node && node.disconnect) {
                    disconnect(node);
                } else if (Array.isArray(node)) {
                    node.forEach(item => {
                        if (item && typeof item === 'object') {
                            Object.values(item).forEach(disconnect);
                        }
                    });
                }
            });
        });

        this._effects = {};
    }
}

export default Effects;
