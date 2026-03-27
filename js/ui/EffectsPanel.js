export default class EffectsPanel {
    constructor(container) {
        this.container = container;

        this._onParamChange = null;
        this._onBypassChange = null;
        this._knobStates = new Map();
        this._bypassStates = new Map();
        this._collapsedSections = new Set();

        this._effectDefs = this._defineEffects();

        this._injectStyles();
        this._buildDOM();
        this._initAllKnobs();
        this._initTypeSelectors();
        this._initToggleButtons();
        this._initBypassButtons();
        this._initCollapsibles();
    }

    // ── Effect Definitions ───────────────────────────────────────────

    _defineEffects() {
        return [
            {
                name: 'eq',
                label: 'EQUALIZER',
                bypass: true,
                sections: [
                    {
                        label: 'LOW',
                        knobs: [
                            { param: 'eq.low.frequency', label: 'FREQ', min: 20, max: 500, step: 1, value: 200, unit: 'freq', log: true },
                            { param: 'eq.low.gain', label: 'GAIN', min: -24, max: 24, step: 0.5, value: 0, unit: 'db' },
                            { param: 'eq.low.Q', label: 'Q', min: 0.1, max: 18, step: 0.1, value: 1, unit: 'fixed1' }
                        ]
                    },
                    {
                        label: 'MID',
                        knobs: [
                            { param: 'eq.mid.frequency', label: 'FREQ', min: 200, max: 5000, step: 1, value: 1000, unit: 'freq', log: true },
                            { param: 'eq.mid.gain', label: 'GAIN', min: -24, max: 24, step: 0.5, value: 0, unit: 'db' },
                            { param: 'eq.mid.Q', label: 'Q', min: 0.1, max: 18, step: 0.1, value: 1, unit: 'fixed1' }
                        ]
                    },
                    {
                        label: 'HIGH',
                        knobs: [
                            { param: 'eq.high.frequency', label: 'FREQ', min: 2000, max: 20000, step: 1, value: 5000, unit: 'freq', log: true },
                            { param: 'eq.high.gain', label: 'GAIN', min: -24, max: 24, step: 0.5, value: 0, unit: 'db' },
                            { param: 'eq.high.Q', label: 'Q', min: 0.1, max: 18, step: 0.1, value: 1, unit: 'fixed1' }
                        ]
                    }
                ]
            },
            {
                name: 'distortion',
                label: 'DISTORTION',
                bypass: true,
                typeSelector: {
                    param: 'distortion.type',
                    options: [
                        { value: 'soft', label: 'SOFT' },
                        { value: 'hard', label: 'HARD' },
                        { value: 'tube', label: 'TUBE' },
                        { value: 'fuzz', label: 'FUZZ' }
                    ],
                    current: 'soft'
                },
                knobs: [
                    { param: 'distortion.amount', label: 'DRIVE', min: 0, max: 1, step: 0.01, value: 0, unit: 'percent' },
                    { param: 'distortion.wetDry', label: 'MIX', min: 0, max: 1, step: 0.01, value: 0, unit: 'percent' }
                ]
            },
            {
                name: 'chorus',
                label: 'CHORUS',
                bypass: true,
                knobs: [
                    { param: 'chorus.rate', label: 'RATE', min: 0.1, max: 10, step: 0.1, value: 1.5, unit: 'hz' },
                    { param: 'chorus.depth', label: 'DEPTH', min: 0, max: 1, step: 0.01, value: 0.5, unit: 'percent' },
                    { param: 'chorus.wetDry', label: 'MIX', min: 0, max: 1, step: 0.01, value: 0, unit: 'percent' }
                ]
            },
            {
                name: 'delay',
                label: 'DELAY',
                bypass: true,
                typeSelector: {
                    param: 'delay.division',
                    options: [
                        { value: '1/4', label: '1/4' },
                        { value: '1/8', label: '1/8' },
                        { value: '1/16', label: '1/16' },
                        { value: '1/8d', label: '1/8D' },
                        { value: '1/8t', label: '1/8T' }
                    ],
                    current: '1/8'
                },
                toggles: [
                    { param: 'delay.sync', label: 'SYNC', value: true },
                    { param: 'delay.pingPong', label: 'PING PONG', value: true }
                ],
                knobs: [
                    { param: 'delay.time', label: 'TIME', min: 0, max: 2, step: 0.001, value: 0.375, unit: 'ms' },
                    { param: 'delay.feedback', label: 'FDBK', min: 0, max: 0.9, step: 0.01, value: 0.3, unit: 'percent' },
                    { param: 'delay.wetDry', label: 'MIX', min: 0, max: 1, step: 0.01, value: 0, unit: 'percent' }
                ]
            },
            {
                name: 'reverb',
                label: 'REVERB',
                bypass: true,
                knobs: [
                    { param: 'reverb.roomSize', label: 'SIZE', min: 0, max: 1, step: 0.01, value: 0.5, unit: 'percent' },
                    { param: 'reverb.damping', label: 'DAMP', min: 0, max: 1, step: 0.01, value: 0.5, unit: 'percent' },
                    { param: 'reverb.preDelay', label: 'PRE-DLY', min: 0, max: 0.1, step: 0.001, value: 0.01, unit: 'ms' },
                    { param: 'reverb.wetDry', label: 'MIX', min: 0, max: 1, step: 0.01, value: 0, unit: 'percent' }
                ]
            },
            {
                name: 'compressor',
                label: 'COMPRESSOR',
                bypass: false,
                knobs: [
                    { param: 'compressor.threshold', label: 'THRESH', min: -60, max: 0, step: 0.5, value: -12, unit: 'db' },
                    { param: 'compressor.ratio', label: 'RATIO', min: 1, max: 20, step: 0.1, value: 4, unit: 'ratio' },
                    { param: 'compressor.knee', label: 'KNEE', min: 0, max: 40, step: 0.5, value: 10, unit: 'db' },
                    { param: 'compressor.attack', label: 'ATK', min: 0, max: 1, step: 0.001, value: 0.01, unit: 'ms' },
                    { param: 'compressor.release', label: 'REL', min: 0.01, max: 1, step: 0.001, value: 0.15, unit: 'ms' },
                    { param: 'compressor.makeupGain', label: 'MAKEUP', min: 0, max: 24, step: 0.5, value: 0, unit: 'db' }
                ]
            }
        ];
    }

    // ── DOM Construction ─────────────────────────────────────────────

    _buildDOM() {
        const root = document.createElement('div');
        root.className = 'fx-panel-container';

        // Header
        const header = document.createElement('div');
        header.className = 'fx-panel-header';
        const title = document.createElement('span');
        title.className = 'fx-panel-title';
        title.textContent = 'EFFECTS';
        header.appendChild(title);
        root.appendChild(header);

        // Scrollable body
        const body = document.createElement('div');
        body.className = 'fx-panel-body';

        for (const def of this._effectDefs) {
            body.appendChild(this._buildEffectSection(def));
        }

        root.appendChild(body);
        this.container.appendChild(root);
        this._root = root;
    }

    _buildEffectSection(def) {
        const section = document.createElement('div');
        section.className = 'fx-section';
        section.dataset.effect = def.name;

        // Section header with bypass and collapse
        const header = document.createElement('div');
        header.className = 'fx-section-header';

        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'fx-collapse-btn';
        collapseBtn.textContent = '\u25BC';
        collapseBtn.dataset.effect = def.name;
        header.appendChild(collapseBtn);

        const label = document.createElement('span');
        label.className = 'fx-section-label';
        label.textContent = def.label;
        header.appendChild(label);

        const bypassBtn = document.createElement('button');
        bypassBtn.className = 'fx-bypass-btn' + (def.bypass ? ' bypassed' : ' active');
        bypassBtn.dataset.effect = def.name;
        bypassBtn.textContent = def.bypass ? 'OFF' : 'ON';
        bypassBtn.title = 'Toggle bypass';
        this._bypassStates.set(def.name, def.bypass);
        header.appendChild(bypassBtn);

        section.appendChild(header);

        // Collapsible content
        const content = document.createElement('div');
        content.className = 'fx-section-content';

        // EQ has sub-sections for each band
        if (def.sections) {
            for (const sub of def.sections) {
                const subHeader = document.createElement('div');
                subHeader.className = 'fx-sub-header';
                subHeader.textContent = sub.label;
                content.appendChild(subHeader);

                const knobRow = document.createElement('div');
                knobRow.className = 'fx-knob-row';
                for (const knob of sub.knobs) {
                    knobRow.appendChild(this._buildKnobGroup(knob));
                }
                content.appendChild(knobRow);
            }
        }

        // Type selector (distortion type, delay division)
        if (def.typeSelector) {
            content.appendChild(this._buildTypeSelector(def.typeSelector));
        }

        // Toggle buttons (delay sync, pingPong)
        if (def.toggles) {
            const toggleRow = document.createElement('div');
            toggleRow.className = 'fx-toggle-row';
            for (const toggle of def.toggles) {
                toggleRow.appendChild(this._buildToggleButton(toggle));
            }
            content.appendChild(toggleRow);
        }

        // Knobs
        if (def.knobs) {
            const knobRow = document.createElement('div');
            knobRow.className = 'fx-knob-row';
            for (const knob of def.knobs) {
                knobRow.appendChild(this._buildKnobGroup(knob));
            }
            content.appendChild(knobRow);
        }

        section.appendChild(content);
        return section;
    }

    _buildKnobGroup(knob) {
        const group = document.createElement('div');
        group.className = 'fx-knob-group';

        const knobEl = document.createElement('div');
        knobEl.className = 'fx-knob';
        knobEl.dataset.param = knob.param;
        knobEl.dataset.min = knob.min;
        knobEl.dataset.max = knob.max;
        knobEl.dataset.step = knob.step;
        knobEl.dataset.value = knob.value;
        knobEl.dataset.default = knob.value;
        knobEl.dataset.unit = knob.unit || '';
        if (knob.log) knobEl.dataset.log = 'true';

        const canvas = document.createElement('canvas');
        canvas.className = 'fx-knob-canvas';
        canvas.width = 48;
        canvas.height = 48;
        knobEl.appendChild(canvas);

        group.appendChild(knobEl);

        const label = document.createElement('label');
        label.className = 'fx-knob-label';
        label.textContent = knob.label;
        group.appendChild(label);

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'fx-knob-value';
        valueDisplay.textContent = this._formatValue(knob.value, knob.unit);
        group.appendChild(valueDisplay);

        return group;
    }

    _buildTypeSelector(typeDef) {
        const container = document.createElement('div');
        container.className = 'fx-type-selector';
        container.dataset.param = typeDef.param;

        for (const opt of typeDef.options) {
            const btn = document.createElement('button');
            btn.className = 'fx-type-btn' + (opt.value === typeDef.current ? ' active' : '');
            btn.dataset.value = opt.value;
            btn.textContent = opt.label;
            container.appendChild(btn);
        }

        return container;
    }

    _buildToggleButton(toggle) {
        const btn = document.createElement('button');
        btn.className = 'fx-toggle-btn' + (toggle.value ? ' active' : '');
        btn.dataset.param = toggle.param;
        btn.textContent = toggle.label;
        return btn;
    }

    // ── Knob Drawing ─────────────────────────────────────────────────

    _drawKnob(canvas, value, min, max, color = '#00d4ff') {
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

    // ── Knob Interaction ─────────────────────────────────────────────

    _initAllKnobs() {
        const knobs = this._root.querySelectorAll('.fx-knob');
        knobs.forEach(knobEl => this._initKnobInteraction(knobEl));
    }

    _initKnobInteraction(knobEl) {
        const canvas = knobEl.querySelector('.fx-knob-canvas');
        const min = parseFloat(knobEl.dataset.min);
        const max = parseFloat(knobEl.dataset.max);
        const step = parseFloat(knobEl.dataset.step);
        const isLog = knobEl.dataset.log === 'true';
        const param = knobEl.dataset.param;
        const unit = knobEl.dataset.unit || '';
        let currentValue = parseFloat(knobEl.dataset.value);
        const defaultValue = parseFloat(knobEl.dataset.default || knobEl.dataset.value);

        // Determine knob color based on effect
        const effectName = param.split('.')[0];
        const color = this._getEffectColor(effectName);

        this._knobStates.set(param, {
            element: knobEl,
            canvas,
            min,
            max,
            step,
            isLog,
            unit,
            color,
            get value() { return currentValue; },
            set value(v) { currentValue = v; }
        });

        // Initial draw
        this._drawKnob(canvas, currentValue, min, max, color);

        let startY, startValue;

        const onMove = (e) => {
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = startY - clientY;
            const sensitivity = (e.shiftKey || (e.touches && e.touches.length > 1)) ? 800 : 200;
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

            this._drawKnob(canvas, newValue, min, max, color);
            this._updateValueDisplay(knobEl, newValue, unit);
            this._emitParamChange(param, newValue);
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };

        const onDown = (e) => {
            e.preventDefault();
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            startValue = currentValue;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        };

        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('touchstart', onDown, { passive: false });

        // Double-click to reset
        canvas.addEventListener('dblclick', () => {
            currentValue = defaultValue;
            knobEl.dataset.value = defaultValue;
            this._drawKnob(canvas, defaultValue, min, max, color);
            this._updateValueDisplay(knobEl, defaultValue, unit);
            this._emitParamChange(param, defaultValue);
        });
    }

    // ── Type Selectors ───────────────────────────────────────────────

    _initTypeSelectors() {
        const selectors = this._root.querySelectorAll('.fx-type-selector');
        selectors.forEach(selector => {
            const param = selector.dataset.param;
            const buttons = selector.querySelectorAll('.fx-type-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    buttons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this._emitParamChange(param, btn.dataset.value);
                });
            });
        });
    }

    // ── Toggle Buttons ───────────────────────────────────────────────

    _initToggleButtons() {
        const toggles = this._root.querySelectorAll('.fx-toggle-btn');
        toggles.forEach(btn => {
            btn.addEventListener('click', () => {
                const isActive = btn.classList.toggle('active');
                const param = btn.dataset.param;
                this._emitParamChange(param, isActive);
            });
        });
    }

    // ── Bypass Buttons ───────────────────────────────────────────────

    _initBypassButtons() {
        const buttons = this._root.querySelectorAll('.fx-bypass-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const effectName = btn.dataset.effect;
                const wasBypassed = this._bypassStates.get(effectName);
                const nowBypassed = !wasBypassed;

                this._bypassStates.set(effectName, nowBypassed);
                btn.classList.toggle('bypassed', nowBypassed);
                btn.classList.toggle('active', !nowBypassed);
                btn.textContent = nowBypassed ? 'OFF' : 'ON';

                // Dim the section content when bypassed
                const section = btn.closest('.fx-section');
                section.classList.toggle('fx-bypassed', nowBypassed);

                if (this._onBypassChange) {
                    this._onBypassChange(effectName, nowBypassed);
                }
            });
        });
    }

    // ── Collapsible Sections ─────────────────────────────────────────

    _initCollapsibles() {
        const buttons = this._root.querySelectorAll('.fx-collapse-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const effectName = btn.dataset.effect;
                const section = btn.closest('.fx-section');
                const content = section.querySelector('.fx-section-content');
                const isCollapsed = this._collapsedSections.has(effectName);

                if (isCollapsed) {
                    this._collapsedSections.delete(effectName);
                    content.style.display = '';
                    btn.textContent = '\u25BC';
                } else {
                    this._collapsedSections.add(effectName);
                    content.style.display = 'none';
                    btn.textContent = '\u25B6';
                }
            });
        });
    }

    // ── Value Formatting ─────────────────────────────────────────────

    _formatValue(value, unit) {
        switch (unit) {
            case 'percent':
                return Math.round(value * 100) + '%';
            case 'db':
                return (value >= 0 ? '+' : '') + value.toFixed(1) + ' dB';
            case 'freq':
                if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
                return Math.round(value) + ' Hz';
            case 'hz':
                return value.toFixed(1) + ' Hz';
            case 'ms':
                if (value >= 1) return value.toFixed(2) + 's';
                return Math.round(value * 1000) + 'ms';
            case 'ratio':
                return value.toFixed(1) + ':1';
            case 'fixed1':
                return value.toFixed(1);
            default:
                return typeof value === 'number'
                    ? (Number.isInteger(value) ? String(value) : value.toFixed(2))
                    : String(value);
        }
    }

    _updateValueDisplay(knobEl, value, unit) {
        const display = knobEl.parentElement.querySelector('.fx-knob-value');
        if (display) {
            display.textContent = this._formatValue(value, unit);
        }
    }

    // ── Effect Colors ────────────────────────────────────────────────

    _getEffectColor(effectName) {
        const colors = {
            eq: '#00d4ff',
            distortion: '#ff5544',
            chorus: '#7b2fff',
            delay: '#00d4ff',
            reverb: '#7b2fff',
            compressor: '#ffaa00'
        };
        return colors[effectName] || '#00d4ff';
    }

    // ── Callback Emission ────────────────────────────────────────────

    _emitParamChange(param, value) {
        if (!this._onParamChange) return;

        // Parse param path: "effectName.paramName" or "eq.band.paramName"
        const parts = param.split('.');
        if (parts[0] === 'eq' && parts.length === 3) {
            // EQ: effectName='eq', param is 'band.paramName' but the engine
            // expects setEQParam(band, param, value) — let caller handle it
            this._onParamChange('eq', param.substring(3), value);
        } else if (parts.length >= 2) {
            this._onParamChange(parts[0], parts.slice(1).join('.'), value);
        }
    }

    // ── Scoped CSS ───────────────────────────────────────────────────

    _injectStyles() {
        if (document.getElementById('effects-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'effects-panel-styles';
        style.textContent = `
            .fx-panel-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: #0d0d14;
                border: 1px solid #1a1a2e;
                border-radius: 4px;
                overflow: hidden;
                font-family: 'Courier New', monospace;
                user-select: none;
            }

            .fx-panel-header {
                padding: 8px 12px;
                border-bottom: 1px solid #1a1a2e;
                flex-shrink: 0;
                background: #0a0a12;
            }

            .fx-panel-title {
                font-size: 11px;
                font-weight: bold;
                color: #8888aa;
                letter-spacing: 3px;
            }

            .fx-panel-body {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 4px 0;
            }

            .fx-panel-body::-webkit-scrollbar {
                width: 4px;
            }

            .fx-panel-body::-webkit-scrollbar-track {
                background: #0a0a12;
            }

            .fx-panel-body::-webkit-scrollbar-thumb {
                background: #2a2a3e;
                border-radius: 2px;
            }

            /* ── Section ── */

            .fx-section {
                border-bottom: 1px solid #14141f;
                transition: opacity 0.2s;
            }

            .fx-section.fx-bypassed .fx-section-content {
                opacity: 0.35;
                pointer-events: none;
            }

            .fx-section-header {
                display: flex;
                align-items: center;
                padding: 6px 8px;
                gap: 6px;
                background: #0e0e18;
                cursor: default;
            }

            .fx-collapse-btn {
                width: 16px;
                height: 16px;
                font-size: 8px;
                background: none;
                border: none;
                color: #555577;
                cursor: pointer;
                padding: 0;
                line-height: 16px;
                text-align: center;
                flex-shrink: 0;
                font-family: inherit;
            }

            .fx-collapse-btn:hover {
                color: #00d4ff;
            }

            .fx-section-label {
                flex: 1;
                font-size: 10px;
                font-weight: bold;
                color: #8888aa;
                letter-spacing: 2px;
            }

            .fx-bypass-btn {
                padding: 2px 8px;
                font-size: 9px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
                border: 1px solid #333355;
                border-radius: 3px;
                cursor: pointer;
                letter-spacing: 1px;
                transition: all 0.15s;
                flex-shrink: 0;
            }

            .fx-bypass-btn.active {
                background: #00d4ff;
                color: #000;
                border-color: #00d4ff;
                box-shadow: 0 0 6px rgba(0, 212, 255, 0.3);
            }

            .fx-bypass-btn.bypassed {
                background: #1a1a2e;
                color: #555577;
                border-color: #333355;
            }

            .fx-bypass-btn:hover {
                border-color: #00d4ff;
            }

            /* ── Content ── */

            .fx-section-content {
                padding: 6px 10px 10px;
                transition: opacity 0.2s;
            }

            .fx-sub-header {
                font-size: 9px;
                color: #6666aa;
                letter-spacing: 2px;
                padding: 4px 0 2px;
                border-bottom: 1px solid #14141f;
                margin-bottom: 4px;
            }

            /* ── Knob Row ── */

            .fx-knob-row {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 4px 0;
                justify-content: flex-start;
            }

            .fx-knob-group {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                min-width: 52px;
            }

            .fx-knob {
                position: relative;
                cursor: grab;
            }

            .fx-knob:active {
                cursor: grabbing;
            }

            .fx-knob-canvas {
                display: block;
                width: 48px;
                height: 48px;
            }

            .fx-knob-label {
                font-size: 9px;
                color: #6666aa;
                letter-spacing: 1px;
                text-align: center;
                white-space: nowrap;
            }

            .fx-knob-value {
                font-size: 9px;
                color: #00d4ff;
                text-align: center;
                white-space: nowrap;
                min-width: 40px;
            }

            /* ── Type Selector ── */

            .fx-type-selector {
                display: flex;
                gap: 2px;
                padding: 4px 0;
                flex-wrap: wrap;
            }

            .fx-type-btn {
                padding: 3px 8px;
                font-size: 9px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
                background: #14141f;
                color: #555577;
                border: 1px solid #2a2a3e;
                border-radius: 3px;
                cursor: pointer;
                letter-spacing: 1px;
                transition: all 0.15s;
            }

            .fx-type-btn:hover {
                border-color: #7b2fff;
                color: #8888aa;
            }

            .fx-type-btn.active {
                background: #7b2fff;
                color: #fff;
                border-color: #7b2fff;
                box-shadow: 0 0 6px rgba(123, 47, 255, 0.3);
            }

            /* ── Toggle Buttons ── */

            .fx-toggle-row {
                display: flex;
                gap: 4px;
                padding: 4px 0;
                flex-wrap: wrap;
            }

            .fx-toggle-btn {
                padding: 3px 10px;
                font-size: 9px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
                background: #14141f;
                color: #555577;
                border: 1px solid #2a2a3e;
                border-radius: 3px;
                cursor: pointer;
                letter-spacing: 1px;
                transition: all 0.15s;
            }

            .fx-toggle-btn:hover {
                border-color: #00d4ff;
                color: #8888aa;
            }

            .fx-toggle-btn.active {
                background: rgba(0, 212, 255, 0.15);
                color: #00d4ff;
                border-color: #00d4ff;
            }
        `;
        document.head.appendChild(style);
    }

    // ── Public API ───────────────────────────────────────────────────

    onParamChange(callback) {
        this._onParamChange = callback;
    }

    onBypassChange(callback) {
        this._onBypassChange = callback;
    }

    /**
     * Update a single parameter's UI from external state.
     * @param {string} effectName - e.g. 'eq', 'reverb', 'delay'
     * @param {string} param - e.g. 'roomSize', 'low.frequency', 'sync'
     * @param {*} value
     */
    setParam(effectName, param, value) {
        const fullParam = effectName + '.' + param;

        // Check knob states
        const state = this._knobStates.get(fullParam);
        if (state) {
            state.value = value;
            state.element.dataset.value = value;
            this._drawKnob(state.canvas, value, state.min, state.max, state.color);
            this._updateValueDisplay(state.element, value, state.unit);
            return;
        }

        // Check type selectors
        const typeSelector = this._root.querySelector(`.fx-type-selector[data-param="${fullParam}"]`);
        if (typeSelector) {
            const buttons = typeSelector.querySelectorAll('.fx-type-btn');
            buttons.forEach(b => b.classList.toggle('active', b.dataset.value === value));
            return;
        }

        // Check toggle buttons
        const toggleBtn = this._root.querySelector(`.fx-toggle-btn[data-param="${fullParam}"]`);
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', !!value);
            return;
        }
    }

    /**
     * Set bypass state for an effect from external state.
     * @param {string} effectName
     * @param {boolean} bypassed
     */
    setBypass(effectName, bypassed) {
        this._bypassStates.set(effectName, bypassed);
        const btn = this._root.querySelector(`.fx-bypass-btn[data-effect="${effectName}"]`);
        if (btn) {
            btn.classList.toggle('bypassed', bypassed);
            btn.classList.toggle('active', !bypassed);
            btn.textContent = bypassed ? 'OFF' : 'ON';
        }
        const section = this._root.querySelector(`.fx-section[data-effect="${effectName}"]`);
        if (section) {
            section.classList.toggle('fx-bypassed', bypassed);
        }
    }

    /**
     * Bulk-update all params from a state object matching the Effects engine params shape.
     * @param {object} params - e.g. { reverb: { roomSize: 0.5, ... }, eq: { low: { frequency: 200 }, ... } }
     */
    setAllParams(params) {
        for (const [effectName, effectParams] of Object.entries(params)) {
            if (typeof effectParams !== 'object') continue;
            for (const [key, val] of Object.entries(effectParams)) {
                if (key === 'bypass') {
                    this.setBypass(effectName, val);
                } else if (typeof val === 'object' && val !== null) {
                    // Nested (EQ bands)
                    for (const [subKey, subVal] of Object.entries(val)) {
                        this.setParam(effectName, key + '.' + subKey, subVal);
                    }
                } else {
                    this.setParam(effectName, key, val);
                }
            }
        }
    }

    /**
     * Collapse or expand a specific effect section.
     * @param {string} effectName
     * @param {boolean} collapsed
     */
    setCollapsed(effectName, collapsed) {
        const section = this._root.querySelector(`.fx-section[data-effect="${effectName}"]`);
        if (!section) return;

        const content = section.querySelector('.fx-section-content');
        const btn = section.querySelector('.fx-collapse-btn');

        if (collapsed) {
            this._collapsedSections.add(effectName);
            content.style.display = 'none';
            btn.textContent = '\u25B6';
        } else {
            this._collapsedSections.delete(effectName);
            content.style.display = '';
            btn.textContent = '\u25BC';
        }
    }
}
