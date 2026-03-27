/**
 * NOVA DAW — AutomationLane UI
 *
 * Canvas-based automation curve editor. Users can draw, erase, and smooth
 * automation curves for any parameter. Multiple lanes are stacked vertically
 * with a parameter selector and lane controls.
 *
 * Features:
 *   - Draw tool: click-drag to paint breakpoints
 *   - Erase tool: click-drag to remove breakpoints in a range
 *   - Line tool: click start → click end for straight ramp
 *   - Smooth button: averages neighboring breakpoints
 *   - Snap to grid (beat subdivisions)
 *   - Interpolation mode: linear / smooth / step
 *   - Record arm per lane
 *   - Lane enable/disable (bypass)
 *   - Visual playhead synced to transport
 */

const LANE_HEIGHT = 120;
const HEADER_HEIGHT = 32;
const TOOLBAR_HEIGHT = 40;
const RULER_HEIGHT = 24;
const BEAT_WIDTH = 60;
const POINT_RADIUS = 4;
const TOTAL_BEATS = 16; // matches 16-step sequencer (4 bars of 4/4)

// Available parameters for automation
const AUTOMATABLE_PARAMS = [
    { path: 'filter.frequency', label: 'Filter Cutoff', min: 20, max: 20000, default: 2000 },
    { path: 'filter.Q', label: 'Filter Resonance', min: 0, max: 20, default: 1 },
    { path: 'ampEnv.attack', label: 'Amp Attack', min: 0.001, max: 2, default: 0.01 },
    { path: 'ampEnv.release', label: 'Amp Release', min: 0.001, max: 3, default: 0.3 },
    { path: 'osc1.gain', label: 'Osc 1 Level', min: 0, max: 1, default: 0.8 },
    { path: 'osc2.gain', label: 'Osc 2 Level', min: 0, max: 1, default: 0.3 },
    { path: 'osc1.detune', label: 'Osc 1 Detune', min: -100, max: 100, default: 0 },
    { path: 'osc2.detune', label: 'Osc 2 Detune', min: -100, max: 100, default: 7 },
    { path: 'lfo.rate', label: 'LFO Rate', min: 0, max: 20, default: 0 },
    { path: 'lfo.depth', label: 'LFO Depth', min: 0, max: 1, default: 0 },
    { path: 'masterGain', label: 'Master Volume', min: 0, max: 1, default: 0.3 },
    { path: 'effects.reverb.wetDry', label: 'Reverb Wet', min: 0, max: 1, default: 0 },
    { path: 'effects.reverb.roomSize', label: 'Reverb Size', min: 0, max: 1, default: 0.5 },
    { path: 'effects.delay.wetDry', label: 'Delay Wet', min: 0, max: 1, default: 0 },
    { path: 'effects.delay.feedback', label: 'Delay Feedback', min: 0, max: 0.9, default: 0.3 },
    { path: 'effects.distortion.amount', label: 'Distortion', min: 0, max: 1, default: 0 },
    { path: 'effects.chorus.wetDry', label: 'Chorus Wet', min: 0, max: 1, default: 0 },
    { path: 'channel.0.volume', label: 'Ch 1 Volume', min: 0, max: 1, default: 0.8 },
    { path: 'channel.1.volume', label: 'Ch 2 Volume', min: 0, max: 1, default: 0.8 },
    { path: 'channel.2.volume', label: 'Ch 3 Volume', min: 0, max: 1, default: 0.8 },
    { path: 'channel.3.volume', label: 'Ch 4 Volume', min: 0, max: 1, default: 0.8 },
    { path: 'channel.4.volume', label: 'Ch 5 Volume', min: 0, max: 1, default: 0.8 },
    { path: 'channel.5.volume', label: 'Ch 6 Volume', min: 0, max: 1, default: 0.8 },
    { path: 'channel.6.volume', label: 'Ch 7 Volume', min: 0, max: 1, default: 0.8 },
    { path: 'channel.7.volume', label: 'Ch 8 Volume', min: 0, max: 1, default: 0.8 },
    { path: 'channel.0.pan', label: 'Ch 1 Pan', min: -1, max: 1, default: 0 },
    { path: 'channel.1.pan', label: 'Ch 2 Pan', min: -1, max: 1, default: 0 },
    { path: 'channel.2.pan', label: 'Ch 3 Pan', min: -1, max: 1, default: 0 },
    { path: 'channel.3.pan', label: 'Ch 4 Pan', min: -1, max: 1, default: 0 },
];

export { AUTOMATABLE_PARAMS };

export default class AutomationLane {
    constructor(container, automationEngine) {
        this.container = container;
        this.engine = automationEngine;

        // Active lanes being displayed
        this.activeLanes = []; // array of paramPath strings

        // Editing state
        this.tool = 'draw'; // 'draw' | 'erase' | 'line'
        this.snapValue = 0.25; // beats
        this.isDrawing = false;
        this.lineStart = null; // { time, value } for line tool

        // Playhead
        this.playheadBeat = -1;

        // Canvas
        this.canvas = null;
        this.ctx = null;

        // Scroll
        this.scrollX = 0;
        this.beatWidth = BEAT_WIDTH;

        // Colors per lane (cycle through)
        this.laneColors = [
            '#00d4ff', '#7b2fff', '#ff2f8b', '#2fff8b',
            '#ffb82f', '#ff5f2f', '#2fb4ff', '#b42fff'
        ];

        // Callbacks
        this._onLaneChange = null;

        this._buildDOM();
        this._bindEvents();
        this._draw();
    }

    // ─── DOM Construction ───────────────────────────────────────────

    _buildDOM() {
        this.container.innerHTML = '';

        const root = document.createElement('div');
        root.className = 'automation-container';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'automation-toolbar';
        toolbar.innerHTML = `
            <div class="auto-tool-group">
                <button class="auto-tool-btn active" data-tool="draw" title="Draw automation">DRAW</button>
                <button class="auto-tool-btn" data-tool="erase" title="Erase points">ERASE</button>
                <button class="auto-tool-btn" data-tool="line" title="Draw straight line">LINE</button>
            </div>
            <div class="auto-snap-group">
                <label class="auto-label">SNAP</label>
                <select class="auto-select auto-snap-select">
                    <option value="0">Off</option>
                    <option value="1">1 Beat</option>
                    <option value="0.5">1/2</option>
                    <option value="0.25" selected>1/4</option>
                    <option value="0.125">1/8</option>
                    <option value="0.0625">1/16</option>
                </select>
            </div>
            <div class="auto-interp-group">
                <label class="auto-label">CURVE</label>
                <select class="auto-select auto-interp-select">
                    <option value="linear">Linear</option>
                    <option value="smooth">Smooth</option>
                    <option value="step">Step</option>
                </select>
            </div>
            <div class="auto-action-group">
                <button class="auto-action-btn" data-action="smooth" title="Smooth selected lane">SMOOTH</button>
                <button class="auto-action-btn" data-action="clear" title="Clear selected lane">CLEAR</button>
            </div>
            <div class="auto-add-group">
                <select class="auto-select auto-param-select">
                    <option value="">+ Add Parameter...</option>
                </select>
            </div>
        `;
        root.appendChild(toolbar);

        // Populate parameter dropdown
        const paramSelect = toolbar.querySelector('.auto-param-select');
        AUTOMATABLE_PARAMS.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.path;
            opt.textContent = p.label;
            paramSelect.appendChild(opt);
        });

        // Canvas area (lanes + ruler)
        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'automation-canvas-wrap';

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'automation-canvas';
        canvasWrap.appendChild(this.canvas);
        root.appendChild(canvasWrap);

        // Lane list (shows active lanes with controls)
        this.laneList = document.createElement('div');
        this.laneList.className = 'automation-lane-list';
        root.appendChild(this.laneList);

        this.container.appendChild(root);
        this.ctx = this.canvas.getContext('2d');

        this._resizeCanvas();
    }

    // ─── Event Binding ──────────────────────────────────────────────

    _bindEvents() {
        // Tool buttons
        this.container.querySelectorAll('.auto-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.auto-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.tool = btn.dataset.tool;
                this.lineStart = null;
                this.canvas.style.cursor = this.tool === 'erase' ? 'crosshair' : 'default';
            });
        });

        // Snap select
        this.container.querySelector('.auto-snap-select').addEventListener('change', (e) => {
            this.snapValue = parseFloat(e.target.value);
        });

        // Interpolation select
        this.container.querySelector('.auto-interp-select').addEventListener('change', (e) => {
            const mode = e.target.value;
            this.activeLanes.forEach(path => {
                this.engine.setInterpolation(path, mode);
            });
            this._draw();
        });

        // Action buttons
        this.container.querySelectorAll('.auto-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'smooth') {
                    this.activeLanes.forEach(path => this.engine.smoothLane(path));
                    this._draw();
                } else if (action === 'clear') {
                    this.activeLanes.forEach(path => this.engine.clearLane(path));
                    this._draw();
                    this._fireLaneChange();
                }
            });
        });

        // Add parameter
        this.container.querySelector('.auto-param-select').addEventListener('change', (e) => {
            const path = e.target.value;
            if (!path) return;

            this.addLane(path);
            e.target.value = ''; // Reset dropdown
        });

        // Canvas mouse events
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this._onMouseUp(null));

        // Canvas wheel for horizontal scroll
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Zoom
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                this.beatWidth = Math.max(20, Math.min(200, this.beatWidth * zoomFactor));
            } else {
                // Scroll
                this.scrollX = Math.max(0, this.scrollX + e.deltaY * 0.5);
            }
            this._draw();
        });

        // Resize observer
        const ro = new ResizeObserver(() => {
            this._resizeCanvas();
            this._draw();
        });
        ro.observe(this.container);
    }

    // ─── Lane Management ────────────────────────────────────────────

    addLane(paramPath) {
        if (this.activeLanes.includes(paramPath)) return;

        const paramDef = AUTOMATABLE_PARAMS.find(p => p.path === paramPath);
        if (!paramDef) return;

        this.engine.createLane(paramPath, {
            min: paramDef.min,
            max: paramDef.max,
            label: paramDef.label,
            defaultValue: (paramDef.default - paramDef.min) / (paramDef.max - paramDef.min)
        });

        this.activeLanes.push(paramPath);
        this._buildLaneList();
        this._resizeCanvas();
        this._draw();
    }

    removeLane(paramPath) {
        const idx = this.activeLanes.indexOf(paramPath);
        if (idx === -1) return;

        this.activeLanes.splice(idx, 1);
        this.engine.removeLane(paramPath);
        this._buildLaneList();
        this._resizeCanvas();
        this._draw();
    }

    _buildLaneList() {
        this.laneList.innerHTML = '';

        this.activeLanes.forEach((path, i) => {
            const lane = this.engine.getLane(path);
            if (!lane) return;

            const color = this.laneColors[i % this.laneColors.length];
            const item = document.createElement('div');
            item.className = 'automation-lane-item';
            item.innerHTML = `
                <div class="auto-lane-color" style="background:${color}"></div>
                <span class="auto-lane-label">${lane.label}</span>
                <button class="auto-lane-btn auto-lane-enable ${lane.enabled ? 'active' : ''}"
                        data-path="${path}" title="Enable/Disable">ON</button>
                <button class="auto-lane-btn auto-lane-arm"
                        data-path="${path}" title="Arm for recording">REC</button>
                <button class="auto-lane-btn auto-lane-remove"
                        data-path="${path}" title="Remove lane">&times;</button>
            `;
            this.laneList.appendChild(item);

            // Enable toggle
            item.querySelector('.auto-lane-enable').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const enabled = !btn.classList.contains('active');
                btn.classList.toggle('active', enabled);
                this.engine.setLaneEnabled(path, enabled);
                this._draw();
            });

            // Record arm
            item.querySelector('.auto-lane-arm').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const armed = !btn.classList.contains('armed');
                btn.classList.toggle('armed', armed);
                if (armed) {
                    this.engine.armLane(path);
                } else {
                    this.engine.disarmLane(path);
                }
            });

            // Remove
            item.querySelector('.auto-lane-remove').addEventListener('click', () => {
                this.removeLane(path);
                this._fireLaneChange();
            });
        });
    }

    // ─── Canvas ─────────────────────────────────────────────────────

    _resizeCanvas() {
        if (!this.canvas) return;
        const wrap = this.canvas.parentElement;
        if (!wrap) return;

        const dpr = window.devicePixelRatio || 1;
        const w = wrap.clientWidth;
        const laneCount = Math.max(1, this.activeLanes.length);
        const h = RULER_HEIGHT + laneCount * (LANE_HEIGHT + HEADER_HEIGHT);

        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.canvasWidth = w;
        this.canvasHeight = h;
    }

    // ─── Drawing ────────────────────────────────────────────────────

    _draw() {
        const ctx = this.ctx;
        const w = this.canvasWidth;
        const h = this.canvasHeight;
        if (!ctx || !w) return;

        ctx.clearRect(0, 0, w, h);

        // Draw ruler
        this._drawRuler(ctx, w);

        // Draw each lane
        const laneCount = this.activeLanes.length;
        for (let i = 0; i < laneCount; i++) {
            const path = this.activeLanes[i];
            const lane = this.engine.getLane(path);
            if (!lane) continue;

            const color = this.laneColors[i % this.laneColors.length];
            const yOffset = RULER_HEIGHT + i * (LANE_HEIGHT + HEADER_HEIGHT);

            this._drawLaneHeader(ctx, lane, color, yOffset, w);
            this._drawLaneBody(ctx, lane, color, yOffset + HEADER_HEIGHT, w);
        }

        // Draw playhead
        if (this.playheadBeat >= 0) {
            const x = this._beatToX(this.playheadBeat);
            if (x >= 0 && x <= w) {
                ctx.save();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Empty state
        if (laneCount === 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '14px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                'Add a parameter from the dropdown above to start automating',
                w / 2, RULER_HEIGHT + 60
            );
            ctx.restore();
        }
    }

    _drawRuler(ctx, w) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, 0, w, RULER_HEIGHT);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';

        for (let beat = 0; beat <= TOTAL_BEATS; beat++) {
            const x = this._beatToX(beat);
            if (x < 0 || x > w) continue;

            // Beat number label (every beat)
            if (beat % 4 === 0) {
                const bar = Math.floor(beat / 4) + 1;
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.fillText(`${bar}`, x, 16);
            }

            // Tick mark
            ctx.strokeStyle = beat % 4 === 0
                ? 'rgba(255,255,255,0.3)'
                : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = beat % 4 === 0 ? 1 : 0.5;
            ctx.beginPath();
            ctx.moveTo(x, RULER_HEIGHT - 6);
            ctx.lineTo(x, RULER_HEIGHT);
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawLaneHeader(ctx, lane, color, y, w) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, y, w, HEADER_HEIGHT);

        ctx.fillStyle = color;
        ctx.fillRect(0, y, 3, HEADER_HEIGHT);

        ctx.fillStyle = lane.enabled ? color : 'rgba(255,255,255,0.3)';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(lane.label.toUpperCase(), 10, y + 21);

        // Point count
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText(`${lane.points.length} pts`, w - 50, y + 21);

        ctx.restore();
    }

    _drawLaneBody(ctx, lane, color, y, w) {
        ctx.save();

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, y, w, LANE_HEIGHT);

        // Grid lines (beats)
        for (let beat = 0; beat <= TOTAL_BEATS; beat++) {
            const x = this._beatToX(beat);
            if (x < 0 || x > w) continue;

            ctx.strokeStyle = beat % 4 === 0
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + LANE_HEIGHT);
            ctx.stroke();
        }

        // Horizontal center line (0.5 value)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y + LANE_HEIGHT / 2);
        ctx.lineTo(w, y + LANE_HEIGHT / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (!lane.enabled) {
            ctx.globalAlpha = 0.3;
        }

        const points = lane.points;
        if (points.length === 0) {
            // Draw default value line
            const defY = y + LANE_HEIGHT - lane.defaultValue * LANE_HEIGHT;
            ctx.strokeStyle = color;
            ctx.globalAlpha *= 0.3;
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, defY);
            ctx.lineTo(w, defY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
            return;
        }

        // Draw filled area under curve
        ctx.beginPath();
        const firstX = this._beatToX(points[0].time);
        const firstY = y + LANE_HEIGHT - points[0].value * LANE_HEIGHT;

        // Extend from left edge at first point's value
        ctx.moveTo(0, firstY);
        ctx.lineTo(firstX, firstY);

        // Draw curve through all points
        if (lane.interpolation === 'step') {
            for (let i = 0; i < points.length; i++) {
                const px = this._beatToX(points[i].time);
                const py = y + LANE_HEIGHT - points[i].value * LANE_HEIGHT;
                if (i > 0) {
                    ctx.lineTo(px, y + LANE_HEIGHT - points[i - 1].value * LANE_HEIGHT);
                }
                ctx.lineTo(px, py);
            }
        } else if (lane.interpolation === 'smooth' && points.length >= 2) {
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i + 1];
                const x0 = this._beatToX(p0.time);
                const y0 = y + LANE_HEIGHT - p0.value * LANE_HEIGHT;
                const x1 = this._beatToX(p1.time);
                const y1 = y + LANE_HEIGHT - p1.value * LANE_HEIGHT;

                if (i === 0) ctx.lineTo(x0, y0);

                // Cubic bezier for smooth interpolation
                const cx = (x0 + x1) / 2;
                ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
            }
        } else {
            for (let i = 0; i < points.length; i++) {
                const px = this._beatToX(points[i].time);
                const py = y + LANE_HEIGHT - points[i].value * LANE_HEIGHT;
                ctx.lineTo(px, py);
            }
        }

        // Extend to right edge at last point's value
        const lastPt = points[points.length - 1];
        const lastX = this._beatToX(lastPt.time);
        const lastY = y + LANE_HEIGHT - lastPt.value * LANE_HEIGHT;
        ctx.lineTo(w, lastY);

        // Fill area
        ctx.lineTo(w, y + LANE_HEIGHT);
        ctx.lineTo(0, y + LANE_HEIGHT);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, y, 0, y + LANE_HEIGHT);
        grad.addColorStop(0, color + '30');
        grad.addColorStop(1, color + '05');
        ctx.fillStyle = grad;
        ctx.fill();

        // Draw curve line
        ctx.beginPath();
        ctx.moveTo(0, firstY);
        ctx.lineTo(firstX, firstY);

        if (lane.interpolation === 'step') {
            for (let i = 0; i < points.length; i++) {
                const px = this._beatToX(points[i].time);
                const py = y + LANE_HEIGHT - points[i].value * LANE_HEIGHT;
                if (i > 0) {
                    ctx.lineTo(px, y + LANE_HEIGHT - points[i - 1].value * LANE_HEIGHT);
                }
                ctx.lineTo(px, py);
            }
        } else if (lane.interpolation === 'smooth' && points.length >= 2) {
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i + 1];
                const x0 = this._beatToX(p0.time);
                const y0 = y + LANE_HEIGHT - p0.value * LANE_HEIGHT;
                const x1 = this._beatToX(p1.time);
                const y1 = y + LANE_HEIGHT - p1.value * LANE_HEIGHT;

                if (i === 0) ctx.lineTo(x0, y0);
                const cx = (x0 + x1) / 2;
                ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
            }
        } else {
            for (let i = 0; i < points.length; i++) {
                ctx.lineTo(this._beatToX(points[i].time),
                    y + LANE_HEIGHT - points[i].value * LANE_HEIGHT);
            }
        }
        ctx.lineTo(w, lastY);

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw breakpoints
        for (const pt of points) {
            const px = this._beatToX(pt.time);
            const py = y + LANE_HEIGHT - pt.value * LANE_HEIGHT;
            if (px < -10 || px > w + 10) continue;

            ctx.beginPath();
            ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Line tool preview
        if (this.lineStart && this.tool === 'line') {
            ctx.strokeStyle = '#ffffff80';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            const lx = this._beatToX(this.lineStart.time);
            const ly = y + LANE_HEIGHT - this.lineStart.value * LANE_HEIGHT;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            // Will be drawn to mouse position via overlay — just mark start
            ctx.arc(lx, ly, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    // ─── Coordinate Conversion ──────────────────────────────────────

    _beatToX(beat) {
        return (beat * this.beatWidth) - this.scrollX;
    }

    _xToBeat(x) {
        return (x + this.scrollX) / this.beatWidth;
    }

    _yToValue(y, laneIndex) {
        const laneY = RULER_HEIGHT + laneIndex * (LANE_HEIGHT + HEADER_HEIGHT) + HEADER_HEIGHT;
        const relY = y - laneY;
        return Math.max(0, Math.min(1, 1 - relY / LANE_HEIGHT));
    }

    _getLaneIndexAtY(y) {
        const adjusted = y - RULER_HEIGHT;
        if (adjusted < 0) return -1;

        const laneSlot = LANE_HEIGHT + HEADER_HEIGHT;
        const index = Math.floor(adjusted / laneSlot);
        if (index >= this.activeLanes.length) return -1;

        // Check if we're in the header or body
        const withinSlot = adjusted - index * laneSlot;
        if (withinSlot < HEADER_HEIGHT) return -1; // In header, not editable

        return index;
    }

    _snap(beat) {
        if (this.snapValue <= 0) return beat;
        return Math.round(beat / this.snapValue) * this.snapValue;
    }

    // ─── Mouse Handlers ─────────────────────────────────────────────

    _getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    _onMouseDown(e) {
        const { x, y } = this._getCanvasPos(e);
        const laneIdx = this._getLaneIndexAtY(y);
        if (laneIdx < 0) return;

        const beat = this._snap(this._xToBeat(x));
        const value = this._yToValue(y, laneIdx);
        const path = this.activeLanes[laneIdx];

        if (this.tool === 'draw') {
            this.isDrawing = true;
            this._drawingLaneIdx = laneIdx;
            this.engine.addPoint(path, beat, value);
            this._draw();
            this._fireLaneChange();
        } else if (this.tool === 'erase') {
            this.isDrawing = true;
            this._drawingLaneIdx = laneIdx;
            this._eraseStart = beat;
            this.engine.eraseRange(path, beat - 0.1, beat + 0.1);
            this._draw();
            this._fireLaneChange();
        } else if (this.tool === 'line') {
            if (!this.lineStart) {
                this.lineStart = { time: beat, value, laneIdx };
            } else {
                if (this.lineStart.laneIdx === laneIdx) {
                    // Draw line from start to here
                    const startTime = Math.min(this.lineStart.time, beat);
                    const endTime = Math.max(this.lineStart.time, beat);
                    const startVal = this.lineStart.time <= beat ? this.lineStart.value : value;
                    const endVal = this.lineStart.time <= beat ? value : this.lineStart.value;

                    // Clear existing points in range
                    this.engine.eraseRange(path, startTime, endTime);

                    // Generate evenly-spaced points
                    const step = this.snapValue > 0 ? this.snapValue : 0.25;
                    for (let t = startTime; t <= endTime; t += step) {
                        const progress = endTime > startTime ? (t - startTime) / (endTime - startTime) : 0;
                        const v = startVal + (endVal - startVal) * progress;
                        this.engine.addPoint(path, t, v);
                    }
                    // Ensure endpoint
                    this.engine.addPoint(path, endTime, endVal);
                }
                this.lineStart = null;
                this._draw();
                this._fireLaneChange();
            }
        }
    }

    _onMouseMove(e) {
        if (!this.isDrawing) return;

        const { x, y } = this._getCanvasPos(e);
        const laneIdx = this._drawingLaneIdx;
        if (laneIdx < 0 || laneIdx >= this.activeLanes.length) return;

        const beat = this._snap(this._xToBeat(x));
        const value = this._yToValue(y, laneIdx);
        const path = this.activeLanes[laneIdx];

        if (this.tool === 'draw') {
            this.engine.addPoint(path, beat, value);
            this._draw();
        } else if (this.tool === 'erase') {
            const start = Math.min(this._eraseStart, beat);
            const end = Math.max(this._eraseStart, beat);
            this.engine.eraseRange(path, start, end);
            this._draw();
        }
    }

    _onMouseUp(_e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this._fireLaneChange();
        }
    }

    // ─── Playback Integration ───────────────────────────────────────

    /**
     * Set playhead position (called from transport step callback).
     * @param {number} beat - current beat position
     */
    setPlayheadPosition(beat) {
        this.playheadBeat = beat;
        this._draw();
    }

    // ─── Resize ─────────────────────────────────────────────────────

    resize() {
        this._resizeCanvas();
        this._draw();
    }

    // ─── Callbacks ──────────────────────────────────────────────────

    onLaneChange(fn) {
        this._onLaneChange = fn;
    }

    _fireLaneChange() {
        if (this._onLaneChange) {
            this._onLaneChange(this.activeLanes.map(path => ({
                path,
                points: this.engine.getPoints(path)
            })));
        }
    }

    // ─── External API ───────────────────────────────────────────────

    /**
     * Get current state for serialization.
     */
    getState() {
        return {
            activeLanes: [...this.activeLanes],
            snapValue: this.snapValue,
            beatWidth: this.beatWidth,
            scrollX: this.scrollX
        };
    }

    /**
     * Restore state from project load.
     */
    restoreState(state) {
        if (!state) return;

        this.activeLanes = [];
        (state.activeLanes || []).forEach(path => {
            if (this.engine.getLane(path)) {
                this.activeLanes.push(path);
            }
        });

        this.snapValue = state.snapValue ?? 0.25;
        this.beatWidth = state.beatWidth ?? BEAT_WIDTH;
        this.scrollX = state.scrollX ?? 0;

        this._buildLaneList();
        this._resizeCanvas();
        this._draw();
    }
}
