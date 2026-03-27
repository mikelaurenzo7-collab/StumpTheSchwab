export default class PerformanceView {
    constructor(container) {
        this.container = container;

        // Data model
        this.clips = [];
        this.grid = new Array(4).fill(null).map(() => new Array(8).fill(null));
        this.activeClips = [null, null, null, null];
        this.queuedClips = [null, null, null, null];
        this.crossfade = 0.5;

        this._currentBeat = 0;
        this._rowLabels = ['DRUMS', 'SYNTH', 'BASS', 'FX'];
        this._rowColors = ['#ff3366', '#00d4ff', '#7b2fff', '#ffaa00'];
        this._macros = {
            ATMOSPHERE: { value: 0, color: '#00d4ff' },
            ENERGY:     { value: 0, color: '#ff3366' },
            SPACE:      { value: 0, color: '#7b2fff' },
            GRIT:       { value: 0, color: '#ffaa00' }
        };

        // Callbacks
        this._onClipTrigger = null;
        this._onClipStop = null;
        this._onCrossfade = null;
        this._onMacroChange = null;

        // DOM references
        this._padEls = new Array(4).fill(null).map(() => new Array(8).fill(null));
        this._knobCanvases = {};
        this._knobStates = {};

        this._injectStyles();
        this._buildDOM();
        this._initMacroKnobs();
        this._bindEvents();
    }

    // ── Callbacks ────────────────────────────────────────────────

    onClipTrigger(callback)  { this._onClipTrigger = callback; }
    onClipStop(callback)     { this._onClipStop = callback; }
    onCrossfade(callback)    { this._onCrossfade = callback; }
    onMacroChange(callback)  { this._onMacroChange = callback; }

    // ── Public Methods ───────────────────────────────────────────

    loadClip(row, col, clipData) {
        if (row < 0 || row > 3 || col < 0 || col > 7) return;
        this.grid[row][col] = clipData;
        const pad = this._padEls[row][col];
        if (!pad) return;
        pad.classList.add('loaded');
        pad.style.setProperty('--pad-color', clipData.color || this._rowColors[row]);
        pad.querySelector('.pad-name').textContent = clipData.name || '';
    }

    setPlaying(row, col) {
        // Clear previous playing state on this row
        for (let c = 0; c < 8; c++) {
            this._padEls[row][c].classList.remove('playing');
        }
        this.activeClips[row] = col;
        if (col !== null && col >= 0) {
            this._padEls[row][col].classList.add('playing');
        }
    }

    setQueued(row, col) {
        this.clearQueued(row);
        this.queuedClips[row] = col;
        if (col !== null && col >= 0) {
            this._padEls[row][col].classList.add('queued');
        }
    }

    clearQueued(row) {
        const prev = this.queuedClips[row];
        if (prev !== null && prev >= 0) {
            this._padEls[row][prev].classList.remove('queued');
        }
        this.queuedClips[row] = null;
    }

    setBeat(beat) {
        this._currentBeat = beat;
        // Pulse animation sync — toggle pulse class on playing pads
        for (let r = 0; r < 4; r++) {
            const col = this.activeClips[r];
            if (col !== null && col >= 0) {
                const pad = this._padEls[r][col];
                if (beat % 4 === 0) {
                    pad.classList.remove('pulse');
                    void pad.offsetWidth; // reflow
                    pad.classList.add('pulse');
                }
            }
        }
        // Update beat dot in header
        if (this._beatDots) {
            this._beatDots.forEach((dot, i) => {
                dot.classList.toggle('active', i === beat % 4);
            });
        }
    }

    getCrossfade() {
        return this.crossfade;
    }

    // ── DOM Construction ─────────────────────────────────────────

    _buildDOM() {
        const root = document.createElement('div');
        root.className = 'perf-container';

        // Mode toggle bar
        root.appendChild(this._buildHeader());

        // Clip grid
        root.appendChild(this._buildGrid());

        // Crossfader
        root.appendChild(this._buildCrossfader());

        // FX Macro knobs
        root.appendChild(this._buildMacros());

        this.container.appendChild(root);
        this._root = root;
    }

    _buildHeader() {
        const header = document.createElement('div');
        header.className = 'perf-header';

        const titleGroup = document.createElement('div');
        titleGroup.className = 'perf-title-group';

        const dot = document.createElement('span');
        dot.className = 'perf-live-dot';

        const title = document.createElement('span');
        title.className = 'perf-title';
        title.textContent = 'PERFORMANCE';

        titleGroup.appendChild(dot);
        titleGroup.appendChild(title);

        const rightGroup = document.createElement('div');
        rightGroup.className = 'perf-header-right';

        // Beat dots
        const beatContainer = document.createElement('div');
        beatContainer.className = 'perf-beat-dots';
        this._beatDots = [];
        for (let i = 0; i < 4; i++) {
            const bd = document.createElement('span');
            bd.className = 'perf-beat-dot';
            beatContainer.appendChild(bd);
            this._beatDots.push(bd);
        }
        rightGroup.appendChild(beatContainer);

        const bpm = document.createElement('span');
        bpm.className = 'perf-bpm';
        bpm.textContent = '120 BPM';
        this._bpmEl = bpm;
        rightGroup.appendChild(bpm);

        header.appendChild(titleGroup);
        header.appendChild(rightGroup);
        return header;
    }

    _buildGrid() {
        const gridArea = document.createElement('div');
        gridArea.className = 'perf-grid-area';

        for (let r = 0; r < 4; r++) {
            const row = document.createElement('div');
            row.className = 'perf-grid-row';

            // Row label
            const label = document.createElement('div');
            label.className = 'perf-row-label';
            label.textContent = this._rowLabels[r];
            label.style.color = this._rowColors[r];
            row.appendChild(label);

            // 8 pads
            for (let c = 0; c < 8; c++) {
                const pad = document.createElement('button');
                pad.className = 'perf-pad';
                pad.dataset.row = r;
                pad.dataset.col = c;
                pad.style.setProperty('--pad-color', this._rowColors[r]);

                // Side label: A or B
                if (c < 4) {
                    pad.classList.add('side-a');
                } else {
                    pad.classList.add('side-b');
                }

                const name = document.createElement('span');
                name.className = 'pad-name';
                pad.appendChild(name);

                this._padEls[r][c] = pad;
                row.appendChild(pad);
            }

            // Stop button (column 9)
            const stopBtn = document.createElement('button');
            stopBtn.className = 'perf-stop-btn';
            stopBtn.dataset.row = r;
            stopBtn.innerHTML = '<span class="stop-icon"></span>';
            row.appendChild(stopBtn);

            gridArea.appendChild(row);
        }

        // Scene labels row
        const sceneRow = document.createElement('div');
        sceneRow.className = 'perf-scene-labels';
        const spacer = document.createElement('div');
        spacer.className = 'perf-row-label';
        sceneRow.appendChild(spacer);
        for (let c = 0; c < 8; c++) {
            const sl = document.createElement('div');
            sl.className = 'perf-scene-label';
            sl.textContent = c < 4 ? `A${c + 1}` : `B${c - 3}`;
            sceneRow.appendChild(sl);
        }
        const stopSpacer = document.createElement('div');
        stopSpacer.className = 'perf-stop-btn-spacer';
        sceneRow.appendChild(stopSpacer);
        gridArea.appendChild(sceneRow);

        return gridArea;
    }

    _buildCrossfader() {
        const wrapper = document.createElement('div');
        wrapper.className = 'perf-crossfader';

        const labelA = document.createElement('span');
        labelA.className = 'perf-cf-label';
        labelA.textContent = 'A';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'perf-cf-slider';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.01';
        slider.value = '0.5';
        this._crossfaderEl = slider;

        const labelB = document.createElement('span');
        labelB.className = 'perf-cf-label';
        labelB.textContent = 'B';

        wrapper.appendChild(labelA);
        wrapper.appendChild(slider);
        wrapper.appendChild(labelB);
        return wrapper;
    }

    _buildMacros() {
        const wrapper = document.createElement('div');
        wrapper.className = 'perf-macros';

        const macroTitle = document.createElement('div');
        macroTitle.className = 'perf-macros-title';
        macroTitle.textContent = 'FX MACROS';
        wrapper.appendChild(macroTitle);

        const knobRow = document.createElement('div');
        knobRow.className = 'perf-knob-row';

        for (const name of Object.keys(this._macros)) {
            const knobGroup = document.createElement('div');
            knobGroup.className = 'perf-knob-group';

            const canvas = document.createElement('canvas');
            canvas.className = 'perf-knob-canvas';
            canvas.width = 64;
            canvas.height = 64;
            canvas.dataset.macro = name;
            this._knobCanvases[name] = canvas;

            const label = document.createElement('div');
            label.className = 'perf-knob-label';
            label.textContent = name;

            const valueLabel = document.createElement('div');
            valueLabel.className = 'perf-knob-value';
            valueLabel.textContent = '0%';
            valueLabel.id = `perf-macro-val-${name}`;

            knobGroup.appendChild(canvas);
            knobGroup.appendChild(label);
            knobGroup.appendChild(valueLabel);
            knobRow.appendChild(knobGroup);
        }

        wrapper.appendChild(knobRow);
        return wrapper;
    }

    // ── Macro Knobs ──────────────────────────────────────────────

    _initMacroKnobs() {
        for (const name of Object.keys(this._macros)) {
            const canvas = this._knobCanvases[name];
            this._knobStates[name] = { dragging: false, startY: 0, startValue: 0 };
            this._drawMacroKnob(canvas, 0, this._macros[name].color);
            this._bindKnob(name, canvas);
        }
    }

    _bindKnob(name, canvas) {
        const state = this._knobStates[name];

        const onPointerDown = (e) => {
            e.preventDefault();
            state.dragging = true;
            state.startY = e.clientY;
            state.startValue = this._macros[name].value;
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            canvas.setPointerCapture(e.pointerId);
        };

        const onPointerMove = (e) => {
            if (!state.dragging) return;
            const delta = (state.startY - e.clientY) / 150;
            const newVal = Math.max(0, Math.min(1, state.startValue + delta));
            this._macros[name].value = newVal;
            this._drawMacroKnob(canvas, newVal, this._macros[name].color);
            const valEl = document.getElementById(`perf-macro-val-${name}`);
            if (valEl) valEl.textContent = `${Math.round(newVal * 100)}%`;
            if (this._onMacroChange) this._onMacroChange(name, newVal);
        };

        const onPointerUp = () => {
            state.dragging = false;
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
        };

        canvas.addEventListener('pointerdown', onPointerDown);

        // Double-click to reset
        canvas.addEventListener('dblclick', () => {
            this._macros[name].value = 0;
            this._drawMacroKnob(canvas, 0, this._macros[name].color);
            const valEl = document.getElementById(`perf-macro-val-${name}`);
            if (valEl) valEl.textContent = '0%';
            if (this._onMacroChange) this._onMacroChange(name, 0);
        });
    }

    _drawMacroKnob(canvas, value, color = '#00d4ff') {
        const ctx = canvas.getContext('2d');
        const cx = 32, cy = 32, r = 26;
        const startAngle = 0.75 * Math.PI;
        const endAngle = 2.25 * Math.PI;
        const range = endAngle - startAngle;
        const normalized = Math.max(0, Math.min(1, value));
        const valueAngle = startAngle + normalized * range;

        ctx.clearRect(0, 0, 64, 64);

        // Background track arc
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Value arc
        if (normalized > 0.005) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, startAngle, valueAngle);
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Knob body
        ctx.beginPath();
        ctx.arc(cx, cy, 17, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1e2e';
        ctx.fill();
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Indicator line
        const ix = cx + Math.cos(valueAngle) * 13;
        const iy = cy + Math.sin(valueAngle) * 13;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ix, iy);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    // ── Event Binding ────────────────────────────────────────────

    _bindEvents() {
        // Pad clicks
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const pad = this._padEls[r][c];

                // Single click — queue for next bar
                pad.addEventListener('click', () => {
                    if (!this.grid[r][c]) return;
                    this.setQueued(r, c);
                    if (this._onClipTrigger) {
                        this._onClipTrigger(r, c, this.grid[r][c]);
                    }
                });

                // Double-click — immediate launch
                pad.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    if (!this.grid[r][c]) return;
                    this.clearQueued(r);
                    this.setPlaying(r, c);
                    if (this._onClipTrigger) {
                        this._onClipTrigger(r, c, this.grid[r][c]);
                    }
                });
            }
        }

        // Stop buttons
        this._root.querySelectorAll('.perf-stop-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = parseInt(btn.dataset.row, 10);
                this.setPlaying(row, null);
                this.clearQueued(row);
                this.activeClips[row] = null;
                if (this._onClipStop) this._onClipStop(row);
            });
        });

        // Crossfader
        this._crossfaderEl.addEventListener('input', () => {
            this.crossfade = parseFloat(this._crossfaderEl.value);
            if (this._onCrossfade) this._onCrossfade(this.crossfade);
        });
    }

    // ── Scoped CSS ───────────────────────────────────────────────

    _injectStyles() {
        if (document.getElementById('performance-view-styles')) return;

        const style = document.createElement('style');
        style.id = 'performance-view-styles';
        style.textContent = `
            .perf-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: #0d0d14;
                font-family: 'Courier New', monospace;
                color: #c8c8e0;
                overflow-y: auto;
            }

            /* ── Header ─────────────────────────────── */

            .perf-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                border-bottom: 1px solid #1a1a2e;
                flex-shrink: 0;
            }

            .perf-title-group {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .perf-live-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #ff3366;
                animation: perf-live-pulse 1.5s ease-in-out infinite;
            }

            @keyframes perf-live-pulse {
                0%, 100% { opacity: 1; box-shadow: 0 0 4px #ff3366; }
                50% { opacity: 0.4; box-shadow: 0 0 1px #ff3366; }
            }

            .perf-title {
                font-size: 11px;
                font-weight: bold;
                letter-spacing: 3px;
                color: #8888aa;
            }

            .perf-header-right {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .perf-beat-dots {
                display: flex;
                gap: 4px;
            }

            .perf-beat-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #1a1a2e;
                transition: background 0.05s;
            }

            .perf-beat-dot.active {
                background: #00d4ff;
                box-shadow: 0 0 4px #00d4ff;
            }

            .perf-bpm {
                font-size: 11px;
                color: #6666aa;
                letter-spacing: 1px;
            }

            /* ── Grid Area ──────────────────────────── */

            .perf-grid-area {
                padding: 8px;
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .perf-grid-row {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .perf-row-label {
                width: 52px;
                min-width: 52px;
                font-size: 9px;
                font-weight: bold;
                letter-spacing: 1px;
                text-align: right;
                padding-right: 6px;
            }

            .perf-scene-labels {
                display: flex;
                align-items: center;
                gap: 4px;
                padding-top: 2px;
            }

            .perf-scene-label {
                width: 64px;
                min-width: 64px;
                text-align: center;
                font-size: 8px;
                color: #444466;
                letter-spacing: 1px;
            }

            .perf-stop-btn-spacer {
                width: 40px;
                min-width: 40px;
            }

            /* ── Pads ───────────────────────────────── */

            .perf-pad {
                width: 64px;
                height: 64px;
                min-width: 64px;
                min-height: 64px;
                border-radius: 8px;
                border: 2px solid #1a1a2e;
                background: #111120;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 4px;
                transition: border-color 0.15s, background 0.15s;
                position: relative;
                overflow: hidden;
                outline: none;
            }

            .perf-pad:hover {
                border-color: #2a2a4a;
                background: #161628;
            }

            .perf-pad.loaded {
                background: color-mix(in srgb, var(--pad-color) 15%, #111120);
                border-color: color-mix(in srgb, var(--pad-color) 30%, #1a1a2e);
            }

            .perf-pad.loaded:hover {
                background: color-mix(in srgb, var(--pad-color) 25%, #111120);
                border-color: color-mix(in srgb, var(--pad-color) 50%, #1a1a2e);
            }

            .pad-name {
                font-size: 8px;
                font-family: 'Courier New', monospace;
                color: #aaaacc;
                text-align: center;
                word-break: break-all;
                line-height: 1.1;
                pointer-events: none;
            }

            /* Playing state */
            .perf-pad.playing {
                border-color: var(--pad-color);
                background: color-mix(in srgb, var(--pad-color) 30%, #111120);
                box-shadow: 0 0 12px color-mix(in srgb, var(--pad-color) 60%, transparent),
                            inset 0 0 8px color-mix(in srgb, var(--pad-color) 20%, transparent);
            }

            .perf-pad.playing.pulse {
                animation: perf-pad-pulse 0.4s ease-out;
            }

            @keyframes perf-pad-pulse {
                0% { box-shadow: 0 0 20px color-mix(in srgb, var(--pad-color) 80%, transparent),
                                 inset 0 0 12px color-mix(in srgb, var(--pad-color) 40%, transparent); }
                100% { box-shadow: 0 0 12px color-mix(in srgb, var(--pad-color) 60%, transparent),
                                   inset 0 0 8px color-mix(in srgb, var(--pad-color) 20%, transparent); }
            }

            /* Queued state */
            .perf-pad.queued {
                animation: perf-pad-queued 0.5s ease-in-out infinite;
            }

            @keyframes perf-pad-queued {
                0%, 100% { border-color: var(--pad-color); }
                50% { border-color: transparent; }
            }

            /* ── Stop Button ────────────────────────── */

            .perf-stop-btn {
                width: 40px;
                height: 64px;
                min-width: 40px;
                border-radius: 8px;
                border: 2px solid #331122;
                background: #1a0a10;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, border-color 0.15s;
                outline: none;
            }

            .perf-stop-btn:hover {
                background: #2a1020;
                border-color: #ff3366;
            }

            .perf-stop-btn:active {
                background: #3a1530;
            }

            .stop-icon {
                width: 12px;
                height: 12px;
                background: #ff3366;
                border-radius: 2px;
                display: block;
            }

            /* ── Crossfader ─────────────────────────── */

            .perf-crossfader {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                border-top: 1px solid #1a1a2e;
                flex-shrink: 0;
            }

            .perf-cf-label {
                font-size: 12px;
                font-weight: bold;
                color: #6666aa;
                letter-spacing: 2px;
                width: 16px;
                text-align: center;
            }

            .perf-cf-slider {
                flex: 1;
                -webkit-appearance: none;
                appearance: none;
                height: 8px;
                background: linear-gradient(to right, #00d4ff33, #1a1a2e 45%, #1a1a2e 55%, #ff336633);
                border-radius: 4px;
                outline: none;
                cursor: pointer;
            }

            .perf-cf-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 24px;
                height: 24px;
                border-radius: 4px;
                background: #1e1e2e;
                border: 2px solid #4444aa;
                cursor: grab;
                box-shadow: 0 0 6px #00000066;
            }

            .perf-cf-slider::-moz-range-thumb {
                width: 24px;
                height: 24px;
                border-radius: 4px;
                background: #1e1e2e;
                border: 2px solid #4444aa;
                cursor: grab;
                box-shadow: 0 0 6px #00000066;
            }

            .perf-cf-slider::-webkit-slider-thumb:active {
                cursor: grabbing;
                border-color: #00d4ff;
            }

            .perf-cf-slider::-moz-range-thumb:active {
                cursor: grabbing;
                border-color: #00d4ff;
            }

            /* ── Macro Knobs ────────────────────────── */

            .perf-macros {
                padding: 6px 12px 10px;
                border-top: 1px solid #1a1a2e;
                flex-shrink: 0;
            }

            .perf-macros-title {
                font-size: 9px;
                font-weight: bold;
                color: #555577;
                letter-spacing: 2px;
                margin-bottom: 6px;
            }

            .perf-knob-row {
                display: flex;
                justify-content: space-around;
                gap: 12px;
            }

            .perf-knob-group {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }

            .perf-knob-canvas {
                width: 64px;
                height: 64px;
                cursor: pointer;
                touch-action: none;
            }

            .perf-knob-label {
                font-size: 8px;
                font-weight: bold;
                color: #6666aa;
                letter-spacing: 1px;
            }

            .perf-knob-value {
                font-size: 9px;
                color: #555577;
            }
        `;

        document.head.appendChild(style);
    }
}
