export default class KeyboardHelp {
    constructor() {
        this._visible = false;
        this._injectStyles();
        this._buildDOM();
        this._bindEvents();
    }

    // ── Public API ───────────────────────────────────────────────────

    get isVisible() {
        return this._visible;
    }

    show() {
        this._overlay.classList.add('kb-help--visible');
        this._visible = true;
    }

    hide() {
        this._overlay.classList.remove('kb-help--visible');
        this._visible = false;
    }

    toggle() {
        this._visible ? this.hide() : this.show();
    }

    // ── Style Injection ──────────────────────────────────────────────

    _injectStyles() {
        if (document.getElementById('kb-help-styles')) return;
        const style = document.createElement('style');
        style.id = 'kb-help-styles';
        style.textContent = `
            .kb-help-overlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                background: rgba(10, 10, 15, 0.92);
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
                font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace;
            }
            .kb-help-overlay.kb-help--visible {
                opacity: 1;
                pointer-events: auto;
            }

            .kb-help-modal {
                background: #12121a;
                border: 1px solid rgba(0, 212, 255, 0.15);
                border-radius: 16px;
                padding: 36px 44px 40px;
                max-width: 920px;
                width: 90vw;
                max-height: 88vh;
                overflow-y: auto;
                position: relative;
                box-shadow:
                    0 0 60px rgba(0, 212, 255, 0.06),
                    0 0 120px rgba(123, 47, 255, 0.04),
                    0 24px 80px rgba(0, 0, 0, 0.5);
            }
            .kb-help-modal::-webkit-scrollbar { width: 6px; }
            .kb-help-modal::-webkit-scrollbar-track { background: transparent; }
            .kb-help-modal::-webkit-scrollbar-thumb {
                background: rgba(0, 212, 255, 0.2);
                border-radius: 3px;
            }

            .kb-help-close {
                position: absolute;
                top: 16px;
                right: 20px;
                background: none;
                border: 1px solid rgba(224, 224, 232, 0.15);
                border-radius: 8px;
                color: #e0e0e8;
                font-size: 18px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.15s ease;
                font-family: inherit;
            }
            .kb-help-close:hover {
                background: rgba(224, 224, 232, 0.08);
                border-color: rgba(0, 212, 255, 0.4);
                color: #00d4ff;
            }

            .kb-help-title {
                font-size: 20px;
                font-weight: 700;
                color: #e0e0e8;
                margin: 0 0 6px;
                letter-spacing: 0.5px;
            }
            .kb-help-title span {
                background: linear-gradient(135deg, #00d4ff, #7b2fff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .kb-help-subtitle {
                font-size: 12px;
                color: rgba(224, 224, 232, 0.4);
                margin: 0 0 28px;
                letter-spacing: 0.3px;
            }

            /* ── Shortcut Columns ─────────────────────── */
            .kb-help-columns {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 28px 40px;
                margin-bottom: 32px;
            }
            @media (max-width: 640px) {
                .kb-help-columns { grid-template-columns: 1fr; }
            }

            .kb-help-group h3 {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: #00d4ff;
                margin: 0 0 12px;
                padding-bottom: 6px;
                border-bottom: 1px solid rgba(0, 212, 255, 0.12);
            }

            .kb-help-row {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 5px 0;
            }

            .kb-keycap {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 28px;
                height: 28px;
                padding: 0 7px;
                background: linear-gradient(180deg, #1e1e2a 0%, #16161f 100%);
                border: 1px solid rgba(224, 224, 232, 0.12);
                border-bottom-width: 3px;
                border-bottom-color: rgba(0, 0, 0, 0.4);
                border-radius: 6px;
                color: #e0e0e8;
                font-size: 12px;
                font-weight: 600;
                font-family: inherit;
                box-shadow:
                    0 1px 3px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.04);
                flex-shrink: 0;
            }
            .kb-keycap--wide {
                min-width: 56px;
                padding: 0 10px;
            }
            .kb-keycap--accent {
                border-color: rgba(0, 212, 255, 0.3);
                color: #00d4ff;
                background: linear-gradient(180deg, #141428 0%, #10101d 100%);
            }
            .kb-keycap--purple {
                border-color: rgba(123, 47, 255, 0.3);
                color: #a06fff;
                background: linear-gradient(180deg, #1a1428 0%, #14101d 100%);
            }

            .kb-help-label {
                font-size: 12px;
                color: rgba(224, 224, 232, 0.65);
            }
            .kb-help-note-name {
                color: #e0e0e8;
                font-weight: 600;
            }

            /* ── Keyboard Diagram ─────────────────────── */
            .kb-help-diagram-title {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: #7b2fff;
                margin: 0 0 14px;
                padding-bottom: 6px;
                border-bottom: 1px solid rgba(123, 47, 255, 0.12);
            }

            .kb-diagram {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 6px;
            }

            .kb-diagram-row {
                display: flex;
                gap: 4px;
            }
            .kb-diagram-row--top { padding-left: 20px; }
            .kb-diagram-row--bottom { padding-left: 6px; }

            .kb-diagram-key {
                width: 38px;
                height: 34px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-radius: 5px;
                background: #1a1a25;
                border: 1px solid rgba(224, 224, 232, 0.08);
                font-size: 11px;
                font-weight: 600;
                color: rgba(224, 224, 232, 0.3);
                transition: all 0.15s ease;
                position: relative;
                font-family: inherit;
            }
            .kb-diagram-key--natural {
                background: linear-gradient(180deg, #0d2a30 0%, #0a1e24 100%);
                border-color: rgba(0, 212, 255, 0.25);
                color: #00d4ff;
                box-shadow: 0 0 8px rgba(0, 212, 255, 0.06);
            }
            .kb-diagram-key--sharp {
                background: linear-gradient(180deg, #1c1230 0%, #150e24 100%);
                border-color: rgba(123, 47, 255, 0.3);
                color: #a06fff;
                box-shadow: 0 0 8px rgba(123, 47, 255, 0.06);
            }

            .kb-diagram-key__letter {
                font-size: 12px;
                line-height: 1;
            }
            .kb-diagram-key__note {
                font-size: 8px;
                font-weight: 400;
                opacity: 0.7;
                line-height: 1;
                margin-top: 1px;
            }

            .kb-help-legend {
                display: flex;
                gap: 20px;
                margin-top: 10px;
            }
            .kb-help-legend-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                color: rgba(224, 224, 232, 0.45);
            }
            .kb-help-legend-swatch {
                width: 12px;
                height: 12px;
                border-radius: 3px;
            }
            .kb-help-legend-swatch--natural {
                background: linear-gradient(180deg, #0d2a30 0%, #0a1e24 100%);
                border: 1px solid rgba(0, 212, 255, 0.25);
            }
            .kb-help-legend-swatch--sharp {
                background: linear-gradient(180deg, #1c1230 0%, #150e24 100%);
                border: 1px solid rgba(123, 47, 255, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    // ── DOM Construction ─────────────────────────────────────────────

    _buildDOM() {
        this._overlay = document.createElement('div');
        this._overlay.className = 'kb-help-overlay';

        const modal = document.createElement('div');
        modal.className = 'kb-help-modal';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'kb-help-close';
        closeBtn.innerHTML = '&#10005;';
        closeBtn.title = 'Close (Esc)';
        this._closeBtn = closeBtn;
        modal.appendChild(closeBtn);

        // Title
        const title = document.createElement('h2');
        title.className = 'kb-help-title';
        title.innerHTML = '<span>NOVA</span> Keyboard Shortcuts';
        modal.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.className = 'kb-help-subtitle';
        subtitle.textContent = 'Press any highlighted key to play — your keyboard is an instrument.';
        modal.appendChild(subtitle);

        // Shortcut columns
        const columns = document.createElement('div');
        columns.className = 'kb-help-columns';

        columns.appendChild(this._buildGroup('Transport', [
            { keys: ['Space'], label: 'Play / Stop', accent: true, wide: true },
        ]));

        columns.appendChild(this._buildGroup('General', [
            { keys: ['?'], label: 'Toggle this help', accent: true },
            { keys: ['Esc'], label: 'Close help / modals', wide: true },
        ]));

        columns.appendChild(this._buildGroup('Octave Select', [
            { keys: ['1'], label: 'Octave 1' },
            { keys: ['2'], label: 'Octave 2' },
            { keys: ['3'], label: 'Octave 3' },
            { keys: ['4'], label: 'Octave 4 (default)' },
            { keys: ['5'], label: 'Octave 5' },
            { keys: ['6'], label: 'Octave 6' },
            { keys: ['7'], label: 'Octave 7' },
            { keys: ['8'], label: 'Octave 8' },
        ]));

        columns.appendChild(this._buildGroup('Note Mappings', [
            { keys: ['A'], label: 'C', note: true },
            { keys: ['W'], label: 'C#', note: true, sharp: true },
            { keys: ['S'], label: 'D', note: true },
            { keys: ['E'], label: 'D#', note: true, sharp: true },
            { keys: ['D'], label: 'E', note: true },
            { keys: ['F'], label: 'F', note: true },
            { keys: ['T'], label: 'F#', note: true, sharp: true },
            { keys: ['G'], label: 'G', note: true },
            { keys: ['Y'], label: 'G#', note: true, sharp: true },
            { keys: ['H'], label: 'A', note: true },
            { keys: ['U'], label: 'A#', note: true, sharp: true },
            { keys: ['J'], label: 'B', note: true },
            { keys: ['K'], label: 'C (next octave)', note: true },
        ]));

        modal.appendChild(columns);

        // Keyboard diagram
        const diagramTitle = document.createElement('h3');
        diagramTitle.className = 'kb-help-diagram-title';
        diagramTitle.textContent = 'QWERTY Keyboard Layout';
        modal.appendChild(diagramTitle);
        modal.appendChild(this._buildKeyboardDiagram());

        this._overlay.appendChild(modal);
        this._modal = modal;
        document.body.appendChild(this._overlay);
    }

    _buildGroup(title, shortcuts) {
        const group = document.createElement('div');
        group.className = 'kb-help-group';

        const h3 = document.createElement('h3');
        h3.textContent = title;
        group.appendChild(h3);

        for (const sc of shortcuts) {
            const row = document.createElement('div');
            row.className = 'kb-help-row';

            for (const key of sc.keys) {
                const keycap = document.createElement('span');
                let cls = 'kb-keycap';
                if (sc.wide) cls += ' kb-keycap--wide';
                if (sc.accent) cls += ' kb-keycap--accent';
                if (sc.sharp) cls += ' kb-keycap--purple';
                if (sc.note && !sc.sharp) cls += ' kb-keycap--accent';
                keycap.className = cls;
                keycap.textContent = key;
                row.appendChild(keycap);
            }

            const label = document.createElement('span');
            label.className = 'kb-help-label';
            if (sc.note) {
                label.innerHTML = `<span class="kb-help-note-name">${sc.label}</span>`;
            } else {
                label.textContent = sc.label;
            }
            row.appendChild(label);

            group.appendChild(row);
        }

        return group;
    }

    _buildKeyboardDiagram() {
        const wrapper = document.createElement('div');

        const diagram = document.createElement('div');
        diagram.className = 'kb-diagram';

        // Top row (sharps/flats) — Q W E R T Y U I
        const topRowKeys = [
            { letter: 'Q', note: null },
            { letter: 'W', note: 'C#' },
            { letter: 'E', note: 'D#' },
            { letter: 'R', note: null },
            { letter: 'T', note: 'F#' },
            { letter: 'Y', note: 'G#' },
            { letter: 'U', note: 'A#' },
            { letter: 'I', note: null },
        ];

        // Bottom row (naturals) — A S D F G H J K
        const bottomRowKeys = [
            { letter: 'A', note: 'C' },
            { letter: 'S', note: 'D' },
            { letter: 'D', note: 'E' },
            { letter: 'F', note: 'F' },
            { letter: 'G', note: 'G' },
            { letter: 'H', note: 'A' },
            { letter: 'J', note: 'B' },
            { letter: 'K', note: 'C+' },
        ];

        const topRow = document.createElement('div');
        topRow.className = 'kb-diagram-row kb-diagram-row--top';
        for (const k of topRowKeys) {
            topRow.appendChild(this._diagramKey(k.letter, k.note, k.note ? 'sharp' : null));
        }
        diagram.appendChild(topRow);

        const bottomRow = document.createElement('div');
        bottomRow.className = 'kb-diagram-row kb-diagram-row--bottom';
        for (const k of bottomRowKeys) {
            bottomRow.appendChild(this._diagramKey(k.letter, k.note, k.note ? 'natural' : null));
        }
        diagram.appendChild(bottomRow);

        wrapper.appendChild(diagram);

        // Legend
        const legend = document.createElement('div');
        legend.className = 'kb-help-legend';

        legend.innerHTML = `
            <div class="kb-help-legend-item">
                <div class="kb-help-legend-swatch kb-help-legend-swatch--natural"></div>
                Natural notes (white keys)
            </div>
            <div class="kb-help-legend-item">
                <div class="kb-help-legend-swatch kb-help-legend-swatch--sharp"></div>
                Sharp notes (black keys)
            </div>
        `;
        wrapper.appendChild(legend);

        return wrapper;
    }

    _diagramKey(letter, note, type) {
        const key = document.createElement('div');
        let cls = 'kb-diagram-key';
        if (type === 'natural') cls += ' kb-diagram-key--natural';
        if (type === 'sharp') cls += ' kb-diagram-key--sharp';
        key.className = cls;

        const letterEl = document.createElement('div');
        letterEl.className = 'kb-diagram-key__letter';
        letterEl.textContent = letter;
        key.appendChild(letterEl);

        if (note) {
            const noteEl = document.createElement('div');
            noteEl.className = 'kb-diagram-key__note';
            noteEl.textContent = note;
            key.appendChild(noteEl);
        }

        return key;
    }

    // ── Event Binding ────────────────────────────────────────────────

    _bindEvents() {
        // Close button
        this._closeBtn.addEventListener('click', () => this.hide());

        // Click outside modal to close
        this._overlay.addEventListener('click', (e) => {
            if (e.target === this._overlay) this.hide();
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            // Ignore if user is typing in an input
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this._visible) {
                e.preventDefault();
                this.hide();
            }
        });
    }
}
