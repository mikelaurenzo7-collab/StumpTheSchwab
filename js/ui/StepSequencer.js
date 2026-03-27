export default class StepSequencer {
    constructor(container) {
        this.container = container;
        this.steps = 16;
        this.currentPattern = 0;
        this.currentStep = -1;

        this.rows = [
            { name: 'kick', label: 'KICK', color: '#ff3366' },
            { name: 'snare', label: 'SNARE', color: '#ffaa00' },
            { name: 'hihatC', label: 'HI-HAT', color: '#00d4ff' },
            { name: 'hihatO', label: 'OH-HAT', color: '#00b8d4' },
            { name: 'clap', label: 'CLAP', color: '#7b2fff' },
            { name: 'rim', label: 'RIM', color: '#ff6600' },
            { name: 'tom', label: 'TOM', color: '#00ff88' },
            { name: 'cymbal', label: 'CYMBAL', color: '#ff00aa' }
        ];

        // 4 patterns, each is a 2D grid [rows][steps]
        this.patterns = [];
        for (let p = 0; p < 4; p++) {
            const pattern = {};
            for (const row of this.rows) {
                pattern[row.name] = new Array(this.steps).fill(null);
            }
            this.patterns.push(pattern);
        }

        // Callbacks
        this._onStepChange = null;
        this._onSwingChange = null;
        this._onGenreSelect = null;
        this._onClear = null;

        // Cell references for fast updates
        this.cells = {}; // cells[soundName][step] = element

        this.buildDOM();
        this.bindEvents();
    }

    // ── DOM Construction ─────────────────────────────────────────

    buildDOM() {
        const seq = document.createElement('div');
        seq.className = 'sequencer-container';

        // Header
        seq.appendChild(this.buildHeader());

        // Grid
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'sequencer-grid';
        gridWrapper.appendChild(this.buildStepNumbers());

        for (const row of this.rows) {
            gridWrapper.appendChild(this.buildRow(row));
        }

        seq.appendChild(gridWrapper);

        // Playhead overlay
        const playhead = document.createElement('div');
        playhead.className = 'playhead-overlay';
        playhead.id = 'playhead-overlay';
        this.playheadEl = playhead;
        seq.appendChild(playhead);

        this.el = seq;
        this.container.appendChild(seq);
    }

    buildHeader() {
        const header = document.createElement('div');
        header.className = 'sequencer-header';

        // Pattern controls
        const patternControls = document.createElement('div');
        patternControls.className = 'pattern-controls';

        const patternLabel = document.createElement('span');
        patternLabel.className = 'seq-label';
        patternLabel.textContent = 'PATTERN';
        patternControls.appendChild(patternLabel);

        const patternLetters = ['A', 'B', 'C', 'D'];
        this.patternBtns = [];
        for (let i = 0; i < 4; i++) {
            const btn = document.createElement('button');
            btn.className = 'pattern-btn' + (i === 0 ? ' active' : '');
            btn.dataset.pattern = i;
            btn.textContent = patternLetters[i];
            this.patternBtns.push(btn);
            patternControls.appendChild(btn);
        }
        header.appendChild(patternControls);

        // Swing control
        const swingControl = document.createElement('div');
        swingControl.className = 'swing-control';

        const swingLabel = document.createElement('label');
        swingLabel.className = 'seq-label';
        swingLabel.textContent = 'SWING';
        swingControl.appendChild(swingLabel);

        const swingSlider = document.createElement('input');
        swingSlider.type = 'range';
        swingSlider.min = '0';
        swingSlider.max = '100';
        swingSlider.value = '0';
        swingSlider.className = 'swing-slider';
        swingSlider.id = 'swing-slider';
        this.swingSlider = swingSlider;
        swingControl.appendChild(swingSlider);

        const swingValue = document.createElement('span');
        swingValue.className = 'swing-value';
        swingValue.id = 'swing-value';
        swingValue.textContent = '0%';
        this.swingValueEl = swingValue;
        swingControl.appendChild(swingValue);

        header.appendChild(swingControl);

        // Genre presets
        const genrePresets = document.createElement('div');
        genrePresets.className = 'genre-presets';

        const genreLabel = document.createElement('label');
        genreLabel.className = 'seq-label';
        genreLabel.textContent = 'GENRE';
        genrePresets.appendChild(genreLabel);

        const genreSelect = document.createElement('select');
        genreSelect.id = 'genre-select';
        genreSelect.className = 'genre-select';

        const genres = [
            { value: '', text: '-- Select --' },
            { value: 'trap', text: 'Trap' },
            { value: 'house', text: 'House' },
            { value: 'boombap', text: 'Boom Bap' },
            { value: 'rnb', text: 'R&B' },
            { value: 'drill', text: 'Drill' },
            { value: 'lofi', text: 'Lo-fi' }
        ];
        for (const g of genres) {
            const opt = document.createElement('option');
            opt.value = g.value;
            opt.textContent = g.text;
            genreSelect.appendChild(opt);
        }
        this.genreSelect = genreSelect;
        genrePresets.appendChild(genreSelect);

        header.appendChild(genrePresets);

        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.className = 'seq-btn';
        clearBtn.id = 'clear-pattern';
        clearBtn.title = 'Clear Pattern';
        clearBtn.textContent = 'CLEAR';
        this.clearBtn = clearBtn;
        header.appendChild(clearBtn);

        return header;
    }

    buildStepNumbers() {
        const row = document.createElement('div');
        row.className = 'step-numbers';

        const spacer = document.createElement('div');
        spacer.className = 'row-label-spacer';
        row.appendChild(spacer);

        for (let i = 0; i < this.steps; i++) {
            const num = document.createElement('div');
            num.className = 'step-num';
            num.textContent = i + 1;
            row.appendChild(num);
        }
        return row;
    }

    buildRow(rowDef) {
        const row = document.createElement('div');
        row.className = 'seq-row';
        row.dataset.sound = rowDef.name;

        const label = document.createElement('div');
        label.className = 'row-label';
        label.style.color = rowDef.color;
        label.textContent = rowDef.label;
        row.appendChild(label);

        this.cells[rowDef.name] = [];

        for (let i = 0; i < this.steps; i++) {
            const cell = document.createElement('div');
            cell.className = 'seq-cell';
            cell.dataset.step = i;
            cell.dataset.sound = rowDef.name;

            // Beat grouping: first step of each group of 4 gets a left border
            if (i % 4 === 0) {
                cell.classList.add('beat-start');
            }

            this.cells[rowDef.name].push(cell);
            row.appendChild(cell);
        }

        return row;
    }

    // ── Events ───────────────────────────────────────────────────

    bindEvents() {
        // Cell click (left) — toggle step
        this.el.addEventListener('click', (e) => {
            const cell = e.target.closest('.seq-cell');
            if (!cell) return;

            const sound = cell.dataset.sound;
            const step = parseInt(cell.dataset.step, 10);
            const pattern = this.patterns[this.currentPattern];
            const current = pattern[sound][step];

            if (current !== null) {
                // Turn off
                pattern[sound][step] = null;
                this.updateCellVisual(sound, step);
            } else {
                // Turn on with default velocity
                pattern[sound][step] = 0.8;
                this.updateCellVisual(sound, step);
            }

            if (this._onStepChange) {
                this._onStepChange(sound, step, pattern[sound][step]);
            }
        });

        // Cell right-click — cycle velocity
        this.el.addEventListener('contextmenu', (e) => {
            const cell = e.target.closest('.seq-cell');
            if (!cell) return;

            e.preventDefault();

            const sound = cell.dataset.sound;
            const step = parseInt(cell.dataset.step, 10);
            const pattern = this.patterns[this.currentPattern];
            const current = pattern[sound][step];

            if (current === null) return; // only cycle if active

            const velocities = [0.4, 0.6, 0.8, 1.0];
            const idx = velocities.indexOf(current);
            const next = velocities[(idx + 1) % velocities.length];
            pattern[sound][step] = next;
            this.updateCellVisual(sound, step);

            if (this._onStepChange) {
                this._onStepChange(sound, step, next);
            }
        });

        // Pattern buttons
        for (const btn of this.patternBtns) {
            btn.addEventListener('click', () => {
                const newPattern = parseInt(btn.dataset.pattern, 10);
                if (newPattern === this.currentPattern) return;

                // Switch active class
                this.patternBtns[this.currentPattern].classList.remove('active');
                btn.classList.add('active');

                this.currentPattern = newPattern;
                this.refreshAllCells();
            });
        }

        // Swing slider
        this.swingSlider.addEventListener('input', () => {
            const val = parseInt(this.swingSlider.value, 10);
            this.swingValueEl.textContent = val + '%';
            if (this._onSwingChange) {
                this._onSwingChange(val);
            }
        });

        // Genre select
        this.genreSelect.addEventListener('change', () => {
            const genre = this.genreSelect.value;
            if (genre && this._onGenreSelect) {
                this._onGenreSelect(genre);
            }
        });

        // Clear button
        this.clearBtn.addEventListener('click', () => {
            const pattern = this.patterns[this.currentPattern];
            for (const row of this.rows) {
                pattern[row.name].fill(null);
            }
            this.refreshAllCells();
            if (this._onClear) {
                this._onClear();
            }
        });
    }

    // ── Visual Helpers ───────────────────────────────────────────

    updateCellVisual(soundName, step) {
        const cell = this.cells[soundName][step];
        const velocity = this.patterns[this.currentPattern][soundName][step];
        const rowDef = this.rows.find(r => r.name === soundName);

        if (velocity !== null) {
            cell.classList.add('active');
            cell.style.backgroundColor = rowDef.color;
            cell.style.opacity = velocity;
        } else {
            cell.classList.remove('active');
            cell.style.backgroundColor = '';
            cell.style.opacity = '';
        }
    }

    refreshAllCells() {
        for (const row of this.rows) {
            for (let s = 0; s < this.steps; s++) {
                this.updateCellVisual(row.name, s);
            }
        }
    }

    // ── Public API ───────────────────────────────────────────────

    setStep(soundName, step, velocity) {
        this.patterns[this.currentPattern][soundName][step] = velocity;
        this.updateCellVisual(soundName, step);
    }

    getStep(soundName, step) {
        return this.patterns[this.currentPattern][soundName][step];
    }

    setPattern(patternData) {
        const pattern = this.patterns[this.currentPattern];
        for (const row of this.rows) {
            if (patternData[row.name]) {
                for (let s = 0; s < this.steps; s++) {
                    pattern[row.name][s] = patternData[row.name][s] !== undefined
                        ? patternData[row.name][s]
                        : null;
                }
            } else {
                pattern[row.name].fill(null);
            }
        }
        this.refreshAllCells();
    }

    getPattern() {
        const pattern = this.patterns[this.currentPattern];
        const out = {};
        for (const row of this.rows) {
            out[row.name] = [...pattern[row.name]];
        }
        return out;
    }

    highlightStep(stepIndex) {
        // Remove previous highlight
        if (this.currentStep >= 0) {
            for (const row of this.rows) {
                this.cells[row.name][this.currentStep].classList.remove('playing');
            }
        }

        this.currentStep = stepIndex;

        if (stepIndex < 0 || stepIndex >= this.steps) {
            this.playheadEl.style.display = 'none';
            return;
        }

        // Add highlight to new column
        for (const row of this.rows) {
            this.cells[row.name][stepIndex].classList.add('playing');
        }

        // Move playhead overlay to column position
        // Offset: row-label width (60px) + step * cell width (32px)
        const offset = 60 + stepIndex * 32;
        this.playheadEl.style.display = 'block';
        this.playheadEl.style.left = offset + 'px';
    }

    clearHighlight() {
        if (this.currentStep >= 0) {
            for (const row of this.rows) {
                this.cells[row.name][this.currentStep].classList.remove('playing');
            }
        }
        this.currentStep = -1;
        this.playheadEl.style.display = 'none';
    }

    setSwing(value) {
        this.swingSlider.value = value;
        this.swingValueEl.textContent = value + '%';
    }

    // ── Callback Registration ────────────────────────────────────

    onStepChange(callback) {
        this._onStepChange = callback;
    }

    onSwingChange(callback) {
        this._onSwingChange = callback;
    }

    onGenreSelect(callback) {
        this._onGenreSelect = callback;
    }

    onClear(callback) {
        this._onClear = callback;
    }
}
