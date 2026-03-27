export default class SoundDesigner {
    constructor(container) {
        this.container = container;

        // State
        this._history = [];
        this._maxHistory = 5;
        this._result = null;

        // Callbacks
        this._onDesign = null;
        this._onReapply = null;

        // Keyword definitions by category
        this._keywords = {
            tonal:      ['warm', 'bright', 'dark', 'aggressive', 'ethereal', 'dreamy', 'wide'],
            instrument: ['pad', 'bass', 'lead', 'pluck', 'keys', 'bell', 'strings', 'brass'],
            era:        ['80s', 'lofi', 'futuristic', 'retro', 'vintage'],
            texture:    ['shimmer', 'wobble', 'noise', 'metallic']
        };

        this._categoryColors = {
            tonal:      '#00d4ff',
            instrument: '#7b2fff',
            era:        '#ffaa00',
            texture:    '#00ff88'
        };

        this._allKeywords = Object.values(this._keywords).flat();

        this._injectStyles();
        this._buildDOM();
        this._initEvents();
    }

    // ── Callback Registration ─────────────────────────────────────

    onDesign(cb)  { this._onDesign = cb; }
    onReapply(cb) { this._onReapply = cb; }

    // ── Public Methods ────────────────────────────────────────────

    getText() {
        return this._textarea.value;
    }

    setText(text) {
        this._textarea.value = text;
        this._updateKeywordTags();
    }

    getHistory() {
        return [...this._history];
    }

    clearHistory() {
        this._history = [];
        this._renderHistory();
    }

    setResult(result) {
        this._result = result;
        this._addToHistory(result);
        this._renderResult(result);
    }

    // ── Private: DOM Construction ─────────────────────────────────

    _buildDOM() {
        const root = document.createElement('div');
        root.className = 'sd-root';

        root.innerHTML = `
            <div class="sd-header">
                <div class="sd-title">
                    <svg class="sd-icon" viewBox="0 0 24 24" width="20" height="20">
                        <path d="M12 2L9 9H2l6 4.5L5.5 21 12 16.5 18.5 21 16 13.5 22 9h-7z"
                              fill="none" stroke="currentColor" stroke-width="1.5"
                              stroke-linejoin="round"/>
                        <path d="M3 12c2-1 3-3 3-3s1 2 3 3" fill="none"
                              stroke="currentColor" stroke-width="1" opacity="0.5"/>
                    </svg>
                    SOUND DESIGNER
                </div>
                <div class="sd-subtitle">Describe your sound. NOVA creates it.</div>
            </div>

            <div class="sd-input-section">
                <textarea class="sd-textarea" rows="4"
                    placeholder="warm 80s brass pad with shimmer..."></textarea>
                <div class="sd-keyword-display"></div>
            </div>

            <div class="sd-tags-section">
                <div class="sd-tags-label">Quick Tags</div>
                <div class="sd-tags-cloud"></div>
            </div>

            <button class="sd-design-btn">DESIGN SOUND</button>

            <div class="sd-result-section sd-hidden">
                <div class="sd-result-label">Result</div>
                <div class="sd-result-matched"></div>
                <div class="sd-result-bars"></div>
            </div>

            <div class="sd-history-section">
                <div class="sd-history-label">History</div>
                <div class="sd-history-list"></div>
            </div>
        `;

        this.container.appendChild(root);
        this._root = root;

        // Cache references
        this._textarea        = root.querySelector('.sd-textarea');
        this._keywordDisplay  = root.querySelector('.sd-keyword-display');
        this._tagsCloud       = root.querySelector('.sd-tags-cloud');
        this._designBtn       = root.querySelector('.sd-design-btn');
        this._resultSection   = root.querySelector('.sd-result-section');
        this._resultMatched   = root.querySelector('.sd-result-matched');
        this._resultBars      = root.querySelector('.sd-result-bars');
        this._historyList     = root.querySelector('.sd-history-list');

        this._buildTagsCloud();
    }

    _buildTagsCloud() {
        const categories = [
            { label: 'Tone',       key: 'tonal' },
            { label: 'Instrument', key: 'instrument' },
            { label: 'Era',        key: 'era' },
            { label: 'Texture',    key: 'texture' }
        ];

        categories.forEach(cat => {
            const group = document.createElement('div');
            group.className = 'sd-tag-group';

            const heading = document.createElement('span');
            heading.className = 'sd-tag-group-label';
            heading.textContent = cat.label;
            heading.style.color = this._categoryColors[cat.key];
            group.appendChild(heading);

            this._keywords[cat.key].forEach(kw => {
                const tag = document.createElement('button');
                tag.className = 'sd-quick-tag';
                tag.textContent = kw;
                tag.style.borderColor = this._categoryColors[cat.key];
                tag.style.color = this._categoryColors[cat.key];
                tag.addEventListener('click', () => this._appendTag(kw));
                group.appendChild(tag);
            });

            this._tagsCloud.appendChild(group);
        });
    }

    // ── Private: Events ───────────────────────────────────────────

    _initEvents() {
        this._textarea.addEventListener('input', () => this._updateKeywordTags());

        this._textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._fireDesign();
            }
        });

        this._designBtn.addEventListener('click', () => this._fireDesign());
    }

    _fireDesign() {
        const text = this._textarea.value.trim();
        if (!text) return;
        if (this._onDesign) this._onDesign(text);
    }

    _appendTag(keyword) {
        const current = this._textarea.value.trim();
        const words = current.toLowerCase().split(/\s+/);
        if (words.includes(keyword)) return;
        this._textarea.value = current ? `${current} ${keyword}` : keyword;
        this._updateKeywordTags();
        this._textarea.focus();
    }

    // ── Private: Keyword Tag Display ──────────────────────────────

    _updateKeywordTags() {
        const text = this._textarea.value.toLowerCase();
        const words = text.split(/\s+/).filter(Boolean);
        const matched = this._allKeywords.filter(kw => words.includes(kw));

        this._keywordDisplay.innerHTML = '';
        matched.forEach(kw => {
            const cat = this._getCategoryForKeyword(kw);
            const chip = document.createElement('span');
            chip.className = 'sd-keyword-chip';
            chip.textContent = kw;
            chip.style.background = this._categoryColors[cat] + '22';
            chip.style.color = this._categoryColors[cat];
            chip.style.borderColor = this._categoryColors[cat] + '66';
            this._keywordDisplay.appendChild(chip);
        });
    }

    _getCategoryForKeyword(kw) {
        for (const [cat, list] of Object.entries(this._keywords)) {
            if (list.includes(kw)) return cat;
        }
        return 'tonal';
    }

    // ── Private: Result Display ───────────────────────────────────

    _renderResult(result) {
        this._resultSection.classList.remove('sd-hidden');

        // Matched descriptors
        const matchedWords = result.matched || [];
        this._resultMatched.innerHTML = '<span class="sd-matched-prefix">Matched: </span>' +
            matchedWords.map(w => {
                const cat = this._getCategoryForKeyword(w);
                const color = this._categoryColors[cat] || '#00d4ff';
                return `<span class="sd-matched-word" style="color:${color}">${w}</span>`;
            }).join('<span class="sd-matched-plus"> + </span>');

        // Mini param bars
        const patch = result.patch || {};
        const effects = result.effects || {};
        const params = [
            { label: 'Filter Cutoff', value: this._normalizeParam(patch.filterCutoff, 20000) },
            { label: 'Attack',        value: this._normalizeParam(patch.attack, 2) },
            { label: 'Release',       value: this._normalizeParam(patch.release, 5) },
            { label: 'Reverb',        value: this._normalizeParam(effects.reverbMix, 1) }
        ];

        this._resultBars.innerHTML = params.map(p => `
            <div class="sd-param-row">
                <span class="sd-param-label">${p.label}</span>
                <div class="sd-param-track">
                    <div class="sd-param-fill" style="width:${p.value * 100}%"></div>
                </div>
                <span class="sd-param-value">${Math.round(p.value * 100)}%</span>
            </div>
        `).join('');
    }

    _normalizeParam(value, max) {
        if (value === undefined || value === null) return 0;
        return Math.min(1, Math.max(0, value / max));
    }

    // ── Private: History ──────────────────────────────────────────

    _addToHistory(result) {
        const entry = {
            description: result.description || this._textarea.value.trim(),
            matched: result.matched || [],
            matchedCount: (result.matched || []).length,
            patch: result.patch,
            effects: result.effects,
            timestamp: Date.now()
        };

        this._history.unshift(entry);
        if (this._history.length > this._maxHistory) {
            this._history.pop();
        }

        this._renderHistory();
    }

    _renderHistory() {
        this._historyList.innerHTML = '';

        if (this._history.length === 0) {
            this._historyList.innerHTML =
                '<div class="sd-history-empty">No designs yet</div>';
            return;
        }

        this._history.forEach((entry, i) => {
            const item = document.createElement('div');
            item.className = 'sd-history-item';
            item.innerHTML = `
                <span class="sd-history-text">${this._escapeHtml(entry.description)}</span>
                <span class="sd-history-count">${entry.matchedCount} matched</span>
            `;
            item.addEventListener('click', () => {
                this.setText(entry.description);
                if (this._onReapply) this._onReapply(entry);
            });
            this._historyList.appendChild(item);
        });
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Private: Scoped CSS ───────────────────────────────────────

    _injectStyles() {
        if (document.querySelector('#sd-styles')) return;
        const style = document.createElement('style');
        style.id = 'sd-styles';
        style.textContent = `
            .sd-root {
                background: #0a0a0f;
                border-radius: 10px;
                padding: 18px;
                font-family: 'Inter', sans-serif;
                color: #ccc;
                display: flex;
                flex-direction: column;
                gap: 14px;
                max-width: 100%;
                box-sizing: border-box;
            }

            /* ── Header ─────────────────────────── */
            .sd-header { text-align: center; }
            .sd-title {
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 2px;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .sd-icon { color: #7b2fff; flex-shrink: 0; }
            .sd-subtitle {
                font-size: 11px;
                color: #666;
                margin-top: 4px;
                letter-spacing: 0.5px;
            }

            /* ── Textarea ───────────────────────── */
            .sd-input-section { display: flex; flex-direction: column; gap: 8px; }
            .sd-textarea {
                width: 100%;
                box-sizing: border-box;
                background: #12121a;
                border: 1px solid #2a2a3a;
                border-radius: 8px;
                padding: 12px;
                color: #eee;
                font-size: 13px;
                font-family: inherit;
                resize: vertical;
                outline: none;
                transition: border-color 0.2s;
            }
            .sd-textarea:focus { border-color: #7b2fff; }
            .sd-textarea::placeholder { color: #444; }

            /* ── Keyword Chips ───────────────────── */
            .sd-keyword-display {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                min-height: 8px;
            }
            .sd-keyword-chip {
                font-size: 11px;
                padding: 3px 10px;
                border-radius: 20px;
                border: 1px solid;
                font-weight: 500;
                letter-spacing: 0.3px;
            }

            /* ── Quick Tags ─────────────────────── */
            .sd-tags-section { display: flex; flex-direction: column; gap: 8px; }
            .sd-tags-label {
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                color: #555;
            }
            .sd-tags-cloud {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .sd-tag-group {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 6px;
            }
            .sd-tag-group-label {
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 1px;
                text-transform: uppercase;
                min-width: 72px;
            }
            .sd-quick-tag {
                background: #1a1a25;
                border: 1px solid;
                border-radius: 14px;
                padding: 4px 12px;
                font-size: 11px;
                font-family: inherit;
                cursor: pointer;
                transition: background 0.15s, transform 0.1s;
            }
            .sd-quick-tag:hover {
                background: #252535;
                transform: scale(1.05);
            }
            .sd-quick-tag:active { transform: scale(0.97); }

            /* ── Design Button ───────────────────── */
            .sd-design-btn {
                width: 100%;
                padding: 12px;
                border: none;
                border-radius: 8px;
                background: linear-gradient(135deg, #7b2fff, #00d4ff);
                color: #fff;
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 2px;
                font-family: inherit;
                cursor: pointer;
                transition: box-shadow 0.2s, transform 0.1s;
            }
            .sd-design-btn:hover {
                box-shadow: 0 0 20px rgba(123, 47, 255, 0.4),
                            0 0 40px rgba(0, 212, 255, 0.2);
                transform: translateY(-1px);
            }
            .sd-design-btn:active { transform: translateY(0); }

            /* ── Result ─────────────────────────── */
            .sd-result-section {
                background: #12121a;
                border-radius: 8px;
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .sd-hidden { display: none !important; }
            .sd-result-label {
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                color: #555;
            }
            .sd-matched-prefix { color: #666; font-size: 12px; }
            .sd-matched-word { font-weight: 600; font-size: 12px; }
            .sd-matched-plus { color: #444; font-size: 12px; margin: 0 4px; }
            .sd-result-bars {
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-top: 4px;
            }
            .sd-param-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .sd-param-label {
                font-size: 10px;
                color: #666;
                min-width: 80px;
                text-align: right;
            }
            .sd-param-track {
                flex: 1;
                height: 6px;
                background: #1a1a25;
                border-radius: 3px;
                overflow: hidden;
            }
            .sd-param-fill {
                height: 100%;
                border-radius: 3px;
                background: linear-gradient(90deg, #7b2fff, #00d4ff);
                transition: width 0.4s ease;
            }
            .sd-param-value {
                font-size: 10px;
                color: #555;
                min-width: 32px;
            }

            /* ── History ─────────────────────────── */
            .sd-history-section { display: flex; flex-direction: column; gap: 6px; }
            .sd-history-label {
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                color: #555;
            }
            .sd-history-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .sd-history-empty {
                font-size: 11px;
                color: #333;
                padding: 8px 0;
            }
            .sd-history-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #12121a;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.15s;
            }
            .sd-history-item:hover { background: #1a1a25; }
            .sd-history-text {
                font-size: 11px;
                color: #aaa;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
                margin-right: 8px;
            }
            .sd-history-count {
                font-size: 10px;
                color: #555;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    }
}
