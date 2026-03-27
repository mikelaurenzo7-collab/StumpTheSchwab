export default class AIPanel {
    constructor(container) {
        this.container = container;

        // State
        this._genre = 'Trap';
        this._key = 0;
        this._scale = 'Minor';
        this._mood = { dark_bright: 50, sparse_dense: 50, calm_energetic: 50 };
        this._density = 'medium';
        this._complexity = 3;
        this._variation = 50;

        // History
        this._undoStack = [];
        this._redoStack = [];

        // Callbacks
        this._onGenerateChords = null;
        this._onGenerateMelody = null;
        this._onGenerateBassline = null;
        this._onGenerateBeat = null;
        this._onSurprise = null;
        this._onMoodChange = null;
        this._onUndo = null;
        this._onRedo = null;

        this._injectStyles();
        this._buildDOM();
        this._initControls();
    }

    // ── Callback Registration ─────────────────────────────────────

    onGenerateChords(cb) { this._onGenerateChords = cb; }
    onGenerateMelody(cb) { this._onGenerateMelody = cb; }
    onGenerateBassline(cb) { this._onGenerateBassline = cb; }
    onGenerateBeat(cb) { this._onGenerateBeat = cb; }
    onSurprise(cb) { this._onSurprise = cb; }
    onMoodChange(cb) { this._onMoodChange = cb; }
    onUndo(cb) { this._onUndo = cb; }
    onRedo(cb) { this._onRedo = cb; }

    // ── Public Getters ────────────────────────────────────────────

    getKey() { return this._key; }
    getScale() { return this._scale; }
    getGenre() { return this._genre; }
    getMood() { return { ...this._mood }; }
    getDensity() { return this._density; }
    getComplexity() { return this._complexity; }
    getVariation() { return this._variation / 100; }

    setStatus(text) {
        const el = this._root.querySelector('.ai-status-text');
        if (el) el.textContent = text;
    }

    pushHistory(description) {
        this._undoStack.push(description);
        this._redoStack.length = 0;
        this.setStatus(description);
        this._updateHistoryButtons();
    }

    // ── Style Injection ───────────────────────────────────────────

    _injectStyles() {
        if (document.getElementById('ai-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'ai-panel-styles';
        style.textContent = `
            .ai-panel-root {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: #0a0a0f;
                border: 1px solid #1a1a2e;
                border-radius: 4px;
                overflow-y: auto;
                overflow-x: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                user-select: none;
                color: #e0e0e8;
                scrollbar-width: thin;
                scrollbar-color: #2a2a3a #0a0a0f;
            }
            .ai-panel-root::-webkit-scrollbar { width: 6px; }
            .ai-panel-root::-webkit-scrollbar-track { background: #0a0a0f; }
            .ai-panel-root::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; }

            /* ── Header ──────────────────────────────── */
            .ai-header {
                padding: 16px 12px 10px;
                text-align: center;
                border-bottom: 1px solid #1a1a2e;
                background: linear-gradient(180deg, #12121a 0%, #0a0a0f 100%);
                position: relative;
                overflow: hidden;
            }
            .ai-header::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 2px;
                background: linear-gradient(90deg, #00d4ff, #7b2fff, #ff6b35, #00d4ff);
                background-size: 300% 100%;
                animation: ai-header-shimmer 4s linear infinite;
            }
            @keyframes ai-header-shimmer {
                0% { background-position: 0% 0; }
                100% { background-position: 300% 0; }
            }
            .ai-header-title {
                font-family: 'Courier New', monospace;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 3px;
                color: #00d4ff;
                text-shadow: 0 0 12px rgba(0,212,255,0.3);
            }
            .ai-header-title .ai-icon {
                font-size: 15px;
                margin-right: 6px;
                filter: drop-shadow(0 0 4px rgba(0,212,255,0.5));
            }
            .ai-header-sub {
                font-family: 'Courier New', monospace;
                font-size: 9px;
                letter-spacing: 2px;
                color: #6a6a7a;
                margin-top: 3px;
            }

            /* ── Sections ────────────────────────────── */
            .ai-section {
                padding: 12px;
                border-bottom: 1px solid rgba(26,26,46,0.6);
            }
            .ai-section-label {
                font-family: 'Courier New', monospace;
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 2px;
                color: #6a6a7a;
                margin-bottom: 8px;
                text-transform: uppercase;
            }

            /* ── Selects ─────────────────────────────── */
            .ai-select-row {
                display: flex;
                gap: 6px;
                margin-bottom: 6px;
            }
            .ai-select-group {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .ai-select-group label {
                font-family: 'Courier New', monospace;
                font-size: 9px;
                color: #6a6a7a;
                letter-spacing: 1px;
            }
            .ai-select {
                width: 100%;
                background: #12121a;
                border: 1px solid #2a2a3a;
                border-radius: 4px;
                color: #e0e0e8;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                padding: 5px 6px;
                outline: none;
                cursor: pointer;
                transition: border-color 0.2s;
                -webkit-appearance: none;
                appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%236a6a7a' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 6px center;
            }
            .ai-select:hover { border-color: #00d4ff; }
            .ai-select:focus { border-color: #00d4ff; box-shadow: 0 0 6px rgba(0,212,255,0.15); }

            /* ── Mood Sliders ────────────────────────── */
            .ai-mood-axis {
                margin-bottom: 10px;
            }
            .ai-mood-axis:last-child { margin-bottom: 0; }
            .ai-mood-labels {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            .ai-mood-label {
                font-family: 'Courier New', monospace;
                font-size: 9px;
                font-weight: 700;
                letter-spacing: 1.5px;
            }
            .ai-mood-label-left { color: var(--mood-left-color); }
            .ai-mood-label-right { color: var(--mood-right-color); }
            .ai-mood-value {
                font-family: 'Courier New', monospace;
                font-size: 9px;
                color: #4a4a5a;
                min-width: 28px;
                text-align: center;
            }

            /* Custom range input for mood sliders */
            .ai-mood-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 6px;
                border-radius: 3px;
                outline: none;
                cursor: pointer;
                transition: box-shadow 0.2s;
            }
            .ai-mood-slider:hover {
                box-shadow: 0 0 10px var(--mood-glow-color, rgba(0,212,255,0.2));
            }
            .ai-mood-slider.mood-dark-bright {
                background: linear-gradient(90deg, #1a3a6e, #4488cc, #eecc44, #ffee88);
                --mood-glow-color: rgba(200,180,80,0.25);
            }
            .ai-mood-slider.mood-sparse-dense {
                background: linear-gradient(90deg, #1a2a1a, #33664d, #44bb77, #66ffaa);
                --mood-glow-color: rgba(80,200,130,0.25);
            }
            .ai-mood-slider.mood-calm-energetic {
                background: linear-gradient(90deg, #2a1a3a, #6644aa, #ee5533, #ff7744);
                --mood-glow-color: rgba(220,90,60,0.25);
            }

            /* Webkit thumb */
            .ai-mood-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #e0e0e8;
                border: 2px solid #0a0a0f;
                box-shadow: 0 0 6px rgba(255,255,255,0.2), 0 1px 3px rgba(0,0,0,0.5);
                cursor: grab;
                transition: transform 0.15s, box-shadow 0.15s;
            }
            .ai-mood-slider::-webkit-slider-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 0 12px rgba(255,255,255,0.35), 0 2px 6px rgba(0,0,0,0.5);
            }
            .ai-mood-slider:active::-webkit-slider-thumb { cursor: grabbing; }

            /* Firefox thumb */
            .ai-mood-slider::-moz-range-thumb {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #e0e0e8;
                border: 2px solid #0a0a0f;
                box-shadow: 0 0 6px rgba(255,255,255,0.2), 0 1px 3px rgba(0,0,0,0.5);
                cursor: grab;
            }
            .ai-mood-slider::-moz-range-track {
                height: 6px;
                border-radius: 3px;
                border: none;
            }

            /* ── Generation Buttons ──────────────────── */
            .ai-gen-buttons {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .ai-gen-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                padding: 10px 12px;
                border: 1px solid transparent;
                border-radius: 6px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 1.5px;
                color: #fff;
                cursor: pointer;
                transition: all 0.25s ease;
                position: relative;
                overflow: hidden;
                text-transform: uppercase;
            }
            .ai-gen-btn::before {
                content: '';
                position: absolute;
                inset: 0;
                opacity: 0;
                transition: opacity 0.25s;
                border-radius: 6px;
            }
            .ai-gen-btn:hover::before { opacity: 1; }
            .ai-gen-btn:active { transform: scale(0.98); }
            .ai-gen-btn .ai-gen-icon {
                font-size: 16px;
                width: 22px;
                text-align: center;
                flex-shrink: 0;
            }

            .ai-gen-btn.btn-chords {
                background: linear-gradient(135deg, rgba(0,180,220,0.18), rgba(0,212,255,0.08));
                border-color: rgba(0,212,255,0.3);
                text-shadow: 0 0 8px rgba(0,212,255,0.3);
            }
            .ai-gen-btn.btn-chords::before {
                box-shadow: inset 0 0 20px rgba(0,212,255,0.15), 0 0 15px rgba(0,212,255,0.2);
            }
            .ai-gen-btn.btn-chords:hover {
                border-color: rgba(0,212,255,0.6);
                box-shadow: 0 0 20px rgba(0,212,255,0.2);
            }

            .ai-gen-btn.btn-melody {
                background: linear-gradient(135deg, rgba(100,30,220,0.18), rgba(123,47,255,0.08));
                border-color: rgba(123,47,255,0.3);
                text-shadow: 0 0 8px rgba(123,47,255,0.3);
            }
            .ai-gen-btn.btn-melody::before {
                box-shadow: inset 0 0 20px rgba(123,47,255,0.15), 0 0 15px rgba(123,47,255,0.2);
            }
            .ai-gen-btn.btn-melody:hover {
                border-color: rgba(123,47,255,0.6);
                box-shadow: 0 0 20px rgba(123,47,255,0.2);
            }

            .ai-gen-btn.btn-bass {
                background: linear-gradient(135deg, rgba(220,90,20,0.18), rgba(255,107,53,0.08));
                border-color: rgba(255,107,53,0.3);
                text-shadow: 0 0 8px rgba(255,107,53,0.3);
            }
            .ai-gen-btn.btn-bass::before {
                box-shadow: inset 0 0 20px rgba(255,107,53,0.15), 0 0 15px rgba(255,107,53,0.2);
            }
            .ai-gen-btn.btn-bass:hover {
                border-color: rgba(255,107,53,0.6);
                box-shadow: 0 0 20px rgba(255,107,53,0.2);
            }

            .ai-gen-btn.btn-beat {
                background: linear-gradient(135deg, rgba(220,30,70,0.18), rgba(255,51,102,0.08));
                border-color: rgba(255,51,102,0.3);
                text-shadow: 0 0 8px rgba(255,51,102,0.3);
            }
            .ai-gen-btn.btn-beat::before {
                box-shadow: inset 0 0 20px rgba(255,51,102,0.15), 0 0 15px rgba(255,51,102,0.2);
            }
            .ai-gen-btn.btn-beat:hover {
                border-color: rgba(255,51,102,0.6);
                box-shadow: 0 0 20px rgba(255,51,102,0.2);
            }

            .ai-gen-btn.btn-surprise {
                background: linear-gradient(135deg,
                    rgba(0,212,255,0.12),
                    rgba(123,47,255,0.12),
                    rgba(255,107,53,0.12),
                    rgba(255,51,102,0.12));
                border-color: rgba(180,120,255,0.3);
                text-shadow: 0 0 8px rgba(180,120,255,0.3);
                background-size: 300% 300%;
                animation: ai-surprise-shift 6s ease infinite;
            }
            @keyframes ai-surprise-shift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            .ai-gen-btn.btn-surprise::before {
                box-shadow: inset 0 0 20px rgba(180,120,255,0.15), 0 0 15px rgba(180,120,255,0.2);
            }
            .ai-gen-btn.btn-surprise:hover {
                border-color: rgba(180,120,255,0.6);
                box-shadow: 0 0 25px rgba(180,120,255,0.25);
            }

            /* ── Density Toggle Group ────────────────── */
            .ai-toggle-group {
                display: flex;
                gap: 0;
                border-radius: 4px;
                overflow: hidden;
                border: 1px solid #2a2a3a;
            }
            .ai-toggle-btn {
                flex: 1;
                padding: 6px 4px;
                background: #12121a;
                border: none;
                color: #6a6a7a;
                font-family: 'Courier New', monospace;
                font-size: 9px;
                font-weight: 600;
                letter-spacing: 1px;
                cursor: pointer;
                transition: all 0.2s;
                text-transform: uppercase;
            }
            .ai-toggle-btn:not(:last-child) {
                border-right: 1px solid #2a2a3a;
            }
            .ai-toggle-btn.active {
                background: rgba(0,212,255,0.15);
                color: #00d4ff;
                text-shadow: 0 0 6px rgba(0,212,255,0.3);
            }
            .ai-toggle-btn:hover:not(.active) {
                background: #1a1a25;
                color: #9a9aaa;
            }

            /* ── Small Sliders ───────────────────────── */
            .ai-slider-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 8px;
            }
            .ai-slider-label {
                font-family: 'Courier New', monospace;
                font-size: 9px;
                color: #6a6a7a;
                letter-spacing: 1px;
                min-width: 62px;
                flex-shrink: 0;
            }
            .ai-slider-value {
                font-family: 'Courier New', monospace;
                font-size: 9px;
                color: #e0e0e8;
                min-width: 28px;
                text-align: right;
                flex-shrink: 0;
            }
            .ai-slider {
                -webkit-appearance: none;
                appearance: none;
                flex: 1;
                height: 4px;
                border-radius: 2px;
                background: #1a1a2e;
                outline: none;
                cursor: pointer;
            }
            .ai-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #e0e0e8;
                border: 2px solid #0a0a0f;
                box-shadow: 0 0 4px rgba(255,255,255,0.15);
                cursor: pointer;
            }
            .ai-slider::-moz-range-thumb {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #e0e0e8;
                border: 2px solid #0a0a0f;
                cursor: pointer;
            }
            .ai-slider:hover::-webkit-slider-thumb {
                box-shadow: 0 0 8px rgba(0,212,255,0.3);
            }

            /* ── History Section ─────────────────────── */
            .ai-history-row {
                display: flex;
                gap: 6px;
                margin-bottom: 6px;
            }
            .ai-hist-btn {
                flex: 1;
                padding: 7px 8px;
                border-radius: 4px;
                border: 1px solid #2a2a3a;
                background: #12121a;
                color: #6a6a7a;
                font-family: 'Courier New', monospace;
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 1.5px;
                cursor: pointer;
                transition: all 0.2s;
                text-transform: uppercase;
            }
            .ai-hist-btn:hover:not(:disabled) {
                border-color: #3a3a5a;
                color: #e0e0e8;
                background: #1a1a25;
            }
            .ai-hist-btn:disabled {
                opacity: 0.35;
                cursor: default;
            }
            .ai-status-text {
                font-family: 'Courier New', monospace;
                font-size: 9px;
                color: #4a4a5a;
                font-style: italic;
                text-align: center;
                min-height: 13px;
                line-height: 1.3;
                word-break: break-word;
            }

            /* ── Pulse animation on generate ─────────── */
            @keyframes ai-btn-pulse {
                0% { box-shadow: 0 0 0 0 var(--pulse-color); }
                70% { box-shadow: 0 0 0 8px transparent; }
                100% { box-shadow: 0 0 0 0 transparent; }
            }
            .ai-gen-btn.pulsing {
                animation: ai-btn-pulse 0.5s ease-out;
            }
        `;
        document.head.appendChild(style);
    }

    // ── DOM Construction ──────────────────────────────────────────

    _buildDOM() {
        const root = document.createElement('div');
        root.className = 'ai-panel-root';

        root.innerHTML = `
            ${this._headerHTML()}
            ${this._genreKeyHTML()}
            ${this._moodHTML()}
            ${this._genButtonsHTML()}
            ${this._densityHTML()}
            ${this._historyHTML()}
        `;

        this.container.appendChild(root);
        this._root = root;
    }

    _headerHTML() {
        return `
        <div class="ai-header">
            <div class="ai-header-title">
                <span class="ai-icon">\u2728</span>AI COMPOSER
            </div>
            <div class="ai-header-sub">POWERED BY NOVA INTELLIGENCE</div>
        </div>`;
    }

    _genreKeyHTML() {
        const genres = ['Trap', 'House', 'Boom Bap', 'R&B', 'Drill', 'Lo-fi', 'Pop', 'DnB'];
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const scales = ['Major', 'Minor', 'Dorian', 'Mixolydian', 'Pentatonic Minor', 'Blues'];

        const genreOpts = genres.map(g =>
            `<option value="${g}"${g === this._genre ? ' selected' : ''}>${g}</option>`
        ).join('');

        const keyOpts = keys.map((k, i) =>
            `<option value="${i}"${i === this._key ? ' selected' : ''}>${k}</option>`
        ).join('');

        const scaleOpts = scales.map(s =>
            `<option value="${s}"${s === this._scale ? ' selected' : ''}>${s}</option>`
        ).join('');

        return `
        <div class="ai-section">
            <div class="ai-section-label">GENRE &amp; KEY</div>
            <div class="ai-select-row">
                <div class="ai-select-group">
                    <label>GENRE</label>
                    <select class="ai-select" data-param="genre">${genreOpts}</select>
                </div>
            </div>
            <div class="ai-select-row">
                <div class="ai-select-group">
                    <label>KEY</label>
                    <select class="ai-select" data-param="key">${keyOpts}</select>
                </div>
                <div class="ai-select-group">
                    <label>SCALE</label>
                    <select class="ai-select" data-param="scale">${scaleOpts}</select>
                </div>
            </div>
        </div>`;
    }

    _moodHTML() {
        const axes = [
            {
                id: 'dark_bright',
                cls: 'mood-dark-bright',
                left: 'DARK',
                right: 'BRIGHT',
                leftColor: '#4488cc',
                rightColor: '#eecc44'
            },
            {
                id: 'sparse_dense',
                cls: 'mood-sparse-dense',
                left: 'SPARSE',
                right: 'DENSE',
                leftColor: '#33664d',
                rightColor: '#66ffaa'
            },
            {
                id: 'calm_energetic',
                cls: 'mood-calm-energetic',
                left: 'CALM',
                right: 'ENERGETIC',
                leftColor: '#6644aa',
                rightColor: '#ff7744'
            }
        ];

        const sliders = axes.map(a => `
            <div class="ai-mood-axis" style="--mood-left-color:${a.leftColor};--mood-right-color:${a.rightColor};">
                <div class="ai-mood-labels">
                    <span class="ai-mood-label ai-mood-label-left">\u25C4 ${a.left}</span>
                    <span class="ai-mood-value" data-mood-val="${a.id}">50</span>
                    <span class="ai-mood-label ai-mood-label-right">${a.right} \u25BA</span>
                </div>
                <input type="range" min="0" max="100" value="50"
                    class="ai-mood-slider ${a.cls}" data-mood="${a.id}">
            </div>
        `).join('');

        return `
        <div class="ai-section">
            <div class="ai-section-label">\u2728 MOOD CONTROLLER</div>
            ${sliders}
        </div>`;
    }

    _genButtonsHTML() {
        return `
        <div class="ai-section">
            <div class="ai-section-label">GENERATE</div>
            <div class="ai-gen-buttons">
                <button class="ai-gen-btn btn-chords" data-gen="chords" style="--pulse-color:rgba(0,212,255,0.4);">
                    <span class="ai-gen-icon">\uD83C\uDFB9</span> GENERATE CHORDS
                </button>
                <button class="ai-gen-btn btn-melody" data-gen="melody" style="--pulse-color:rgba(123,47,255,0.4);">
                    <span class="ai-gen-icon">\uD83C\uDFB5</span> GENERATE MELODY
                </button>
                <button class="ai-gen-btn btn-bass" data-gen="bassline" style="--pulse-color:rgba(255,107,53,0.4);">
                    <span class="ai-gen-icon">\uD83C\uDFB8</span> GENERATE BASSLINE
                </button>
                <button class="ai-gen-btn btn-beat" data-gen="beat" style="--pulse-color:rgba(255,51,102,0.4);">
                    <span class="ai-gen-icon">\uD83E\uDD41</span> GENERATE BEAT
                </button>
                <button class="ai-gen-btn btn-surprise" data-gen="surprise" style="--pulse-color:rgba(180,120,255,0.4);">
                    <span class="ai-gen-icon">\uD83C\uDFB2</span> SURPRISE ME
                </button>
            </div>
        </div>`;
    }

    _densityHTML() {
        const densities = ['sparse', 'medium', 'dense'];

        const toggleBtns = densities.map(d =>
            `<button class="ai-toggle-btn${d === this._density ? ' active' : ''}" data-density="${d}">${d}</button>`
        ).join('');

        return `
        <div class="ai-section">
            <div class="ai-section-label">DENSITY &amp; COMPLEXITY</div>
            <div style="margin-bottom: 4px;">
                <label class="ai-slider-label" style="display:block;margin-bottom:4px;">MELODY DENSITY</label>
                <div class="ai-toggle-group">${toggleBtns}</div>
            </div>
            <div class="ai-slider-row">
                <span class="ai-slider-label">BEAT CMPLX</span>
                <input type="range" min="1" max="5" value="${this._complexity}" step="1"
                    class="ai-slider" data-param="complexity">
                <span class="ai-slider-value" data-val="complexity">${this._complexity}</span>
            </div>
            <div class="ai-slider-row">
                <span class="ai-slider-label">VARIATION</span>
                <input type="range" min="0" max="100" value="${this._variation}" step="1"
                    class="ai-slider" data-param="variation">
                <span class="ai-slider-value" data-val="variation">${this._variation}%</span>
            </div>
        </div>`;
    }

    _historyHTML() {
        return `
        <div class="ai-section" style="border-bottom:none;">
            <div class="ai-section-label">HISTORY</div>
            <div class="ai-history-row">
                <button class="ai-hist-btn" data-hist="undo" disabled>\u21A9 UNDO</button>
                <button class="ai-hist-btn" data-hist="redo" disabled>REDO \u21AA</button>
            </div>
            <div class="ai-status-text">Ready to compose</div>
        </div>`;
    }

    // ── Event Wiring ──────────────────────────────────────────────

    _initControls() {
        // Genre / Key / Scale selects
        this._root.querySelector('[data-param="genre"]').addEventListener('change', e => {
            this._genre = e.target.value;
        });
        this._root.querySelector('[data-param="key"]').addEventListener('change', e => {
            this._key = parseInt(e.target.value, 10);
        });
        this._root.querySelector('[data-param="scale"]').addEventListener('change', e => {
            this._scale = e.target.value;
        });

        // Mood sliders
        this._root.querySelectorAll('.ai-mood-slider').forEach(slider => {
            const id = slider.dataset.mood;
            const valEl = this._root.querySelector(`[data-mood-val="${id}"]`);

            const handleInput = () => {
                const v = parseInt(slider.value, 10);
                this._mood[id] = v;
                if (valEl) valEl.textContent = v;
                if (this._onMoodChange) {
                    this._onMoodChange(this.getMood());
                }
            };

            slider.addEventListener('input', handleInput);
        });

        // Generate buttons
        this._root.querySelectorAll('.ai-gen-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Pulse animation
                btn.classList.remove('pulsing');
                void btn.offsetWidth; // reflow
                btn.classList.add('pulsing');

                const gen = btn.dataset.gen;
                this._fireGenerate(gen);
            });
        });

        // Density toggle
        this._root.querySelectorAll('.ai-toggle-btn[data-density]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._root.querySelectorAll('.ai-toggle-btn[data-density]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._density = btn.dataset.density;
            });
        });

        // Complexity slider
        const complexSlider = this._root.querySelector('[data-param="complexity"]');
        const complexVal = this._root.querySelector('[data-val="complexity"]');
        complexSlider.addEventListener('input', () => {
            this._complexity = parseInt(complexSlider.value, 10);
            complexVal.textContent = this._complexity;
        });

        // Variation slider
        const varSlider = this._root.querySelector('[data-param="variation"]');
        const varVal = this._root.querySelector('[data-val="variation"]');
        varSlider.addEventListener('input', () => {
            this._variation = parseInt(varSlider.value, 10);
            varVal.textContent = this._variation + '%';
        });

        // Undo / Redo
        this._root.querySelector('[data-hist="undo"]').addEventListener('click', () => {
            if (this._undoStack.length === 0) return;
            const action = this._undoStack.pop();
            this._redoStack.push(action);
            this._updateHistoryButtons();
            this.setStatus('Undid: ' + action);
            if (this._onUndo) this._onUndo();
        });

        this._root.querySelector('[data-hist="redo"]').addEventListener('click', () => {
            if (this._redoStack.length === 0) return;
            const action = this._redoStack.pop();
            this._undoStack.push(action);
            this._updateHistoryButtons();
            this.setStatus('Redid: ' + action);
            if (this._onRedo) this._onRedo();
        });
    }

    _fireGenerate(type) {
        const mood = this.getMood();
        const bars = 4;

        switch (type) {
            case 'chords':
                if (this._onGenerateChords) {
                    this._onGenerateChords(this._key, this._scale, mood, bars);
                }
                break;
            case 'melody':
                if (this._onGenerateMelody) {
                    this._onGenerateMelody(null, this._scale, this._key, this._density, bars);
                }
                break;
            case 'bassline':
                if (this._onGenerateBassline) {
                    this._onGenerateBassline(null, this._genre, this._key);
                }
                break;
            case 'beat':
                if (this._onGenerateBeat) {
                    this._onGenerateBeat(this._genre, this._complexity, this.getVariation());
                }
                break;
            case 'surprise':
                this._randomizeAll();
                if (this._onSurprise) {
                    this._onSurprise();
                }
                break;
        }
    }

    _randomizeAll() {
        // Randomize genre
        const genreSelect = this._root.querySelector('[data-param="genre"]');
        const randIdx = Math.floor(Math.random() * genreSelect.options.length);
        genreSelect.selectedIndex = randIdx;
        this._genre = genreSelect.value;

        // Randomize key
        const keySelect = this._root.querySelector('[data-param="key"]');
        keySelect.selectedIndex = Math.floor(Math.random() * 12);
        this._key = parseInt(keySelect.value, 10);

        // Randomize scale
        const scaleSelect = this._root.querySelector('[data-param="scale"]');
        scaleSelect.selectedIndex = Math.floor(Math.random() * scaleSelect.options.length);
        this._scale = scaleSelect.value;

        // Randomize mood sliders
        this._root.querySelectorAll('.ai-mood-slider').forEach(slider => {
            const v = Math.floor(Math.random() * 101);
            slider.value = v;
            const id = slider.dataset.mood;
            this._mood[id] = v;
            const valEl = this._root.querySelector(`[data-mood-val="${id}"]`);
            if (valEl) valEl.textContent = v;
        });

        // Randomize density
        const densities = ['sparse', 'medium', 'dense'];
        this._density = densities[Math.floor(Math.random() * 3)];
        this._root.querySelectorAll('.ai-toggle-btn[data-density]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.density === this._density);
        });

        // Randomize complexity
        this._complexity = Math.floor(Math.random() * 5) + 1;
        const complexSlider = this._root.querySelector('[data-param="complexity"]');
        complexSlider.value = this._complexity;
        this._root.querySelector('[data-val="complexity"]').textContent = this._complexity;

        // Randomize variation
        this._variation = Math.floor(Math.random() * 101);
        const varSlider = this._root.querySelector('[data-param="variation"]');
        varSlider.value = this._variation;
        this._root.querySelector('[data-val="variation"]').textContent = this._variation + '%';

        // Fire mood change
        if (this._onMoodChange) {
            this._onMoodChange(this.getMood());
        }

        this.setStatus('Randomized all parameters');
    }

    _updateHistoryButtons() {
        const undoBtn = this._root.querySelector('[data-hist="undo"]');
        const redoBtn = this._root.querySelector('[data-hist="redo"]');
        undoBtn.disabled = this._undoStack.length === 0;
        redoBtn.disabled = this._redoStack.length === 0;
    }
}
