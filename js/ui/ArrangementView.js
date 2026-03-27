const SCENE_COLORS = [
    '#00d4ff', '#ff3366', '#ffaa00', '#7b2fff',
    '#00ff88', '#ff6600', '#ff00aa', '#00b8d4'
];

const CELL_W = 80;
const CELL_H = 40;
const SIDEBAR_W = 120;
const HEADER_H = 24;
const ROW_LABELS = ['DRUMS', 'SYNTH'];

export default class ArrangementView {
    constructor(container) {
        this.container = container;

        this.scenes = [];
        this.arrangement = [];
        this.playheadBar = 0;
        this.isPlaying = false;
        this.mode = 'pattern'; // 'pattern' | 'song'

        this.selectedCell = null;   // { row, bar }
        this.selectedScene = null;  // scene id
        this.scrollX = 0;
        this.scrollY = 0;
        this.dragScene = null;      // scene being dragged from palette

        this._onModeChange = null;
        this._onSceneChange = null;
        this._onArrangementChange = null;

        this._contextMenu = null;

        this._injectStyles();
        this._buildDOM();
        this._bindEvents();
        this.render();
    }

    // ── Style injection ──────────────────────────────────────────

    _injectStyles() {
        if (document.getElementById('arrangement-view-styles')) return;
        const style = document.createElement('style');
        style.id = 'arrangement-view-styles';
        style.textContent = `
            .arrangement-root {
                display: flex; flex-direction: column;
                background: #0a0a0f; color: #b0b8c8;
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                font-size: 11px; height: 100%; user-select: none;
                border: 1px solid #1a1a2e; border-radius: 6px; overflow: hidden;
            }
            .arr-toolbar {
                display: flex; align-items: center; gap: 8px;
                padding: 6px 10px; background: #0e0e18; border-bottom: 1px solid #1a1a2e;
            }
            .arr-mode-btn {
                padding: 4px 12px; border: 1px solid #1a1a2e; border-radius: 4px;
                background: #12121e; color: #607090; cursor: pointer;
                font-family: inherit; font-size: 10px; letter-spacing: 1px;
                transition: all .15s;
            }
            .arr-mode-btn.active {
                background: #00d4ff22; color: #00d4ff; border-color: #00d4ff66;
            }
            .arr-mode-btn:hover { border-color: #00d4ff44; }
            .arr-body {
                display: flex; flex: 1; overflow: hidden; position: relative;
            }
            .arr-sidebar {
                width: ${SIDEBAR_W}px; min-width: ${SIDEBAR_W}px;
                background: #0c0c14; border-right: 1px solid #1a1a2e;
                display: flex; flex-direction: column; overflow-y: auto;
            }
            .arr-sidebar-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 6px 8px; border-bottom: 1px solid #1a1a2e;
                font-size: 10px; letter-spacing: 1px; color: #506080;
            }
            .arr-add-scene {
                width: 22px; height: 22px; border-radius: 4px;
                border: 1px solid #1a1a2e; background: #12121e;
                color: #00d4ff; cursor: pointer; font-size: 14px;
                display: flex; align-items: center; justify-content: center;
                transition: all .15s;
            }
            .arr-add-scene:hover { background: #00d4ff22; border-color: #00d4ff66; }
            .arr-scene-card {
                display: flex; align-items: center; gap: 6px;
                padding: 6px 8px; cursor: pointer; border-bottom: 1px solid #0e0e18;
                transition: background .12s;
            }
            .arr-scene-card:hover { background: #14142a; }
            .arr-scene-card.selected { background: #00d4ff14; }
            .arr-scene-dot {
                width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
            }
            .arr-scene-name {
                flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                font-size: 10px; color: #8090a8;
            }
            .arr-scene-steps {
                font-size: 9px; color: #405060;
            }
            .arr-canvas-wrap {
                flex: 1; overflow: auto; position: relative;
            }
            .arr-canvas {
                display: block; image-rendering: pixelated;
            }
            .arr-context-menu {
                position: fixed; background: #12121e; border: 1px solid #1a1a2e;
                border-radius: 6px; padding: 4px 0; z-index: 9999;
                min-width: 140px; box-shadow: 0 8px 24px #00000088;
            }
            .arr-context-item {
                padding: 6px 14px; cursor: pointer; font-size: 11px;
                font-family: inherit; color: #8090a8;
                transition: background .1s;
            }
            .arr-context-item:hover { background: #00d4ff18; color: #00d4ff; }
        `;
        document.head.appendChild(style);
    }

    // ── DOM construction ─────────────────────────────────────────

    _buildDOM() {
        this.container.innerHTML = '';

        const root = document.createElement('div');
        root.className = 'arrangement-root';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'arr-toolbar';

        this.btnPattern = document.createElement('button');
        this.btnPattern.className = 'arr-mode-btn active';
        this.btnPattern.textContent = 'PATTERN';
        toolbar.appendChild(this.btnPattern);

        this.btnSong = document.createElement('button');
        this.btnSong.className = 'arr-mode-btn';
        this.btnSong.textContent = 'SONG';
        toolbar.appendChild(this.btnSong);

        const spacer = document.createElement('div');
        spacer.style.flex = '1';
        toolbar.appendChild(spacer);

        this.barLabel = document.createElement('span');
        this.barLabel.style.cssText = 'color:#506080; font-size:10px; letter-spacing:1px;';
        this.barLabel.textContent = 'BAR 1 / 0';
        toolbar.appendChild(this.barLabel);

        root.appendChild(toolbar);

        // Body: sidebar + canvas
        const body = document.createElement('div');
        body.className = 'arr-body';

        // Sidebar
        this.sidebar = document.createElement('div');
        this.sidebar.className = 'arr-sidebar';

        const sideHeader = document.createElement('div');
        sideHeader.className = 'arr-sidebar-header';
        sideHeader.innerHTML = '<span>SCENES</span>';
        this.addSceneBtn = document.createElement('button');
        this.addSceneBtn.className = 'arr-add-scene';
        this.addSceneBtn.textContent = '+';
        sideHeader.appendChild(this.addSceneBtn);
        this.sidebar.appendChild(sideHeader);

        this.sceneList = document.createElement('div');
        this.sidebar.appendChild(this.sceneList);
        body.appendChild(this.sidebar);

        // Canvas
        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'arr-canvas-wrap';
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'arr-canvas';
        canvasWrap.appendChild(this.canvas);
        this.canvasWrap = canvasWrap;
        body.appendChild(canvasWrap);

        root.appendChild(body);
        this.container.appendChild(root);
        this.ctx = this.canvas.getContext('2d');
        this.root = root;
    }

    // ── Events ───────────────────────────────────────────────────

    _bindEvents() {
        this.btnPattern.addEventListener('click', () => this._setMode('pattern'));
        this.btnSong.addEventListener('click', () => this._setMode('song'));

        this.addSceneBtn.addEventListener('click', () => {
            const id = this.scenes.length;
            this.addScene({
                id,
                name: `Scene ${id + 1}`,
                color: SCENE_COLORS[id % SCENE_COLORS.length],
                drumPattern: {},
                synthNotes: [],
                length: 16
            });
        });

        // Canvas interactions
        this.canvas.addEventListener('click', e => this._onCanvasClick(e));
        this.canvas.addEventListener('contextmenu', e => this._onCanvasContext(e));
        this.canvas.addEventListener('dblclick', e => this._onCanvasDblClick(e));

        // Drag from sidebar
        this.canvas.addEventListener('dragover', e => { e.preventDefault(); });
        this.canvas.addEventListener('drop', e => this._onCanvasDrop(e));

        // Scroll sync
        this.canvasWrap.addEventListener('scroll', () => {
            this.scrollX = this.canvasWrap.scrollLeft;
            this.scrollY = this.canvasWrap.scrollTop;
        });

        // Dismiss context menu on outside click
        document.addEventListener('click', () => this._closeContextMenu());

        // Resize
        const ro = new ResizeObserver(() => this._resizeCanvas());
        ro.observe(this.canvasWrap);
    }

    _setMode(mode) {
        this.mode = mode;
        this.btnPattern.classList.toggle('active', mode === 'pattern');
        this.btnSong.classList.toggle('active', mode === 'song');
        if (this._onModeChange) this._onModeChange(mode);
        this.render();
    }

    _hitTest(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const bar = Math.floor(x / CELL_W);
        const row = Math.floor((y - HEADER_H) / CELL_H);
        if (row < 0 || row >= ROW_LABELS.length || bar < 0) return null;
        return { row, bar };
    }

    _onCanvasClick(e) {
        const hit = this._hitTest(e);
        if (!hit) return;
        this.selectedCell = hit;

        // If a scene is selected in the palette, assign it
        if (this.selectedScene !== null) {
            this._assignSceneToBar(hit.bar, this.selectedScene);
        }
        this.render();
    }

    _onCanvasDblClick(e) {
        const hit = this._hitTest(e);
        if (!hit) return;
        const entry = this.arrangement[hit.bar];
        if (entry && entry.sceneId !== null) {
            // Select this scene in the palette
            this.selectedScene = entry.sceneId;
            this._renderSceneList();
        }
    }

    _onCanvasContext(e) {
        e.preventDefault();
        const hit = this._hitTest(e);
        if (!hit) return;
        this.selectedCell = hit;
        this.render();
        this._showContextMenu(e.clientX, e.clientY, hit);
    }

    _onCanvasDrop(e) {
        e.preventDefault();
        const sceneId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(sceneId)) return;
        const hit = this._hitTest(e);
        if (!hit) return;
        this._assignSceneToBar(hit.bar, sceneId);
        this.render();
    }

    _assignSceneToBar(bar, sceneId) {
        // Ensure arrangement array is long enough
        while (this.arrangement.length <= bar) {
            this.arrangement.push({ sceneId: null, repeat: 1 });
        }
        this.arrangement[bar] = { sceneId, repeat: 1 };
        this._fireArrangementChange();
        this.render();
    }

    // ── Context menu ─────────────────────────────────────────────

    _showContextMenu(x, y, cell) {
        this._closeContextMenu();
        const menu = document.createElement('div');
        menu.className = 'arr-context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const items = [
            { label: 'Clear', action: () => this._clearBar(cell.bar) },
            { label: 'Duplicate', action: () => this._duplicateBar(cell.bar) },
            { label: 'Insert Bar', action: () => this._insertBar(cell.bar) },
            { label: 'Delete Bar', action: () => this._deleteBar(cell.bar) }
        ];

        for (const item of items) {
            const el = document.createElement('div');
            el.className = 'arr-context-item';
            el.textContent = item.label;
            el.addEventListener('click', e => {
                e.stopPropagation();
                item.action();
                this._closeContextMenu();
            });
            menu.appendChild(el);
        }

        document.body.appendChild(menu);
        this._contextMenu = menu;
    }

    _closeContextMenu() {
        if (this._contextMenu) {
            this._contextMenu.remove();
            this._contextMenu = null;
        }
    }

    _clearBar(bar) {
        if (bar < this.arrangement.length) {
            this.arrangement[bar] = { sceneId: null, repeat: 1 };
            this._fireArrangementChange();
            this.render();
        }
    }

    _duplicateBar(bar) {
        if (bar < this.arrangement.length) {
            const copy = { ...this.arrangement[bar] };
            this.arrangement.splice(bar + 1, 0, copy);
            this._fireArrangementChange();
            this.render();
        }
    }

    _insertBar(bar) {
        this.arrangement.splice(bar, 0, { sceneId: null, repeat: 1 });
        this._fireArrangementChange();
        this.render();
    }

    _deleteBar(bar) {
        if (bar < this.arrangement.length) {
            this.arrangement.splice(bar, 1);
            if (this.selectedCell && this.selectedCell.bar >= this.arrangement.length) {
                this.selectedCell = null;
            }
            this._fireArrangementChange();
            this.render();
        }
    }

    // ── Scene palette (sidebar) ──────────────────────────────────

    _renderSceneList() {
        this.sceneList.innerHTML = '';
        for (const scene of this.scenes) {
            const card = document.createElement('div');
            card.className = 'arr-scene-card';
            if (this.selectedScene === scene.id) card.classList.add('selected');
            card.draggable = true;
            card.innerHTML = `
                <div class="arr-scene-dot" style="background:${scene.color}"></div>
                <span class="arr-scene-name">${scene.name}</span>
                <span class="arr-scene-steps">${scene.length}st</span>
            `;

            card.addEventListener('click', () => {
                this.selectedScene = scene.id;
                this._renderSceneList();
            });

            card.addEventListener('dblclick', () => {
                const input = document.createElement('input');
                input.value = scene.name;
                input.style.cssText = `
                    width: 60px; background: #0a0a0f; border: 1px solid #00d4ff66;
                    color: #b0b8c8; font-size: 10px; font-family: inherit;
                    padding: 1px 4px; border-radius: 3px; outline: none;
                `;
                const nameEl = card.querySelector('.arr-scene-name');
                nameEl.replaceWith(input);
                input.focus();
                input.select();
                const commit = () => {
                    scene.name = input.value || scene.name;
                    this._renderSceneList();
                    this.render();
                };
                input.addEventListener('blur', commit);
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter') commit();
                });
            });

            card.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', String(scene.id));
                this.dragScene = scene.id;
            });

            this.sceneList.appendChild(card);
        }
    }

    // ── Canvas sizing ────────────────────────────────────────────

    _resizeCanvas() {
        const totalBars = Math.max(this.getTotalBars(), 16);
        const w = totalBars * CELL_W;
        const h = HEADER_H + ROW_LABELS.length * CELL_H;
        this.canvas.width = Math.max(w, this.canvasWrap.clientWidth);
        this.canvas.height = Math.max(h, this.canvasWrap.clientHeight);
        this.render();
    }

    // ── Canvas rendering ─────────────────────────────────────────

    render() {
        const ctx = this.ctx;
        if (!ctx) return;
        const totalBars = Math.max(this.getTotalBars(), 16);
        const cw = this.canvas.width;
        const ch = this.canvas.height;

        // Background
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, cw, ch);

        // Header bar numbers
        ctx.fillStyle = '#303848';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        for (let b = 0; b < totalBars; b++) {
            const x = b * CELL_W;
            ctx.fillText(String(b + 1), x + CELL_W / 2, 16);
            // Vertical grid
            ctx.strokeStyle = '#111520';
            ctx.beginPath();
            ctx.moveTo(x, HEADER_H);
            ctx.lineTo(x, ch);
            ctx.stroke();
        }

        // Horizontal divider under header
        ctx.strokeStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.moveTo(0, HEADER_H);
        ctx.lineTo(cw, HEADER_H);
        ctx.stroke();

        // Rows
        for (let r = 0; r < ROW_LABELS.length; r++) {
            const y = HEADER_H + r * CELL_H;

            // Row divider
            if (r > 0) {
                ctx.strokeStyle = '#141420';
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(cw, y);
                ctx.stroke();
            }

            // Cells
            for (let b = 0; b < totalBars; b++) {
                const x = b * CELL_W;
                const entry = this.arrangement[b];
                const scene = entry && entry.sceneId !== null
                    ? this.scenes.find(s => s.id === entry.sceneId) : null;

                if (scene) {
                    // Filled cell
                    ctx.fillStyle = scene.color + '22';
                    ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);

                    // Scene name
                    ctx.fillStyle = scene.color;
                    ctx.font = '9px monospace';
                    ctx.textAlign = 'left';
                    ctx.fillText(
                        scene.name.substring(0, 8),
                        x + 4, y + 12
                    );

                    // Mini preview
                    this._drawMiniPreview(ctx, scene, r, x, y);
                } else {
                    // Empty cell subtle grid
                    ctx.fillStyle = '#0d0d15';
                    ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
                }

                // Selection highlight
                if (this.selectedCell &&
                    this.selectedCell.bar === b &&
                    this.selectedCell.row === r) {
                    ctx.strokeStyle = '#00d4ff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
                    ctx.lineWidth = 1;
                }
            }
        }

        // Playhead
        if (this.isPlaying && this.mode === 'song') {
            const px = this.playheadBar * CELL_W + CELL_W / 2;
            // Glow
            ctx.shadowColor = '#00d4ff';
            ctx.shadowBlur = 12;
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, HEADER_H);
            ctx.lineTo(px, HEADER_H + ROW_LABELS.length * CELL_H);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1;

            // Highlight current bar cells
            for (let r = 0; r < ROW_LABELS.length; r++) {
                const y = HEADER_H + r * CELL_H;
                ctx.fillStyle = '#00d4ff0a';
                ctx.fillRect(
                    this.playheadBar * CELL_W + 1, y + 1,
                    CELL_W - 2, CELL_H - 2
                );
            }
        }

        // Update bar label
        this.barLabel.textContent =
            `BAR ${this.playheadBar + 1} / ${this.getTotalBars()}`;
    }

    _drawMiniPreview(ctx, scene, rowIndex, x, y) {
        if (rowIndex === 0 && scene.drumPattern) {
            // Drum dots
            ctx.fillStyle = scene.color + '88';
            const names = Object.keys(scene.drumPattern);
            const slotH = 16 / Math.max(names.length, 1);
            for (let i = 0; i < names.length; i++) {
                const steps = scene.drumPattern[names[i]];
                if (!steps) continue;
                for (let s = 0; s < steps.length; s++) {
                    if (steps[s]) {
                        const dx = x + 4 + (s / steps.length) * (CELL_W - 8);
                        const dy = y + 18 + i * slotH;
                        ctx.fillRect(dx, dy, 2, 2);
                    }
                }
            }
        } else if (rowIndex === 1 && scene.synthNotes) {
            // Synth note lines
            ctx.strokeStyle = scene.color + '66';
            ctx.lineWidth = 1;
            for (const note of scene.synthNotes) {
                const nx = x + 4 + (note.start / scene.length) * (CELL_W - 8);
                const nw = Math.max((note.duration / scene.length) * (CELL_W - 8), 2);
                const ny = y + 18 + ((84 - note.midi) / 48) * 16;
                ctx.fillStyle = scene.color + '55';
                ctx.fillRect(nx, Math.max(ny, y + 16), nw, 2);
            }
            ctx.lineWidth = 1;
        }
    }

    // ── Callback registration ────────────────────────────────────

    onModeChange(cb)        { this._onModeChange = cb; }
    onSceneChange(cb)       { this._onSceneChange = cb; }
    onArrangementChange(cb) { this._onArrangementChange = cb; }

    _fireArrangementChange() {
        if (this._onArrangementChange) {
            this._onArrangementChange(this.getArrangement());
        }
    }

    // ── Public API ───────────────────────────────────────────────

    getArrangement() {
        return {
            scenes: this.scenes.map(s => ({ ...s })),
            arrangement: this.arrangement.map(a => ({ ...a })),
            mode: this.mode
        };
    }

    setArrangement(data) {
        if (data.scenes) this.scenes = data.scenes.map(s => ({ ...s }));
        if (data.arrangement) this.arrangement = data.arrangement.map(a => ({ ...a }));
        if (data.mode) this._setMode(data.mode);
        this._renderSceneList();
        this._resizeCanvas();
    }

    addScene(scene) {
        scene.id = scene.id !== undefined ? scene.id : this.scenes.length;
        scene.color = scene.color || SCENE_COLORS[scene.id % SCENE_COLORS.length];
        scene.length = scene.length || 16;
        this.scenes.push(scene);
        this._renderSceneList();
        this._resizeCanvas();
        return scene;
    }

    captureCurrentScene(drumPattern, synthNotes, name) {
        const id = this.scenes.length;
        const scene = {
            id,
            name: name || `Scene ${id + 1}`,
            color: SCENE_COLORS[id % SCENE_COLORS.length],
            drumPattern: this._cloneDrumPattern(drumPattern),
            synthNotes: synthNotes ? synthNotes.map(n => ({ ...n })) : [],
            length: 16
        };
        this.addScene(scene);
        return scene;
    }

    _cloneDrumPattern(pat) {
        if (!pat) return {};
        const out = {};
        for (const key of Object.keys(pat)) {
            out[key] = Array.isArray(pat[key]) ? [...pat[key]] : pat[key];
        }
        return out;
    }

    setPlayheadBar(bar) {
        const prevBar = this.playheadBar;
        this.playheadBar = bar;
        this.render();

        // Fire scene change if the scene at this bar differs from previous
        if (this._onSceneChange && bar !== prevBar) {
            const scene = this.getSceneAtBar(bar);
            if (scene) this._onSceneChange(bar, scene);
        }

        // Auto-scroll canvas to keep playhead visible
        if (this.mode === 'song' && this.isPlaying) {
            const px = bar * CELL_W;
            const viewLeft = this.canvasWrap.scrollLeft;
            const viewRight = viewLeft + this.canvasWrap.clientWidth;
            if (px < viewLeft || px + CELL_W > viewRight) {
                this.canvasWrap.scrollLeft = px - CELL_W;
            }
        }
    }

    getSceneAtBar(bar) {
        // Expand arrangement with repeats to find the scene at a given bar
        let currentBar = 0;
        for (const entry of this.arrangement) {
            if (entry.sceneId === null) {
                currentBar++;
                if (currentBar > bar) return null;
                continue;
            }
            const repeat = entry.repeat || 1;
            if (bar < currentBar + repeat) {
                return this.scenes.find(s => s.id === entry.sceneId) || null;
            }
            currentBar += repeat;
        }
        return null;
    }

    getTotalBars() {
        let total = 0;
        for (const entry of this.arrangement) {
            total += entry.repeat || 1;
        }
        return total;
    }

    getMode() {
        return this.mode;
    }
}
