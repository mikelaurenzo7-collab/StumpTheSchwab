export default class SpectrumAnalyzer {
    constructor(container) {
        this.container = container;
        this._analyser = null;
        this._animFrame = null;
        this._freqData = null;
        this._timeData = null;
        this._smoothedBars = new Float32Array(64);
        this._peaks = new Float32Array(64);
        this._peakDecay = new Float32Array(64);
        this._colorScheme = 'default';
        this._dpr = window.devicePixelRatio || 1;

        this._COLOR_SCHEMES = {
            default: {
                sub:  '#ff3366',
                low:  '#ffaa00',
                mid:  '#00ff88',
                high: '#00d4ff'
            },
            neon: {
                sub:  '#ff00ff',
                low:  '#ff4400',
                mid:  '#44ff00',
                high: '#00ffff'
            },
            monochrome: {
                sub:  '#aaaaaa',
                low:  '#cccccc',
                mid:  '#dddddd',
                high: '#ffffff'
            }
        };

        this._FREQ_LABELS = [
            { freq: 50,    label: '50' },
            { freq: 100,   label: '100' },
            { freq: 250,   label: '250' },
            { freq: 500,   label: '500' },
            { freq: 1000,  label: '1k' },
            { freq: 2000,  label: '2k' },
            { freq: 5000,  label: '5k' },
            { freq: 10000, label: '10k' },
            { freq: 20000, label: '20k' }
        ];

        this._buildDOM();
        this._injectStyles();
        this.resize();

        this._resizeObserver = new ResizeObserver(() => this.resize());
        this._resizeObserver.observe(this.container);
    }

    _buildDOM() {
        this._wrapper = document.createElement('div');
        this._wrapper.className = 'spectrum-analyzer-wrapper';

        // Spectrum canvas (top 60%)
        this._spectrumCanvas = document.createElement('canvas');
        this._spectrumCanvas.className = 'spectrum-canvas';
        this._wrapper.appendChild(this._spectrumCanvas);

        // Waveform canvas (bottom 40%)
        this._waveformCanvas = document.createElement('canvas');
        this._waveformCanvas.className = 'waveform-canvas';
        this._wrapper.appendChild(this._waveformCanvas);

        this.container.appendChild(this._wrapper);

        this._specCtx = this._spectrumCanvas.getContext('2d');
        this._waveCtx = this._waveformCanvas.getContext('2d');
    }

    _injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .spectrum-analyzer-wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                background: #0a0a0f;
                border: 1px solid #1a1a2e;
                box-sizing: border-box;
                overflow: hidden;
            }
            .spectrum-canvas {
                width: 100%;
                height: 60%;
                display: block;
            }
            .waveform-canvas {
                width: 100%;
                height: 40%;
                display: block;
            }
        `;
        this.container.appendChild(style);
    }

    resize() {
        const dpr = this._dpr;
        const wrapRect = this._wrapper.getBoundingClientRect();

        const specH = Math.floor(wrapRect.height * 0.6);
        const waveH = Math.floor(wrapRect.height * 0.4);
        const w = Math.floor(wrapRect.width);

        this._spectrumCanvas.width = w * dpr;
        this._spectrumCanvas.height = specH * dpr;
        this._spectrumCanvas.style.width = w + 'px';
        this._spectrumCanvas.style.height = specH + 'px';

        this._waveformCanvas.width = w * dpr;
        this._waveformCanvas.height = waveH * dpr;
        this._waveformCanvas.style.width = w + 'px';
        this._waveformCanvas.style.height = waveH + 'px';

        this._specW = w;
        this._specH = specH;
        this._waveW = w;
        this._waveH = waveH;
    }

    connectAnalyser(analyserNode) {
        this._analyser = analyserNode;
        this._analyser.fftSize = 2048;
        this._analyser.smoothingTimeConstant = 0.8;
        this._freqData = new Uint8Array(this._analyser.frequencyBinCount);
        this._timeData = new Uint8Array(this._analyser.fftSize);
        this._smoothedBars.fill(0);
        this._peaks.fill(0);
        this._peakDecay.fill(0);
        this._lastTime = performance.now();
        this._startRendering();
    }

    disconnect() {
        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }
        this._analyser = null;
    }

    setColorScheme(scheme) {
        if (this._COLOR_SCHEMES[scheme]) {
            this._colorScheme = scheme;
        }
    }

    _startRendering() {
        if (this._animFrame) return;
        const loop = () => {
            this._animFrame = requestAnimationFrame(loop);
            this._render();
        };
        loop();
    }

    _render() {
        if (!this._analyser) return;

        const now = performance.now();
        const dt = (now - this._lastTime) / 1000;
        this._lastTime = now;

        this._analyser.getByteFrequencyData(this._freqData);
        this._analyser.getByteTimeDomainData(this._timeData);

        this._renderSpectrum(dt);
        this._renderWaveform();
    }

    _freqToBin(freq) {
        const nyquist = this._analyser.context.sampleRate / 2;
        return Math.round((freq / nyquist) * this._analyser.frequencyBinCount);
    }

    _getBarColor(freq) {
        const colors = this._COLOR_SCHEMES[this._colorScheme];
        if (freq < 250)  return colors.sub;
        if (freq < 2000) return colors.low;
        if (freq < 6000) return colors.mid;
        return colors.high;
    }

    _renderSpectrum(dt) {
        const ctx = this._specCtx;
        const dpr = this._dpr;
        const w = this._specW;
        const h = this._specH;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);

        const numBands = 64;
        const padding = 2;
        const labelHeight = 18;
        const barAreaH = (h - labelHeight) * 0.6;
        const reflectionH = (h - labelHeight) * 0.35;
        const barW = (w - padding * (numBands + 1)) / numBands;

        const minFreq = 20;
        const maxFreq = 20000;
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);

        // Decay rate for peaks: ~3dB/sec mapped to 0-255 range
        const peakDecayRate = 40 * dt;

        for (let i = 0; i < numBands; i++) {
            const logLow = logMin + (i / numBands) * (logMax - logMin);
            const logHigh = logMin + ((i + 1) / numBands) * (logMax - logMin);
            const freqLow = Math.pow(10, logLow);
            const freqHigh = Math.pow(10, logHigh);
            const centerFreq = Math.pow(10, (logLow + logHigh) / 2);

            const binLow = Math.max(0, this._freqToBin(freqLow));
            const binHigh = Math.min(this._freqData.length - 1, this._freqToBin(freqHigh));

            let maxVal = 0;
            for (let b = binLow; b <= binHigh; b++) {
                if (this._freqData[b] > maxVal) maxVal = this._freqData[b];
            }

            // Smooth falloff
            const newVal = maxVal / 255;
            this._smoothedBars[i] = Math.max(this._smoothedBars[i] * 0.92, newVal);

            // Peak hold and decay
            if (this._smoothedBars[i] > this._peaks[i]) {
                this._peaks[i] = this._smoothedBars[i];
            } else {
                this._peaks[i] = Math.max(0, this._peaks[i] - (peakDecayRate / 255));
            }

            const barVal = this._smoothedBars[i];
            const barHeight = barVal * barAreaH;
            const x = padding + i * (barW + padding);
            const y = barAreaH - barHeight;

            // Bar gradient
            const color = this._getBarColor(centerFreq);
            const grad = ctx.createLinearGradient(x, barAreaH, x, y);
            grad.addColorStop(0, color);
            grad.addColorStop(1, color + '88');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barW, barHeight);

            // Peak indicator
            const peakY = barAreaH - this._peaks[i] * barAreaH;
            ctx.fillStyle = color;
            ctx.fillRect(x, peakY - 2, barW, 2);

            // Mirror reflection
            ctx.save();
            ctx.globalAlpha = 0.3;
            const refGrad = ctx.createLinearGradient(x, barAreaH, x, barAreaH + reflectionH);
            refGrad.addColorStop(0, color);
            refGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = refGrad;
            const reflHeight = Math.min(barHeight, reflectionH);
            ctx.fillRect(x, barAreaH, barW, reflHeight);
            ctx.restore();
        }

        // Frequency labels
        ctx.fillStyle = '#555566';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        for (const fl of this._FREQ_LABELS) {
            const logPos = (Math.log10(fl.freq) - logMin) / (logMax - logMin);
            const x = padding + logPos * (w - 2 * padding);
            ctx.fillText(fl.label, x, h - 4);
        }
    }

    _renderWaveform() {
        const ctx = this._waveCtx;
        const dpr = this._dpr;
        const w = this._waveW;
        const h = this._waveH;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);

        // Center reference line
        ctx.strokeStyle = '#222233';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Waveform
        const bufferLength = this._timeData.length;
        const sliceWidth = w / bufferLength;

        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();

        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = this._timeData[i] / 128.0;
            const y = (v * h) / 2;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        ctx.stroke();
    }
}
