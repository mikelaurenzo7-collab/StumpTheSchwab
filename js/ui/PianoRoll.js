const SCALES = {
    Chromatic:        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    Major:            [0, 2, 4, 5, 7, 9, 11],
    'Natural Minor':  [0, 2, 3, 5, 7, 8, 10],
    'Pentatonic Minor': [0, 3, 5, 7, 10],
    Blues:            [0, 3, 5, 6, 7, 10],
    Dorian:          [0, 2, 3, 5, 7, 9, 10],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const PIANO_KEY_WIDTH = 40;
const TOOLBAR_HEIGHT = 40;

export default class PianoRoll {
    constructor(container) {
        this.container = container;

        this.notes = [];
        this.viewRange = { startNote: 36, endNote: 84, startBeat: 0, endBeat: 16 };
        this.snapValue = 0.25;
        this.selectedNotes = new Set();
        this.tool = 'draw';
        this.scaleName = 'Chromatic';
        this.rootNote = 0;
        this.cellHeight = 14;
        this.beatWidth = 80;

        this.isDrawing = false;
        this.isDragging = false;
        this.drawingNoteIndex = -1;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsets = [];
        this.selectionRect = null;

        this.playheadBeat = -1;

        this.canvas = null;
        this.ctx = null;

        this._onNoteChange = null;
        this._onNotePreview = null;

        this._buildDOM();
        this._bindEvents();
        this.resize();
    }

    /* ------------------------------------------------------------------ */
    /*  DOM                                                                */
    /* ------------------------------------------------------------------ */

    _buildDOM() {
        this.container.innerHTML = '';

        const root = document.createElement('div');
        root.className = 'pianoroll-container';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'pianoroll-toolbar';
        toolbar.innerHTML = `
            <div class="tool-group">
                <button class="tool-btn active" data-tool="draw" title="Draw">\u270F\uFE0F Draw</button>
                <button class="tool-btn" data-tool="select" title="Select">\u25FB Select</button>
                <button class="tool-btn" data-tool="erase" title="Erase">\u2715 Erase</button>
            </div>
            <div class="snap-group">
                <label class="pianoroll-label">SNAP</label>
                <select class="snap-select" id="snap-select">
                    <option value="1">1 Bar</option>
                    <option value="0.5">1/2</option>
                    <option value="0.25" selected>1/4</option>
                    <option value="0.125">1/8</option>
                    <option value="0.0625">1/16</option>
                    <option value="0.03125">1/32</option>
                </select>
            </div>
            <div class="scale-group">
                <label class="pianoroll-label">SCALE</label>
                <select class="scale-select" id="scale-select">
                    <option value="Chromatic">Chromatic</option>
                    <option value="Major">Major</option>
                    <option value="Natural Minor" selected>Natural Minor</option>
                    <option value="Pentatonic Minor">Pentatonic Minor</option>
                    <option value="Blues">Blues</option>
                    <option value="Dorian">Dorian</option>
                </select>
            </div>
            <div class="key-group">
                <label class="pianoroll-label">KEY</label>
                <select class="key-select" id="key-select">
                    <option value="0">C</option>
                    <option value="1">C#</option>
                    <option value="2">D</option>
                    <option value="3">D#</option>
                    <option value="4">E</option>
                    <option value="5">F</option>
                    <option value="6">F#</option>
                    <option value="7">G</option>
                    <option value="8">G#</option>
                    <option value="9">A</option>
                    <option value="10">A#</option>
                    <option value="11">B</option>
                </select>
            </div>
            <button class="seq-btn" id="pr-clear">CLEAR</button>
        `;
        root.appendChild(toolbar);

        // Body + Canvas
        const body = document.createElement('div');
        body.className = 'pianoroll-body';

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'pianoroll-canvas';
        this.canvas.className = 'pianoroll-canvas';
        body.appendChild(this.canvas);
        root.appendChild(body);

        this.container.appendChild(root);
        this.ctx = this.canvas.getContext('2d');
        this.toolbar = toolbar;
        this.body = body;
    }

    /* ------------------------------------------------------------------ */
    /*  Events                                                             */
    /* ------------------------------------------------------------------ */

    _bindEvents() {
        // Tool buttons
        this.toolbar.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.toolbar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.tool = btn.dataset.tool;
            });
        });

        // Snap select
        this.toolbar.querySelector('#snap-select').addEventListener('change', e => {
            this.snapValue = parseFloat(e.target.value);
            this.render();
        });

        // Scale select
        this.toolbar.querySelector('#scale-select').addEventListener('change', e => {
            this.setScale(e.target.value, this.rootNote);
        });

        // Key select
        this.toolbar.querySelector('#key-select').addEventListener('change', e => {
            this.setScale(this.scaleName, parseInt(e.target.value, 10));
        });

        // Clear
        this.toolbar.querySelector('#pr-clear').addEventListener('click', () => {
            this.clear();
        });

        // Canvas mouse
        this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', e => this._onMouseUp(e));
        this.canvas.addEventListener('mouseleave', e => this._onMouseUp(e));
        this.canvas.addEventListener('wheel', e => this._onWheel(e), { passive: false });

        // Resize
        window.addEventListener('resize', () => this.resize());
    }

    /* ------------------------------------------------------------------ */
    /*  Coordinate helpers                                                 */
    /* ------------------------------------------------------------------ */

    _posToGrid(mx, my) {
        const beat = (mx - PIANO_KEY_WIDTH) / this.beatWidth + this.viewRange.startBeat;
        const midi = this.viewRange.endNote - 1 - Math.floor(my / this.cellHeight);
        return { beat, midi };
    }

    _snapBeat(beat) {
        return Math.round(beat / this.snapValue) * this.snapValue;
    }

    _noteToY(midi) {
        return (this.viewRange.endNote - 1 - midi) * this.cellHeight;
    }

    _beatToX(beat) {
        return PIANO_KEY_WIDTH + (beat - this.viewRange.startBeat) * this.beatWidth;
    }

    _isInScale(midi) {
        const intervals = SCALES[this.scaleName] || SCALES.Chromatic;
        const degree = ((midi % 12) - this.rootNote + 12) % 12;
        return intervals.includes(degree);
    }

    /* ------------------------------------------------------------------ */
    /*  Mouse handlers                                                     */
    /* ------------------------------------------------------------------ */

    _onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Click on piano keys area -> preview
        if (mx < PIANO_KEY_WIDTH) {
            const { midi } = this._posToGrid(PIANO_KEY_WIDTH, my);
            if (this._onNotePreview) this._onNotePreview(midi);
            return;
        }

        const { beat, midi } = this._posToGrid(mx, my);
        const snappedBeat = this._snapBeat(beat);

        if (this.tool === 'draw') {
            const existing = this.getNoteAt(beat, midi);
            if (existing === -1) {
                const note = { midi, start: snappedBeat, duration: this.snapValue, velocity: 0.8 };
                this.notes.push(note);
                this.drawingNoteIndex = this.notes.length - 1;
                this.isDrawing = true;
                this.render();
            }
        } else if (this.tool === 'select') {
            const existing = this.getNoteAt(beat, midi);
            if (existing !== -1) {
                if (!this.selectedNotes.has(existing)) {
                    if (!e.shiftKey) this.selectedNotes.clear();
                    this.selectedNotes.add(existing);
                }
                this.isDragging = true;
                this.dragStartX = snappedBeat;
                this.dragStartY = midi;
                this.dragOffsets = [];
                for (const idx of this.selectedNotes) {
                    const n = this.notes[idx];
                    this.dragOffsets.push({ idx, dBeat: n.start - snappedBeat, dMidi: n.midi - midi });
                }
            } else {
                if (!e.shiftKey) this.selectedNotes.clear();
                this.selectionRect = { x0: beat, y0: midi, x1: beat, y1: midi };
                this.isDragging = true;
            }
            this.render();
        } else if (this.tool === 'erase') {
            const existing = this.getNoteAt(beat, midi);
            if (existing !== -1) {
                this.removeNote(existing);
            }
        }
    }

    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Piano key hover preview
        if (mx < PIANO_KEY_WIDTH) {
            const { midi } = this._posToGrid(PIANO_KEY_WIDTH, my);
            if (this._onNotePreview) this._onNotePreview(midi);
        }

        if (this.tool === 'draw' && this.isDrawing && this.drawingNoteIndex >= 0) {
            const { beat } = this._posToGrid(mx, my);
            const snapped = this._snapBeat(beat);
            const note = this.notes[this.drawingNoteIndex];
            const newDuration = Math.max(this.snapValue, snapped - note.start + this.snapValue);
            note.duration = newDuration;
            this.render();
        } else if (this.tool === 'select' && this.isDragging) {
            const { beat, midi } = this._posToGrid(mx, my);
            if (this.selectionRect) {
                this.selectionRect.x1 = beat;
                this.selectionRect.y1 = midi;
                this.render();
            } else if (this.dragOffsets.length) {
                const snappedBeat = this._snapBeat(beat);
                for (const off of this.dragOffsets) {
                    const n = this.notes[off.idx];
                    n.start = snappedBeat + off.dBeat;
                    n.midi = midi + off.dMidi;
                }
                this.render();
            }
        } else if (this.tool === 'erase' && e.buttons === 1) {
            const { beat, midi } = this._posToGrid(mx, my);
            const existing = this.getNoteAt(beat, midi);
            if (existing !== -1) {
                this.removeNote(existing);
            }
        }
    }

    _onMouseUp(_e) {
        if (this.tool === 'draw' && this.isDrawing) {
            this.isDrawing = false;
            this.drawingNoteIndex = -1;
            this._fireNoteChange();
        } else if (this.tool === 'select' && this.isDragging) {
            if (this.selectionRect) {
                const r = this.selectionRect;
                const minBeat = Math.min(r.x0, r.x1);
                const maxBeat = Math.max(r.x0, r.x1);
                const minMidi = Math.min(r.y0, r.y1);
                const maxMidi = Math.max(r.y0, r.y1);
                this.notes.forEach((n, i) => {
                    if (n.midi >= minMidi && n.midi <= maxMidi &&
                        n.start + n.duration > minBeat && n.start < maxBeat) {
                        this.selectedNotes.add(i);
                    }
                });
                this.selectionRect = null;
            } else {
                this._fireNoteChange();
            }
            this.isDragging = false;
            this.dragOffsets = [];
            this.render();
        }
        this.isDrawing = false;
        this.isDragging = false;
    }

    _onWheel(e) {
        e.preventDefault();
        const delta = Math.sign(e.deltaY);
        if (e.shiftKey) {
            // Horizontal scroll
            const shift = delta * 2;
            this.viewRange.startBeat += shift;
            this.viewRange.endBeat += shift;
            if (this.viewRange.startBeat < 0) {
                this.viewRange.endBeat -= this.viewRange.startBeat;
                this.viewRange.startBeat = 0;
            }
        } else {
            // Vertical scroll
            const shift = delta * 2;
            const newStart = this.viewRange.startNote - shift;
            const newEnd = this.viewRange.endNote - shift;
            if (newStart >= 0 && newEnd <= 128) {
                this.viewRange.startNote = newStart;
                this.viewRange.endNote = newEnd;
            }
        }
        this.render();
    }

    /* ------------------------------------------------------------------ */
    /*  Note hit detection                                                 */
    /* ------------------------------------------------------------------ */

    getNoteAt(beat, midi) {
        return this.notes.findIndex(n =>
            n.midi === midi &&
            beat >= n.start &&
            beat < n.start + n.duration
        );
    }

    /* ------------------------------------------------------------------ */
    /*  Rendering                                                          */
    /* ------------------------------------------------------------------ */

    render() {
        const { canvas, ctx } = this;
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#0d0d15';
        ctx.fillRect(0, 0, w, h);

        const totalRows = this.viewRange.endNote - this.viewRange.startNote;

        // -- Grid rows --
        for (let i = 0; i < totalRows; i++) {
            const midi = this.viewRange.endNote - 1 - i;
            const y = i * this.cellHeight;
            const semitone = midi % 12;
            const isBlack = BLACK_KEYS.has(semitone);
            const inScale = this._isInScale(midi);

            if (isBlack) {
                ctx.fillStyle = inScale ? '#151520' : '#101018';
            } else {
                ctx.fillStyle = inScale ? '#191926' : '#14141e';
            }
            ctx.fillRect(PIANO_KEY_WIDTH, y, w - PIANO_KEY_WIDTH, this.cellHeight);

            // Row border
            ctx.strokeStyle = '#1a1a2a';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(PIANO_KEY_WIDTH, y + this.cellHeight);
            ctx.lineTo(w, y + this.cellHeight);
            ctx.stroke();
        }

        // -- Grid columns (beat lines) --
        const beatStart = this.viewRange.startBeat;
        const beatEnd = this.viewRange.endBeat;
        const gridStep = this.snapValue;
        for (let b = Math.floor(beatStart / gridStep) * gridStep; b <= beatEnd; b += gridStep) {
            const x = this._beatToX(b);
            if (x < PIANO_KEY_WIDTH) continue;

            const isBeat = Math.abs(b - Math.round(b)) < 0.001;
            const isBar = Math.abs(b % 4) < 0.001;

            if (isBar) {
                ctx.strokeStyle = '#333345';
                ctx.lineWidth = 1.5;
            } else if (isBeat) {
                ctx.strokeStyle = '#252535';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = '#1a1a2a';
                ctx.lineWidth = 0.5;
            }

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // -- Piano keys --
        for (let i = 0; i < totalRows; i++) {
            const midi = this.viewRange.endNote - 1 - i;
            const y = i * this.cellHeight;
            const semitone = midi % 12;
            const isBlack = BLACK_KEYS.has(semitone);

            if (isBlack) {
                ctx.fillStyle = '#1a1a28';
                ctx.fillRect(0, y, PIANO_KEY_WIDTH * 0.7, this.cellHeight);
            } else {
                ctx.fillStyle = '#2a2a3a';
                ctx.fillRect(0, y, PIANO_KEY_WIDTH, this.cellHeight);
                // Border between white keys
                ctx.strokeStyle = '#1a1a2a';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(0, y + this.cellHeight);
                ctx.lineTo(PIANO_KEY_WIDTH, y + this.cellHeight);
                ctx.stroke();
            }

            // Label C notes
            if (semitone === 0) {
                const octave = Math.floor(midi / 12) - 1;
                ctx.fillStyle = '#aaaacc';
                ctx.font = '9px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(`C${octave}`, 4, y + this.cellHeight / 2);
            }
        }

        // Divider between keys and grid
        ctx.strokeStyle = '#333345';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PIANO_KEY_WIDTH, 0);
        ctx.lineTo(PIANO_KEY_WIDTH, h);
        ctx.stroke();

        // -- Notes --
        for (let i = 0; i < this.notes.length; i++) {
            const n = this.notes[i];
            if (n.midi < this.viewRange.startNote || n.midi >= this.viewRange.endNote) continue;
            if (n.start + n.duration < this.viewRange.startBeat || n.start > this.viewRange.endBeat) continue;

            const x = this._beatToX(n.start);
            const y = this._noteToY(n.midi);
            const noteW = n.duration * this.beatWidth;
            const noteH = this.cellHeight - 1;

            // Note body
            const alpha = 0.4 + n.velocity * 0.6;
            ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, noteW - 2, noteH - 1, 2);
            ctx.fill();

            // Selected border
            if (this.selectedNotes.has(i)) {
                ctx.strokeStyle = '#7b2fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(x + 1, y + 1, noteW - 2, noteH - 1, 2);
                ctx.stroke();
            }

            // Note label if wide enough
            if (noteW > 24) {
                const name = NOTE_NAMES[n.midi % 12] + (Math.floor(n.midi / 12) - 1);
                ctx.fillStyle = '#0d0d15';
                ctx.font = 'bold 8px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(name, x + 4, y + noteH / 2 + 1);
            }
        }

        // -- Selection rectangle --
        if (this.selectionRect) {
            const r = this.selectionRect;
            const x0 = this._beatToX(Math.min(r.x0, r.x1));
            const x1 = this._beatToX(Math.max(r.x0, r.x1));
            const y0 = this._noteToY(Math.max(r.y0, r.y1) + 1);
            const y1 = this._noteToY(Math.min(r.y0, r.y1));
            ctx.fillStyle = 'rgba(123, 47, 255, 0.12)';
            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
            ctx.strokeStyle = 'rgba(123, 47, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        }

        // -- Playhead --
        if (this.playheadBeat >= this.viewRange.startBeat && this.playheadBeat <= this.viewRange.endBeat) {
            const px = this._beatToX(this.playheadBeat);
            // Glow
            ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, h);
            ctx.stroke();
            // Core line
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, h);
            ctx.stroke();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Public API                                                         */
    /* ------------------------------------------------------------------ */

    addNote(midi, start, duration, velocity = 0.8) {
        this.notes.push({ midi, start, duration, velocity });
        this._fireNoteChange();
        this.render();
    }

    removeNote(index) {
        this.notes.splice(index, 1);
        // Adjust selected indices
        const updated = new Set();
        for (const i of this.selectedNotes) {
            if (i < index) updated.add(i);
            else if (i > index) updated.add(i - 1);
        }
        this.selectedNotes = updated;
        this._fireNoteChange();
        this.render();
    }

    setNotes(noteArray) {
        this.notes = noteArray.map(n => ({ ...n }));
        this.selectedNotes.clear();
        this.render();
    }

    getNotes() {
        return this.notes.map(n => ({ ...n }));
    }

    clear() {
        this.notes = [];
        this.selectedNotes.clear();
        this._fireNoteChange();
        this.render();
    }

    setScale(scaleName, rootNote) {
        this.scaleName = scaleName;
        this.rootNote = rootNote;
        this.render();
    }

    setSnap(value) {
        this.snapValue = value;
        this.render();
    }

    setPlayheadPosition(beat) {
        this.playheadBeat = beat;
        this.render();
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        this.canvas.width = rect.width;
        this.canvas.height = rect.height - TOOLBAR_HEIGHT;
        this.render();
    }

    onNoteChange(callback) {
        this._onNoteChange = callback;
    }

    onNotePreview(callback) {
        this._onNotePreview = callback;
    }

    _fireNoteChange() {
        if (this._onNoteChange) this._onNoteChange(this.getNotes());
    }
}
