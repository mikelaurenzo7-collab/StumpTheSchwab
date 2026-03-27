export default class SynthPanel {
    constructor(container) {
        this.container = container;
        this.params = {
            osc1: { type: 'sine', octave: 0, detune: 0, gain: 0.8 },
            osc2: { type: 'sine', octave: 0, detune: 0, gain: 0 },
            filter: { type: 'lowpass', frequency: 2000, Q: 1 },
            filterEnv: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3, amount: 3000 },
            ampEnv: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.3 },
            lfo: { type: 'sine', rate: 0, depth: 0, destination: 'none' },
            glide: 0
        };
        this._onParamChange = null;
        this._onPresetChange = null;
        this._knobStates = new Map();
        this._analyser = null;
        this._scopeData = null;
        this._scopeFrame = null;

        this._buildDOM();
        this._initAllKnobs();
        this._initWaveformSelectors();
        this._initFilterTypeSelector();
        this._initEnvelopeSliders();
        this._initLFODestSelector();
        this._initPresetNav();
        this._initOscilloscopeCanvas();
    }

    // ── DOM Construction ────────────────────────────────────────────

    _buildDOM() {
        const root = document.createElement('div');
        root.className = 'synth-container';

        root.innerHTML = `
            ${this._presetSection()}
            ${this._scopeSection()}
            ${this._oscSection('OSC 1', 'osc1')}
            ${this._oscSection('OSC 2', 'osc2')}
            ${this._filterSection()}
            ${this._filterEnvSection()}
            ${this._ampEnvSection()}
            ${this._lfoSection()}
            ${this._glideSection()}
        `;

        this.container.appendChild(root);
        this._root = root;
    }

    _presetSection() {
        return `
        <div class="synth-section">
            <div class="section-header">PRESET</div>
            <select class="preset-select" id="preset-select">
                <option value="">-- Init --</option>
            </select>
            <div class="preset-nav">
                <button class="preset-btn" id="preset-prev">\u25C0</button>
                <span class="preset-name" id="preset-name">Init</span>
                <button class="preset-btn" id="preset-next">\u25B6</button>
            </div>
        </div>`;
    }

    _scopeSection() {
        return `
        <div class="synth-section">
            <div class="section-header">SCOPE</div>
            <canvas id="oscilloscope" class="oscilloscope" width="240" height="80"></canvas>
        </div>`;
    }

    _oscSection(label, prefix) {
        const defaultGain = prefix === 'osc1' ? '0.8' : '0';
        const defaultGainDisplay = prefix === 'osc1' ? '80%' : '0%';
        return `
        <div class="synth-section">
            <div class="section-header">${label}</div>
            <div class="waveform-selector" data-target="${prefix}.type">
                <button class="wave-btn${prefix === 'osc1' ? ' active' : ''}" data-wave="sine" title="Sine">\u223F</button>
                <button class="wave-btn" data-wave="triangle" title="Triangle">\u25B3</button>
                <button class="wave-btn" data-wave="sawtooth" title="Saw">\u2A58</button>
                <button class="wave-btn" data-wave="square" title="Square">\u2293</button>
            </div>
            <div class="knob-row">
                <div class="knob-group">
                    <div class="knob" data-param="${prefix}.octave" data-min="-3" data-max="3" data-step="1" data-value="0" data-default="0">
                        <canvas class="knob-canvas" width="48" height="48"></canvas>
                    </div>
                    <label class="knob-label">OCT</label>
                    <span class="knob-value">0</span>
                </div>
                <div class="knob-group">
                    <div class="knob" data-param="${prefix}.detune" data-min="-100" data-max="100" data-step="1" data-value="0" data-default="0">
                        <canvas class="knob-canvas" width="48" height="48"></canvas>
                    </div>
                    <label class="knob-label">DETUNE</label>
                    <span class="knob-value">0</span>
                </div>
                <div class="knob-group">
                    <div class="knob" data-param="${prefix}.gain" data-min="0" data-max="1" data-step="0.01" data-value="${defaultGain}" data-default="${defaultGain}">
                        <canvas class="knob-canvas" width="48" height="48"></canvas>
                    </div>
                    <label class="knob-label">LEVEL</label>
                    <span class="knob-value">${defaultGainDisplay}</span>
                </div>
            </div>
        </div>`;
    }

    _filterSection() {
        return `
        <div class="synth-section">
            <div class="section-header">FILTER</div>
            <div class="filter-type-selector">
                <button class="filter-btn active" data-filter="lowpass">LP</button>
                <button class="filter-btn" data-filter="highpass">HP</button>
                <button class="filter-btn" data-filter="bandpass">BP</button>
            </div>
            <div class="knob-row">
                <div class="knob-group">
                    <div class="knob" data-param="filter.frequency" data-min="20" data-max="20000" data-step="1" data-value="2000" data-default="2000" data-log="true">
                        <canvas class="knob-canvas" width="48" height="48"></canvas>
                    </div>
                    <label class="knob-label">CUTOFF</label>
                    <span class="knob-value">2.0k</span>
                </div>
                <div class="knob-group">
                    <div class="knob" data-param="filter.Q" data-min="0" data-max="30" data-step="0.1" data-value="1" data-default="1">
                        <canvas class="knob-canvas" width="48" height="48"></canvas>
                    </div>
                    <label class="knob-label">RES</label>
                    <span class="knob-value">1.0</span>
                </div>
            </div>
        </div>`;
    }

    _filterEnvSection() {
        return `
        <div class="synth-section">
            <div class="section-header">FILTER ENV</div>
            <div class="env-row">
                <div class="env-slider-group">
                    <input type="range" class="env-slider" orient="vertical" min="0" max="5000" value="10" data-param="filterEnv.attack">
                    <label>A</label>
                </div>
                <div class="env-slider-group">
                    <input type="range" class="env-slider" orient="vertical" min="0" max="5000" value="300" data-param="filterEnv.decay">
                    <label>D</label>
                </div>
                <div class="env-slider-group">
                    <input type="range" class="env-slider" orient="vertical" min="0" max="100" value="40" data-param="filterEnv.sustain">
                    <label>S</label>
                </div>
                <div class="env-slider-group">
                    <input type="range" class="env-slider" orient="vertical" min="0" max="10000" value="300" data-param="filterEnv.release">
                    <label>R</label>
                </div>
            </div>
            <div class="knob-row">
                <div class="knob-group">
                    <div class="knob" data-param="filterEnv.amount" data-min="0" data-max="8000" data-step="10" data-value="3000" data-default="3000">
                        <canvas class="knob-canvas" width="48" height="48"></canvas>
                    </div>
                    <label class="knob-label">AMOUNT</label>
                    <span class="knob-value">3000</span>
                </div>
            </div>
        </div>`;
    }

    _ampEnvSection() {
        return `
        <div class="synth-section">
            <div class="section-header">AMP ENV</div>
            <div class="env-row">
                <div class="env-slider-group">
                    <input type="range" class="env-slider" orient="vertical" min="0" max="5000" value="10" data-param="ampEnv.attack">
                    <label>A</label>
                </div>
                <div class="env-slider-group">
                    <input type="range" class="env-slider" orient="vertical" min="0" max="5000" value="300" data-param="ampEnv.decay">
                    <label>D</label>
                </div>
                <div class="env-slider-group">
                    <input type="range" class="env-slider" orient="vertical" min="0" max="100" value="70" data-param="ampEnv.sustain">
                    <label>S</label>
                </div>
                <div class="env-slider-group">
                    <input type="range" class="env-slider" orient="vertical" min="0" max="10000" value="300" data-param="ampEnv.release">
                    <label>R</label>
                </div>
            </div>
        </div>`;
    }

    _lfoSection() {
        return `
        <div class="synth-section">
            <div class="section-header">LFO</div>
            <div class="waveform-selector" data-target="lfo.type">
                <button class="wave-btn active" data-wave="sine" title="Sine">\u223F</button>
                <button class="wave-btn" data-wave="triangle" title="Triangle">\u25B3</button>
                <button class="wave-btn" data-wave="square" title="Square">\u2293</button>
            </div>
            <div class="knob-row">
                <div class="knob-group">
                    <div class="knob" data-param="lfo.rate" data-min="0" data-max="20" data-step="0.1" data-value="0" data-default="0">
                        <canvas class="knob-canvas" width="48" height="48"></canvas>
                    </div>
                    <label class="knob-label">RATE</label>
                    <span class="knob-value">0 Hz</span>
                </div>
                <div class="knob-group">
                    <div class="knob" data-param="lfo.depth" data-min="0" data-max="1" data-step="0.01" data-value="0" data-default="0">
                        <canvas class="knob-canvas" width="48" height="48"></canvas>
                    </div>
                    <label class="knob-label">DEPTH</label>
                    <span class="knob-value">0%</span>
                </div>
            </div>
            <div class="lfo-dest-selector">
                <label class="knob-label">DEST</label>
                <select class="lfo-dest-select" data-param="lfo.destination">
                    <option value="none">None</option>
                    <option value="filter">Filter</option>
                    <option value="pitch">Pitch</option>
                    <option value="amplitude">Amp</option>
                </select>
            </div>
        </div>`;
    }

    _glideSection() {
        return `
        <div class="synth-section">
            <div class="section-header">GLIDE</div>
            <div class="knob-row">
                <div class="knob-group">
                    <div class="knob" data-param="glide" data-min="0" data-max="1" data-step="0.01" data-value="0" data-default="0">
                        <canvas class="knob-canvas" width="48" height="48"></canvas>
                    </div>
                    <label class="knob-label">TIME</label>
                    <span class="knob-value">0ms</span>
                </div>
            </div>
        </div>`;
    }

    // ── Knob Drawing ────────────────────────────────────────────────

    drawKnob(canvas, value, min, max, color = '#00d4ff') {
        const ctx = canvas.getContext('2d');
        const cx = 24, cy = 24, r = 18;
        const startAngle = 0.75 * Math.PI;
        const endAngle = 2.25 * Math.PI;
        const range = endAngle - startAngle;
        const normalized = (value - min) / (max - min);
        const valueAngle = startAngle + normalized * range;

        ctx.clearRect(0, 0, 48, 48);

        // Background track arc
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Value arc
        if (normalized > 0.005) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, startAngle, valueAngle);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Knob body
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1e2e';
        ctx.fill();
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Indicator line
        const ix = cx + Math.cos(valueAngle) * 9;
        const iy = cy + Math.sin(valueAngle) * 9;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ix, iy);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    // ── Knob Interaction ────────────────────────────────────────────

    _initAllKnobs() {
        const knobs = this._root.querySelectorAll('.knob');
        knobs.forEach(knobEl => this._initKnobInteraction(knobEl));
    }

    _initKnobInteraction(knobEl) {
        const canvas = knobEl.querySelector('.knob-canvas');
        const min = parseFloat(knobEl.dataset.min);
        const max = parseFloat(knobEl.dataset.max);
        const step = parseFloat(knobEl.dataset.step);
        const isLog = knobEl.dataset.log === 'true';
        const param = knobEl.dataset.param;
        let currentValue = parseFloat(knobEl.dataset.value);
        const defaultValue = parseFloat(knobEl.dataset.default || knobEl.dataset.value);

        // Store reference for external updates
        this._knobStates.set(param, {
            element: knobEl,
            canvas,
            min,
            max,
            step,
            isLog,
            get value() { return currentValue; },
            set value(v) { currentValue = v; }
        });

        // Initial draw
        this.drawKnob(canvas, currentValue, min, max);

        let startY, startValue;

        const onMove = (e) => {
            const deltaY = startY - e.clientY;
            const sensitivity = e.shiftKey ? 800 : 200;
            const range = max - min;
            let newValue;
            if (isLog) {
                const logMin = Math.log(min || 1);
                const logMax = Math.log(max);
                const logStart = Math.log(startValue || 1);
                const logDelta = (deltaY / sensitivity) * (logMax - logMin);
                newValue = Math.exp(logStart + logDelta);
            } else {
                newValue = startValue + (deltaY / sensitivity) * range;
            }
            newValue = Math.round(newValue / step) * step;
            newValue = Math.max(min, Math.min(max, newValue));
            currentValue = newValue;
            knobEl.dataset.value = newValue;
            this.drawKnob(canvas, newValue, min, max);
            this.updateValueDisplay(knobEl, param, newValue);
            if (this._onParamChange) this._onParamChange(param, newValue);
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startY = e.clientY;
            startValue = currentValue;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        canvas.addEventListener('dblclick', () => {
            currentValue = defaultValue;
            knobEl.dataset.value = defaultValue;
            this.drawKnob(canvas, defaultValue, min, max);
            this.updateValueDisplay(knobEl, param, defaultValue);
            if (this._onParamChange) this._onParamChange(param, defaultValue);
        });
    }

    // ── Value Display Formatting ────────────────────────────────────

    updateValueDisplay(knobEl, param, value) {
        const display = knobEl.parentElement.querySelector('.knob-value');
        if (!display) return;

        if (param.includes('frequency') || param === 'filter.frequency') {
            display.textContent = value >= 1000
                ? (value / 1000).toFixed(1) + 'k'
                : Math.round(value) + ' Hz';
        } else if (param.includes('gain') || param.includes('depth') || param.includes('sustain')) {
            display.textContent = Math.round(value * 100) + '%';
        } else if (param.includes('rate')) {
            display.textContent = value.toFixed(1) + ' Hz';
        } else if (param.includes('attack') || param.includes('decay') || param.includes('release') || param === 'glide') {
            display.textContent = value >= 1
                ? value.toFixed(1) + 's'
                : Math.round(value * 1000) + 'ms';
        } else {
            display.textContent = typeof value === 'number'
                ? (Number.isInteger(value) ? value : value.toFixed(1))
                : value;
        }
    }

    // ── Waveform Selector Handlers ──────────────────────────────────

    _initWaveformSelectors() {
        const selectors = this._root.querySelectorAll('.waveform-selector');
        selectors.forEach(selector => {
            const target = selector.dataset.target;
            const buttons = selector.querySelectorAll('.wave-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    buttons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const wave = btn.dataset.wave;
                    if (this._onParamChange) this._onParamChange(target, wave);
                });
            });
        });
    }

    // ── Filter Type Selector ────────────────────────────────────────

    _initFilterTypeSelector() {
        const selector = this._root.querySelector('.filter-type-selector');
        if (!selector) return;
        const buttons = selector.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filterType = btn.dataset.filter;
                if (this._onParamChange) this._onParamChange('filter.type', filterType);
            });
        });
    }

    // ── Envelope Slider Handlers ────────────────────────────────────

    _initEnvelopeSliders() {
        const sliders = this._root.querySelectorAll('.env-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', () => {
                const param = slider.dataset.param;
                const rawValue = parseFloat(slider.value);
                let value;
                if (param.includes('sustain')) {
                    value = rawValue / 100;
                } else {
                    value = rawValue / 1000;
                }
                if (this._onParamChange) this._onParamChange(param, value);
            });
        });
    }

    // ── LFO Destination Selector ────────────────────────────────────

    _initLFODestSelector() {
        const select = this._root.querySelector('.lfo-dest-select');
        if (!select) return;
        select.addEventListener('change', () => {
            if (this._onParamChange) this._onParamChange('lfo.destination', select.value);
        });
    }

    // ── Preset Navigation ───────────────────────────────────────────

    _initPresetNav() {
        const prevBtn = this._root.querySelector('#preset-prev');
        const nextBtn = this._root.querySelector('#preset-next');
        const selectEl = this._root.querySelector('#preset-select');

        if (selectEl) {
            selectEl.addEventListener('change', () => {
                const name = selectEl.value || 'Init';
                this._root.querySelector('#preset-name').textContent = name;
                if (this._onPresetChange) this._onPresetChange(name);
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (!selectEl) return;
                const idx = selectEl.selectedIndex;
                if (idx > 0) {
                    selectEl.selectedIndex = idx - 1;
                    selectEl.dispatchEvent(new Event('change'));
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (!selectEl) return;
                const idx = selectEl.selectedIndex;
                if (idx < selectEl.options.length - 1) {
                    selectEl.selectedIndex = idx + 1;
                    selectEl.dispatchEvent(new Event('change'));
                }
            });
        }
    }

    // ── Oscilloscope ────────────────────────────────────────────────

    _initOscilloscopeCanvas() {
        const canvas = this._root.querySelector('#oscilloscope');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }

    startOscilloscope(analyserNode) {
        this._analyser = analyserNode;
        this._scopeData = new Uint8Array(analyserNode.frequencyBinCount);
        const canvas = this._root.querySelector('#oscilloscope');
        const ctx = canvas.getContext('2d');

        const draw = () => {
            this._analyser.getByteTimeDomainData(this._scopeData);
            const w = canvas.width, h = canvas.height;

            ctx.fillStyle = '#0a0a12';
            ctx.fillRect(0, 0, w, h);

            // Center line
            ctx.strokeStyle = '#1a1a2a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
            ctx.stroke();

            // Waveform
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            const sliceWidth = w / this._scopeData.length;
            let x = 0;
            for (let i = 0; i < this._scopeData.length; i++) {
                const v = this._scopeData[i] / 128.0;
                const y = v * h / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();

            this._scopeFrame = requestAnimationFrame(draw);
        };
        draw();
    }

    stopOscilloscope() {
        if (this._scopeFrame) {
            cancelAnimationFrame(this._scopeFrame);
            this._scopeFrame = null;
        }
    }

    // ── Public API ──────────────────────────────────────────────────

    connectAnalyser(analyserNode) {
        this.startOscilloscope(analyserNode);
    }

    onParamChange(callback) {
        this._onParamChange = callback;
    }

    onPresetChange(callback) {
        this._onPresetChange = callback;
    }

    setParam(path, value) {
        // Update knob if it exists
        const state = this._knobStates.get(path);
        if (state) {
            state.value = value;
            state.element.dataset.value = value;
            this.drawKnob(state.canvas, value, state.min, state.max);
            this.updateValueDisplay(state.element, path, value);
            return;
        }

        // Update waveform selector buttons
        if (path.endsWith('.type')) {
            const selector = this._root.querySelector(`.waveform-selector[data-target="${path}"]`);
            if (selector) {
                const buttons = selector.querySelectorAll('.wave-btn');
                buttons.forEach(b => {
                    b.classList.toggle('active', b.dataset.wave === value);
                });
                return;
            }
        }

        // Update filter type buttons
        if (path === 'filter.type') {
            const buttons = this._root.querySelectorAll('.filter-btn');
            buttons.forEach(b => {
                b.classList.toggle('active', b.dataset.filter === value);
            });
            return;
        }

        // Update envelope sliders
        const slider = this._root.querySelector(`.env-slider[data-param="${path}"]`);
        if (slider) {
            if (path.includes('sustain')) {
                slider.value = value * 100;
            } else {
                slider.value = value * 1000;
            }
            return;
        }

        // Update LFO destination
        if (path === 'lfo.destination') {
            const select = this._root.querySelector('.lfo-dest-select');
            if (select) select.value = value;
            return;
        }
    }

    setParams(params) {
        const flatten = (obj, prefix = '') => {
            for (const key of Object.keys(obj)) {
                const path = prefix ? `${prefix}.${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    flatten(obj[key], path);
                } else {
                    this.setParam(path, obj[key]);
                }
            }
        };
        flatten(params);
    }

    loadPresets(presetsData) {
        const selectEl = this._root.querySelector('#preset-select');
        if (!selectEl) return;

        // Clear existing optgroups but keep Init
        while (selectEl.children.length > 1) {
            selectEl.removeChild(selectEl.lastChild);
        }

        // presetsData expected as { category: [{ name, params }, ...], ... }
        for (const [category, presets] of Object.entries(presetsData)) {
            const group = document.createElement('optgroup');
            group.label = category;
            for (const preset of presets) {
                const opt = document.createElement('option');
                opt.value = preset.name;
                opt.textContent = preset.name;
                group.appendChild(opt);
            }
            selectEl.appendChild(group);
        }
    }

    selectPreset(name) {
        const selectEl = this._root.querySelector('#preset-select');
        if (!selectEl) return;
        selectEl.value = name;
        this._root.querySelector('#preset-name').textContent = name || 'Init';
        // Do NOT fire _onPresetChange here — this is a UI-only update.
        // The caller (App.js) already handles loading the preset into the engine.
    }
}
