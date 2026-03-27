export default class Onboarding {
    constructor() {
        this._currentStep = 0;
        this._listeners = [];
        this._timers = [];
        this._overlay = null;
        this._tooltip = null;

        this._steps = [
            {
                type: 'fullscreen',
                title: 'Welcome to NOVA',
                body: 'NOVA is your AI-powered music studio. Let\'s make your first beat in 60 seconds.',
                button: 'START TUTORIAL'
            },
            {
                type: 'spotlight',
                selector: '#genre-select',
                title: 'Pick a Genre',
                body: 'Pick a genre to start with. Try Trap or Lo-fi.',
                advance: 'genre-change'
            },
            {
                type: 'spotlight',
                selector: '#btn-play',
                title: 'Hit Play',
                body: 'Press PLAY (or hit Space) to hear your beat.',
                advance: 'play'
            },
            {
                type: 'spotlight',
                selector: '.sequencer-grid',
                title: 'Tweak the Beat',
                body: 'Click any cell to add or remove drum hits. Right-click to change velocity.',
                advance: 'timed-next',
                delay: 5000
            },
            {
                type: 'spotlight',
                selector: '#preset-select',
                title: 'Choose a Sound',
                body: 'Pick a synth preset. Try \'Supersaw Lead\' or \'Sub Bass\'.',
                advance: 'preset-change'
            },
            {
                type: 'spotlight',
                selector: '.transport-inner',
                title: 'Play Keys',
                body: 'Play your keyboard! A-S-D-F-G-H-J-K are notes. Try it now.',
                advance: 'keypress'
            },
            {
                type: 'spotlight',
                selector: '[data-view="ai"]',
                title: 'AI Magic',
                body: 'Click AI COMPOSER \u2014 NOVA\'s AI can generate chords, melodies, and full tracks for you.',
                advance: 'tab-click'
            },
            {
                type: 'spotlight',
                selector: '.btn-surprise',
                title: 'Surprise Me',
                body: 'Click SURPRISE ME to generate a complete track instantly.',
                advance: 'surprise-click'
            },
            {
                type: 'spotlight',
                selector: '.sd-textarea',
                title: 'Sound Designer',
                body: 'Type how you want your sound: \'warm 80s pad\' or \'aggressive bass\'. NOVA creates it.',
                advance: 'timed-next',
                delay: 3000
            },
            {
                type: 'fullscreen',
                title: 'You\'re Ready to Create',
                body: 'NOVA has 7 views: Sequencer, Piano Roll, Arrangement, Performance, Effects, AI Composer, and Mixer.\n\nPress ? anytime for keyboard shortcuts.',
                button: 'CLOSE',
                final: true
            }
        ];

        this._injectCSS();
        this._buildDOM();
        document.body.appendChild(this._container);

        // Auto-start if not completed
        if (!this.isComplete()) {
            this._autoStartTimer = setTimeout(() => this.start(), 1000);
        }
    }

    // ── Public API ──────────────────────────────────────────────────

    start() {
        this._currentStep = 0;
        this._container.classList.add('onb-visible');
        this._showStep(0);
    }

    skip() {
        this._markComplete();
        this._teardown();
    }

    isComplete() {
        return localStorage.getItem('nova_onboarding_complete') === 'true';
    }

    reset() {
        localStorage.removeItem('nova_onboarding_complete');
    }

    // ── DOM Construction ────────────────────────────────────────────

    _buildDOM() {
        this._container = document.createElement('div');
        this._container.className = 'onb-container';

        // Overlay backdrop (will use clip-path for cutout)
        this._overlay = document.createElement('div');
        this._overlay.className = 'onb-overlay';
        this._container.appendChild(this._overlay);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'onb-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Skip tutorial';
        closeBtn.addEventListener('click', () => this.skip());
        this._container.appendChild(closeBtn);

        // Tooltip
        this._tooltip = document.createElement('div');
        this._tooltip.className = 'onb-tooltip';
        this._container.appendChild(this._tooltip);

        // Fullscreen panel
        this._fullscreen = document.createElement('div');
        this._fullscreen.className = 'onb-fullscreen';
        this._container.appendChild(this._fullscreen);

        // Progress bar
        this._progress = document.createElement('div');
        this._progress.className = 'onb-progress';
        this._container.appendChild(this._progress);
    }

    // ── Step Rendering ──────────────────────────────────────────────

    _showStep(index) {
        this._cleanupListeners();
        this._clearTimers();
        this._currentStep = index;

        const step = this._steps[index];
        if (!step) { this.skip(); return; }

        this._updateProgress(index);

        if (step.type === 'fullscreen') {
            this._showFullscreen(step, index);
        } else {
            this._showSpotlight(step, index);
        }
    }

    _showFullscreen(step, index) {
        this._tooltip.classList.remove('onb-visible');
        this._overlay.style.clipPath = '';
        this._overlay.classList.add('onb-solid');

        const lines = step.body.split('\n').filter(l => l.trim());
        const bodyHTML = lines.map(l => `<p>${l}</p>`).join('');

        this._fullscreen.innerHTML = `
            <div class="onb-fs-card">
                <h1 class="onb-fs-title">${step.title}</h1>
                <div class="onb-fs-body">${bodyHTML}</div>
                <button class="onb-btn onb-primary">${step.button}</button>
            </div>
        `;
        this._fullscreen.classList.add('onb-visible');

        const btn = this._fullscreen.querySelector('.onb-btn');
        btn.addEventListener('click', () => {
            if (step.final) {
                this._markComplete();
                this._teardown();
            } else {
                this._fullscreen.classList.remove('onb-visible');
                this._showStep(index + 1);
            }
        });
    }

    _showSpotlight(step, index) {
        this._fullscreen.classList.remove('onb-visible');
        this._overlay.classList.remove('onb-solid');

        const el = document.querySelector(step.selector);
        if (!el) {
            // Element not found, skip to next step
            this._showStep(index + 1);
            return;
        }

        this._positionCutout(el);
        this._positionTooltip(el, step, index);

        // Set up auto-advance
        this._bindAdvance(step, index, el);
    }

    _positionCutout(el) {
        const rect = el.getBoundingClientRect();
        const pad = 8;
        const x = rect.left - pad;
        const y = rect.top - pad;
        const w = rect.width + pad * 2;
        const h = rect.height + pad * 2;
        const r = 6;

        // Inset polygon: full viewport with a rounded-rect hole
        this._overlay.style.clipPath = `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${x + r}px ${y}px,
            ${x + w - r}px ${y}px,
            ${x + w}px ${y + r}px,
            ${x + w}px ${y + h - r}px,
            ${x + w - r}px ${y + h}px,
            ${x + r}px ${y + h}px,
            ${x}px ${y + h - r}px,
            ${x}px ${y + r}px,
            ${x + r}px ${y}px
        )`;

        // Bring element above overlay
        el.style.position = el.style.position || 'relative';
        el.dataset.onbPrevZ = el.style.zIndex;
        el.style.zIndex = '100001';
        el.dataset.onbPrevPointerEvents = el.style.pointerEvents;
        el.style.pointerEvents = 'auto';
    }

    _restoreElement(selector) {
        const el = document.querySelector(selector);
        if (el && el.dataset.onbPrevZ !== undefined) {
            el.style.zIndex = el.dataset.onbPrevZ || '';
            el.style.pointerEvents = el.dataset.onbPrevPointerEvents || '';
            delete el.dataset.onbPrevZ;
            delete el.dataset.onbPrevPointerEvents;
        }
    }

    _positionTooltip(el, step, index) {
        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const stepLabel = `Step ${index + 1} of ${this._steps.length}`;

        this._tooltip.innerHTML = `
            <div class="onb-tip-step">${stepLabel}</div>
            <h3 class="onb-tip-title">${step.title}</h3>
            <p class="onb-tip-body">${step.body}</p>
            <div class="onb-tip-actions"></div>
        `;

        this._tooltip.classList.add('onb-visible');

        // Position: prefer below, then above, then right, then left
        const tipW = 320;
        const tipH = this._tooltip.offsetHeight || 160;
        const gap = 16;
        let top, left;

        if (rect.bottom + gap + tipH < vh) {
            top = rect.bottom + gap;
            left = Math.max(16, Math.min(rect.left, vw - tipW - 16));
        } else if (rect.top - gap - tipH > 0) {
            top = rect.top - gap - tipH;
            left = Math.max(16, Math.min(rect.left, vw - tipW - 16));
        } else if (rect.right + gap + tipW < vw) {
            top = Math.max(16, rect.top);
            left = rect.right + gap;
        } else {
            top = Math.max(16, rect.top);
            left = Math.max(16, rect.left - gap - tipW);
        }

        this._tooltip.style.top = `${top}px`;
        this._tooltip.style.left = `${left}px`;
    }

    _addNextButton(index) {
        const actions = this._tooltip.querySelector('.onb-tip-actions');
        if (!actions) return;
        const btn = document.createElement('button');
        btn.className = 'onb-btn onb-primary onb-small';
        btn.textContent = 'NEXT';
        btn.addEventListener('click', () => {
            this._restoreStep(index);
            this._showStep(index + 1);
        });
        actions.appendChild(btn);
    }

    // ── Auto-advance Bindings ───────────────────────────────────────

    _bindAdvance(step, index, el) {
        const next = () => {
            this._restoreStep(index);
            this._showStep(index + 1);
        };

        switch (step.advance) {
            case 'genre-change': {
                const handler = () => next();
                el.addEventListener('change', handler);
                this._listeners.push({ el, event: 'change', handler });
                break;
            }
            case 'play': {
                // Listen for click on play button
                const clickHandler = () => next();
                el.addEventListener('click', clickHandler);
                this._listeners.push({ el, event: 'click', handler: clickHandler });

                // Also listen for spacebar
                const keyHandler = (e) => {
                    if (e.code === 'Space') next();
                };
                document.addEventListener('keydown', keyHandler);
                this._listeners.push({ el: document, event: 'keydown', handler: keyHandler });
                break;
            }
            case 'timed-next': {
                const tid = setTimeout(() => this._addNextButton(index), step.delay || 5000);
                this._timers.push(tid);
                break;
            }
            case 'preset-change': {
                const handler = () => next();
                el.addEventListener('change', handler);
                this._listeners.push({ el, event: 'change', handler });
                break;
            }
            case 'keypress': {
                const noteKeys = new Set(['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK']);
                const handler = (e) => {
                    if (noteKeys.has(e.code)) next();
                };
                document.addEventListener('keydown', handler);
                this._listeners.push({ el: document, event: 'keydown', handler });
                break;
            }
            case 'tab-click': {
                const handler = () => next();
                el.addEventListener('click', handler);
                this._listeners.push({ el, event: 'click', handler });
                break;
            }
            case 'surprise-click': {
                const handler = () => next();
                el.addEventListener('click', handler);
                this._listeners.push({ el, event: 'click', handler });
                break;
            }
            default:
                // Fallback: show next button immediately
                this._addNextButton(index);
                break;
        }
    }

    _restoreStep(index) {
        const step = this._steps[index];
        if (step && step.selector) {
            this._restoreElement(step.selector);
        }
    }

    // ── Progress Bar ────────────────────────────────────────────────

    _updateProgress(index) {
        const total = this._steps.length;
        let html = '<div class="onb-dots">';
        for (let i = 0; i < total; i++) {
            const cls = i < index ? 'onb-dot done' : i === index ? 'onb-dot active' : 'onb-dot';
            html += `<span class="${cls}"></span>`;
        }
        html += '</div>';
        html += `<span class="onb-step-label">Step ${index + 1} of ${total}</span>`;
        this._progress.innerHTML = html;
    }

    // ── Cleanup ─────────────────────────────────────────────────────

    _cleanupListeners() {
        for (const { el, event, handler } of this._listeners) {
            el.removeEventListener(event, handler);
        }
        this._listeners = [];
    }

    _clearTimers() {
        for (const tid of this._timers) clearTimeout(tid);
        this._timers = [];
    }

    _markComplete() {
        localStorage.setItem('nova_onboarding_complete', 'true');
    }

    _teardown() {
        this._cleanupListeners();
        this._clearTimers();
        if (this._autoStartTimer) clearTimeout(this._autoStartTimer);

        // Restore any highlighted elements
        for (const step of this._steps) {
            if (step.selector) this._restoreElement(step.selector);
        }

        this._container.classList.remove('onb-visible');
        this._tooltip.classList.remove('onb-visible');
        this._fullscreen.classList.remove('onb-visible');
        this._overlay.style.clipPath = '';
        this._overlay.classList.remove('onb-solid');
    }

    // ── CSS Injection ───────────────────────────────────────────────

    _injectCSS() {
        if (document.getElementById('onb-styles')) return;
        const style = document.createElement('style');
        style.id = 'onb-styles';
        style.textContent = `
            /* ── Onboarding Container ── */
            .onb-container {
                position: fixed;
                inset: 0;
                z-index: 100000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .onb-container.onb-visible {
                pointer-events: auto;
                opacity: 1;
            }

            /* ── Overlay ── */
            .onb-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.85);
                transition: clip-path 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 100000;
            }
            .onb-overlay.onb-solid {
                clip-path: none !important;
            }

            /* ── Close Button ── */
            .onb-close {
                position: fixed;
                top: 16px;
                right: 16px;
                z-index: 100004;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #aaa;
                font-size: 24px;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s, color 0.2s;
                line-height: 1;
            }
            .onb-close:hover {
                background: rgba(255, 255, 255, 0.15);
                color: #fff;
            }

            /* ── Tooltip ── */
            .onb-tooltip {
                position: fixed;
                z-index: 100003;
                width: 320px;
                background: #12121a;
                border: 1px solid #1a1a2e;
                border-left: 3px solid #00d4ff;
                border-radius: 10px;
                padding: 20px 22px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(0, 212, 255, 0.08);
                opacity: 0;
                transform: translateY(8px);
                transition: opacity 0.3s ease, transform 0.3s ease;
                pointer-events: auto;
            }
            .onb-tooltip.onb-visible {
                opacity: 1;
                transform: translateY(0);
            }
            .onb-tip-step {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: #00d4ff;
                margin-bottom: 8px;
                font-weight: 600;
            }
            .onb-tip-title {
                font-size: 18px;
                font-weight: 700;
                color: #fff;
                margin: 0 0 8px 0;
            }
            .onb-tip-body {
                font-size: 14px;
                color: #b0b0c0;
                line-height: 1.5;
                margin: 0 0 14px 0;
            }
            .onb-tip-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }

            /* ── Buttons ── */
            .onb-btn {
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 700;
                font-size: 14px;
                letter-spacing: 0.5px;
                transition: transform 0.15s, box-shadow 0.2s;
            }
            .onb-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 16px rgba(0, 212, 255, 0.25);
            }
            .onb-btn:active {
                transform: translateY(0);
            }
            .onb-primary {
                background: linear-gradient(135deg, #00d4ff 0%, #7b2fff 100%);
                color: #fff;
                padding: 12px 28px;
            }
            .onb-small {
                padding: 8px 20px;
                font-size: 12px;
            }

            /* ── Fullscreen Panel ── */
            .onb-fullscreen {
                position: fixed;
                inset: 0;
                z-index: 100002;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.4s ease;
            }
            .onb-fullscreen.onb-visible {
                opacity: 1;
                pointer-events: auto;
            }
            .onb-fs-card {
                background: #12121a;
                border: 1px solid #1a1a2e;
                border-radius: 16px;
                padding: 48px 56px;
                text-align: center;
                max-width: 520px;
                box-shadow: 0 16px 64px rgba(0, 0, 0, 0.6), 0 0 48px rgba(0, 212, 255, 0.06);
                animation: onb-fade-up 0.5s ease;
            }
            .onb-fs-title {
                font-size: 36px;
                font-weight: 800;
                background: linear-gradient(135deg, #00d4ff 0%, #7b2fff 50%, #ff3366 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin: 0 0 16px 0;
            }
            .onb-fs-body {
                font-size: 16px;
                color: #b0b0c0;
                line-height: 1.6;
                margin-bottom: 32px;
            }
            .onb-fs-body p {
                margin: 0 0 10px 0;
            }

            /* ── Progress Dots ── */
            .onb-progress {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 100004;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .onb-dots {
                display: flex;
                gap: 6px;
            }
            .onb-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.15);
                transition: background 0.3s, transform 0.3s;
            }
            .onb-dot.active {
                background: #00d4ff;
                transform: scale(1.3);
                box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
            }
            .onb-dot.done {
                background: #7b2fff;
            }
            .onb-step-label {
                font-size: 11px;
                color: #666;
                letter-spacing: 1px;
                text-transform: uppercase;
                white-space: nowrap;
            }

            /* ── Animations ── */
            @keyframes onb-fade-up {
                from { opacity: 0; transform: translateY(20px); }
                to   { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
}
