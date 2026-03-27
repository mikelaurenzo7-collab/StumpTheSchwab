// ═══════════════════════════════════════════════════════════════
// NOVA — Project Save/Load & Audio Export Manager
// Handles project persistence (localStorage + JSON files)
// and audio recording / offline bounce to WAV
// ═══════════════════════════════════════════════════════════════

const STORAGE_PREFIX = 'nova_project_';
const FILE_EXTENSION = '.nova.json';
const NOVA_VERSION = '2.0';

export default class ProjectManager {
    constructor() {
        // ── Recording state ──
        this._mediaRecorder = null;
        this._recordedChunks = [];
        this._recordingResolve = null;
        this._streamDest = null;
        this._sourceNode = null;
        this._isRecording = false;

        // ── UI state ──
        this._modal = null;
        this._overlay = null;
        this._fileInput = null;
        this._statusTimer = null;
        this._stylesInjected = false;
    }

    // ═══════════════════════════════════════════════════════════
    // 1.  PROJECT PERSISTENCE — localStorage
    // ═══════════════════════════════════════════════════════════

    /**
     * Save a complete project state to localStorage.
     * @param {string} name - Human-readable project name
     * @param {object} state - Full project state (BPM, patterns, mixer, etc.)
     * @returns {boolean} true on success
     */
    saveProject(name, state) {
        const key = STORAGE_PREFIX + this._sanitiseKey(name);
        const envelope = {
            format: 'nova-daw',
            version: NOVA_VERSION,
            name,
            date: new Date().toISOString(),
            state: this._cloneState(state)
        };
        try {
            localStorage.setItem(key, JSON.stringify(envelope));
            return true;
        } catch (err) {
            console.error('[ProjectManager] Save failed:', err);
            return false;
        }
    }

    /**
     * Load a project by name.
     * @param {string} name
     * @returns {object|null} The state object, or null if not found
     */
    loadProject(name) {
        const key = STORAGE_PREFIX + this._sanitiseKey(name);
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const envelope = JSON.parse(raw);
            return envelope.state || null;
        } catch (err) {
            console.error('[ProjectManager] Load failed:', err);
            return null;
        }
    }

    /**
     * List every saved project.
     * @returns {Array<{name: string, date: string}>}
     */
    listProjects() {
        const projects = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key.startsWith(STORAGE_PREFIX)) continue;
            try {
                const envelope = JSON.parse(localStorage.getItem(key));
                projects.push({
                    name: envelope.name || key.slice(STORAGE_PREFIX.length),
                    date: envelope.date || ''
                });
            } catch (_) {
                // Corrupt entry — skip silently
            }
        }
        projects.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return projects;
    }

    /**
     * Delete a saved project.
     * @param {string} name
     */
    deleteProject(name) {
        const key = STORAGE_PREFIX + this._sanitiseKey(name);
        localStorage.removeItem(key);
    }

    // ═══════════════════════════════════════════════════════════
    // 2.  PROJECT IMPORT / EXPORT — JSON files
    // ═══════════════════════════════════════════════════════════

    /**
     * Trigger a download of the project state as a .nova.json file.
     * @param {object} state
     * @param {string} [filename='nova-project']
     */
    exportProjectJSON(state, filename = 'nova-project') {
        const envelope = {
            format: 'nova-daw',
            version: NOVA_VERSION,
            name: filename,
            date: new Date().toISOString(),
            state: this._cloneState(state)
        };
        const json = JSON.stringify(envelope, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        this._triggerDownload(blob, filename + FILE_EXTENSION);
    }

    /**
     * Parse a .nova.json File object uploaded by the user.
     * @param {File} file
     * @returns {Promise<object>} Resolves with the project state
     */
    importProjectJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const envelope = JSON.parse(reader.result);
                    if (!envelope.state) {
                        reject(new Error('Invalid NOVA project file — missing state'));
                        return;
                    }
                    resolve(envelope.state);
                } catch (err) {
                    reject(new Error('Failed to parse project file: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Could not read file'));
            reader.readAsText(file);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 3.  AUDIO EXPORT — MediaRecorder (real-time capture)
    // ═══════════════════════════════════════════════════════════

    /**
     * Begin capturing audio from a Web Audio source node.
     * @param {AudioContext} audioContext
     * @param {AudioNode} sourceNode - The node to record from (e.g. master gain)
     */
    startRecording(audioContext, sourceNode) {
        if (this._isRecording) return;

        this._streamDest = audioContext.createMediaStreamDestination();
        this._sourceNode = sourceNode;
        sourceNode.connect(this._streamDest);

        this._recordedChunks = [];

        // Prefer webm/opus, fall back to whatever the browser supports
        const mimeType = this._pickMimeType();
        const options = mimeType ? { mimeType } : {};

        this._mediaRecorder = new MediaRecorder(this._streamDest.stream, options);

        this._mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                this._recordedChunks.push(e.data);
            }
        };

        this._mediaRecorder.onstop = () => {
            const mType = this._mediaRecorder.mimeType || 'audio/webm';
            const blob = new Blob(this._recordedChunks, { type: mType });
            this._recordedChunks = [];
            this._isRecording = false;

            // Disconnect the tap so it does not leak
            try {
                this._sourceNode.disconnect(this._streamDest);
            } catch (_) { /* already disconnected */ }
            this._streamDest = null;
            this._sourceNode = null;

            if (this._recordingResolve) {
                this._recordingResolve(blob);
                this._recordingResolve = null;
            }
        };

        this._mediaRecorder.start(100); // collect data every 100 ms
        this._isRecording = true;
    }

    /**
     * Stop recording and return the captured audio.
     * @returns {Promise<Blob>}
     */
    stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this._mediaRecorder || !this._isRecording) {
                reject(new Error('No active recording'));
                return;
            }
            this._recordingResolve = resolve;
            this._mediaRecorder.stop();
        });
    }

    /**
     * Trigger a download for a recorded audio blob.
     * @param {Blob} blob
     * @param {string} [filename='nova-recording']
     */
    downloadRecording(blob, filename = 'nova-recording') {
        const ext = blob.type.includes('ogg') ? '.ogg'
                  : blob.type.includes('mp4') ? '.m4a'
                  : '.webm';
        this._triggerDownload(blob, filename + ext);
    }

    // ═══════════════════════════════════════════════════════════
    // 4.  AUDIO EXPORT — Offline Bounce to WAV
    // ═══════════════════════════════════════════════════════════

    /**
     * Capture real-time audio from a live source node and encode
     * the result as a 16-bit stereo WAV file.
     *
     * @param {AudioContext} audioContext - The live audio context
     * @param {AudioNode} sourceNode - The node to capture from
     * @param {number} durationSeconds - How many seconds to capture
     * @returns {Promise<Blob>} WAV blob
     */
    bounceToWAV(audioContext, sourceNode, durationSeconds) {
        const sampleRate = audioContext.sampleRate;
        const totalFrames = Math.ceil(sampleRate * durationSeconds);
        const bufferSize = 4096;
        const capturedL = [];
        const capturedR = [];
        let framesCollected = 0;

        return new Promise((resolve) => {
            const splitter = audioContext.createChannelSplitter(2);
            const merger = audioContext.createChannelMerger(2);
            const processor = audioContext.createScriptProcessor(bufferSize, 2, 2);

            sourceNode.connect(splitter);
            splitter.connect(processor, 0, 0);
            splitter.connect(processor, 1, 1);
            // Connect processor to a silent destination so it runs
            processor.connect(merger);
            merger.connect(audioContext.destination);

            processor.onaudioprocess = (e) => {
                const inL = e.inputBuffer.getChannelData(0);
                const inR = e.inputBuffer.getChannelData(1);

                const remaining = totalFrames - framesCollected;
                const count = Math.min(inL.length, remaining);
                if (count <= 0) return;

                capturedL.push(new Float32Array(inL.subarray(0, count)));
                capturedR.push(new Float32Array(inR.subarray(0, count)));
                framesCollected += count;

                // Pass audio through unchanged
                const outL = e.outputBuffer.getChannelData(0);
                const outR = e.outputBuffer.getChannelData(1);
                outL.set(inL);
                outR.set(inR);

                if (framesCollected >= totalFrames) {
                    processor.onaudioprocess = null;
                    try { sourceNode.disconnect(splitter); } catch (_) {}
                    try { processor.disconnect(); } catch (_) {}
                    try { merger.disconnect(); } catch (_) {}

                    const left = this._concatenateFloat32(capturedL, totalFrames);
                    const right = this._concatenateFloat32(capturedR, totalFrames);
                    const wavBlob = this._encodeWAV(left, right, sampleRate);
                    resolve(wavBlob);
                }
            };
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 5.  UI — Save / Load / Export Modal
    // ═══════════════════════════════════════════════════════════

    /**
     * Build and inject the save/load UI into the given container.
     *
     * Returns an event-callback interface so the caller can wire
     * up application-specific logic (gathering state, restoring
     * state, etc.).
     *
     * @param {HTMLElement} container
     * @returns {object} Event hooks object with onSave, onLoad, onDelete,
     *                    onImport, onExport, onRecord, onBounce
     */
    buildSaveLoadUI(container) {
        this._injectStyles();

        // ── Callback registry ──
        const callbacks = {
            _save: null,
            _load: null,
            _delete: null,
            _import: null,
            _export: null,
            _record: null,
            _bounce: null,
            onSave(fn)   { this._save = fn; },
            onLoad(fn)   { this._load = fn; },
            onDelete(fn) { this._delete = fn; },
            onImport(fn) { this._import = fn; },
            onExport(fn) { this._export = fn; },
            onRecord(fn) { this._record = fn; },
            onBounce(fn) { this._bounce = fn; }
        };

        // ── Trigger button (sits in the host container) ──
        const triggerBtn = document.createElement('button');
        triggerBtn.className = 'nova-pm-trigger';
        triggerBtn.textContent = 'PROJECT';
        triggerBtn.title = 'Project Manager';
        container.appendChild(triggerBtn);

        // ── Overlay ──
        this._overlay = document.createElement('div');
        this._overlay.className = 'nova-pm-overlay';
        document.body.appendChild(this._overlay);

        // ── Modal shell ──
        this._modal = document.createElement('div');
        this._modal.className = 'nova-pm-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'nova-pm-header';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'nova-pm-title';
        titleSpan.textContent = 'PROJECT MANAGER';
        header.appendChild(titleSpan);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'nova-pm-close';
        closeBtn.textContent = '\u00D7';
        header.appendChild(closeBtn);
        this._modal.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'nova-pm-body';

        // ── Save Section ──
        const saveSection = this._buildSection('SAVE PROJECT');
        const saveRow = this._row();

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'nova-pm-input';
        nameInput.placeholder = 'Project name\u2026';
        nameInput.maxLength = 64;

        const saveBtn = this._btn('Save', 'primary');
        saveRow.append(nameInput, saveBtn);
        saveSection.appendChild(saveRow);
        body.appendChild(saveSection);

        // ── Load Section ──
        const loadSection = this._buildSection('LOAD PROJECT');
        const loadRow = this._row();

        const projectSelect = document.createElement('select');
        projectSelect.className = 'nova-pm-select';

        const loadBtn = this._btn('Load', 'primary');
        const deleteBtn = this._btn('Delete', 'danger');
        loadRow.append(projectSelect, loadBtn, deleteBtn);
        loadSection.appendChild(loadRow);
        body.appendChild(loadSection);

        // ── Import / Export Section ──
        const ioSection = this._buildSection('IMPORT / EXPORT');
        const ioRow = this._row();

        const importBtn = this._btn('Import JSON', 'secondary');
        const exportBtn = this._btn('Export JSON', 'secondary');
        ioRow.append(importBtn, exportBtn);
        ioSection.appendChild(ioRow);
        body.appendChild(ioSection);

        // ── Audio Export Section ──
        const audioSection = this._buildSection('AUDIO EXPORT');
        const audioRow = this._row();

        const recordBtn = this._btn('Record', 'record');
        recordBtn.dataset.state = 'idle';

        const bounceBtn = this._btn('Bounce WAV', 'secondary');

        const bounceDurLabel = document.createElement('label');
        bounceDurLabel.className = 'nova-pm-label';
        bounceDurLabel.textContent = 'Duration (s):';

        const bounceDurInput = document.createElement('input');
        bounceDurInput.type = 'number';
        bounceDurInput.className = 'nova-pm-input nova-pm-input-sm';
        bounceDurInput.value = '8';
        bounceDurInput.min = '1';
        bounceDurInput.max = '300';
        bounceDurInput.step = '1';

        audioRow.append(recordBtn, bounceBtn, bounceDurLabel, bounceDurInput);
        audioSection.appendChild(audioRow);
        body.appendChild(audioSection);

        // ── Status bar ──
        const status = document.createElement('div');
        status.className = 'nova-pm-status';
        body.appendChild(status);

        this._modal.appendChild(body);
        document.body.appendChild(this._modal);

        // Hidden file input for JSON import
        this._fileInput = document.createElement('input');
        this._fileInput.type = 'file';
        this._fileInput.accept = '.json,.nova.json';
        this._fileInput.style.display = 'none';
        document.body.appendChild(this._fileInput);

        // ── Helpers ──
        const refreshList = () => {
            const projects = this.listProjects();
            projectSelect.innerHTML = '';
            if (projects.length === 0) {
                const opt = document.createElement('option');
                opt.textContent = '(no saved projects)';
                opt.disabled = true;
                opt.selected = true;
                projectSelect.appendChild(opt);
            } else {
                projects.forEach(p => {
                    const opt = document.createElement('option');
                    const d = p.date ? new Date(p.date).toLocaleString() : '';
                    opt.value = p.name;
                    opt.textContent = p.name + (d ? '  \u2014  ' + d : '');
                    projectSelect.appendChild(opt);
                });
            }
        };

        const setStatus = (msg, isError = false) => {
            status.textContent = msg;
            status.style.color = isError ? '#ff4466' : '#00d4ff';
            clearTimeout(this._statusTimer);
            this._statusTimer = setTimeout(() => { status.textContent = ''; }, 4000);
        };

        // ── Open / Close ──
        const openModal = () => {
            refreshList();
            this._modal.classList.add('open');
            this._overlay.classList.add('open');
        };

        const closeModal = () => {
            this._modal.classList.remove('open');
            this._overlay.classList.remove('open');
        };

        triggerBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        this._overlay.addEventListener('click', closeModal);

        // ── Save ──
        saveBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (!name) {
                setStatus('Enter a project name', true);
                return;
            }
            if (callbacks._save) callbacks._save(name);
            setStatus('Project saved: ' + name);
            nameInput.value = '';
            refreshList();
        });

        // ── Load ──
        loadBtn.addEventListener('click', () => {
            const name = projectSelect.value;
            if (!name) {
                setStatus('Select a project to load', true);
                return;
            }
            if (callbacks._load) callbacks._load(name);
            setStatus('Project loaded: ' + name);
        });

        // ── Delete ──
        deleteBtn.addEventListener('click', () => {
            const name = projectSelect.value;
            if (!name) {
                setStatus('Select a project to delete', true);
                return;
            }
            if (callbacks._delete) callbacks._delete(name);
            this.deleteProject(name);
            setStatus('Deleted: ' + name);
            refreshList();
        });

        // ── Import JSON ──
        importBtn.addEventListener('click', () => {
            this._fileInput.click();
        });

        this._fileInput.addEventListener('change', () => {
            const file = this._fileInput.files[0];
            if (!file) return;
            this.importProjectJSON(file).then(state => {
                if (callbacks._import) callbacks._import(state, file.name);
                setStatus('Imported: ' + file.name);
            }).catch(err => {
                setStatus(err.message, true);
            });
            this._fileInput.value = '';
        });

        // ── Export JSON ──
        exportBtn.addEventListener('click', () => {
            if (callbacks._export) callbacks._export();
            setStatus('Project exported');
        });

        // ── Record toggle ──
        recordBtn.addEventListener('click', () => {
            if (recordBtn.dataset.state === 'idle') {
                recordBtn.dataset.state = 'recording';
                recordBtn.textContent = '\u25A0 Stop';
                recordBtn.classList.add('nova-pm-recording');
                if (callbacks._record) callbacks._record('start');
                setStatus('Recording\u2026');
            } else {
                recordBtn.dataset.state = 'idle';
                recordBtn.textContent = 'Record';
                recordBtn.classList.remove('nova-pm-recording');
                if (callbacks._record) callbacks._record('stop');
                setStatus('Recording stopped');
            }
        });

        // ── Bounce WAV ──
        bounceBtn.addEventListener('click', () => {
            const dur = parseFloat(bounceDurInput.value) || 8;
            if (callbacks._bounce) callbacks._bounce(dur);
            setStatus('Bouncing ' + dur + 's of audio\u2026');
        });

        // Escape closes modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._modal.classList.contains('open')) {
                closeModal();
            }
        });

        return callbacks;
    }

    // ═══════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════

    /** Build a labelled section container */
    _buildSection(title) {
        const section = document.createElement('div');
        section.className = 'nova-pm-section';
        const label = document.createElement('div');
        label.className = 'nova-pm-section-label';
        label.textContent = title;
        section.appendChild(label);
        return section;
    }

    /** Build a flex row */
    _row() {
        const row = document.createElement('div');
        row.className = 'nova-pm-row';
        return row;
    }

    /** Build a themed button */
    _btn(text, variant) {
        const btn = document.createElement('button');
        btn.className = 'nova-pm-btn nova-pm-btn-' + variant;
        btn.textContent = text;
        return btn;
    }

    /** Sanitise a project name for use as a localStorage key suffix */
    _sanitiseKey(name) {
        return name.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim().toLowerCase();
    }

    /** Deep clone state to avoid reference leaks */
    _cloneState(state) {
        try {
            return JSON.parse(JSON.stringify(state));
        } catch (_) {
            return state;
        }
    }

    /** Pick the best MediaRecorder MIME type */
    _pickMimeType() {
        const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4'
        ];
        for (const mime of candidates) {
            if (typeof MediaRecorder !== 'undefined' &&
                MediaRecorder.isTypeSupported(mime)) {
                return mime;
            }
        }
        return '';
    }

    /** Trigger a browser file download from a Blob */
    _triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 1000);
    }

    /** Concatenate an array of Float32Arrays, capped at maxFrames */
    _concatenateFloat32(chunks, maxFrames) {
        const result = new Float32Array(maxFrames);
        let offset = 0;
        for (const chunk of chunks) {
            const count = Math.min(chunk.length, maxFrames - offset);
            result.set(chunk.subarray(0, count), offset);
            offset += count;
            if (offset >= maxFrames) break;
        }
        return result;
    }

    /**
     * Encode stereo PCM Float32 data into a WAV Blob.
     * 16-bit, 2-channel, little-endian RIFF/WAVE.
     */
    _encodeWAV(leftChannel, rightChannel, sampleRate) {
        const numChannels = 2;
        const bitsPerSample = 16;
        const numFrames = leftChannel.length;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataSize = numFrames * blockAlign;
        const headerSize = 44;
        const buffer = new ArrayBuffer(headerSize + dataSize);
        const view = new DataView(buffer);

        // RIFF header
        this._writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        this._writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        this._writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);                       // sub-chunk size
        view.setUint16(20, 1, true);                        // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);   // byte rate
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);

        // data sub-chunk
        this._writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Interleave L/R and convert float [-1,1] to int16
        let pos = headerSize;
        for (let i = 0; i < numFrames; i++) {
            const sL = Math.max(-1, Math.min(1, leftChannel[i]));
            const sR = Math.max(-1, Math.min(1, rightChannel[i]));
            view.setInt16(pos,     sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true);
            view.setInt16(pos + 2, sR < 0 ? sR * 0x8000 : sR * 0x7FFF, true);
            pos += 4;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /** Write an ASCII string into a DataView at a byte offset */
    _writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CSS — dark theme with cyan / purple accents
    // ═══════════════════════════════════════════════════════════

    _injectStyles() {
        if (this._stylesInjected) return;
        this._stylesInjected = true;

        const style = document.createElement('style');
        style.id = 'nova-pm-styles';
        style.textContent = `
/* ── Trigger Button ── */
.nova-pm-trigger {
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    color: #00d4ff;
    border: 1px solid #00d4ff44;
    padding: 6px 14px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.2px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.2s;
}
.nova-pm-trigger:hover {
    background: linear-gradient(135deg, #1a1a3e, #1a2a4e);
    border-color: #00d4ff88;
    box-shadow: 0 0 10px #00d4ff33;
}

/* ── Overlay ── */
.nova-pm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    z-index: 9998;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s;
}
.nova-pm-overlay.open {
    opacity: 1;
    pointer-events: auto;
}

/* ── Modal ── */
.nova-pm-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.92);
    width: 520px;
    max-width: 94vw;
    max-height: 88vh;
    background: linear-gradient(180deg, #0d0d1a 0%, #111126 100%);
    border: 1px solid #00d4ff33;
    border-radius: 10px;
    box-shadow: 0 0 40px rgba(0, 212, 255, 0.08),
                0 20px 60px rgba(0, 0, 0, 0.5);
    z-index: 9999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s, transform 0.25s;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
}
.nova-pm-modal.open {
    opacity: 1;
    pointer-events: auto;
    transform: translate(-50%, -50%) scale(1);
}

/* ── Header ── */
.nova-pm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: linear-gradient(90deg, #0a0a1a, #12122a);
    border-bottom: 1px solid #00d4ff22;
}
.nova-pm-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #00d4ff;
    text-transform: uppercase;
}
.nova-pm-close {
    background: none;
    border: none;
    color: #667;
    font-size: 22px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s;
}
.nova-pm-close:hover {
    color: #ff4466;
}

/* ── Body ── */
.nova-pm-body {
    padding: 16px 20px 20px;
    overflow-y: auto;
    flex: 1;
}

/* ── Sections ── */
.nova-pm-section {
    margin-bottom: 18px;
}
.nova-pm-section-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.6px;
    color: #7b2fff;
    text-transform: uppercase;
    margin-bottom: 8px;
}

/* ── Rows ── */
.nova-pm-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}

/* ── Inputs ── */
.nova-pm-input {
    flex: 1;
    min-width: 0;
    background: #0a0a18;
    border: 1px solid #222;
    border-radius: 4px;
    color: #ccc;
    padding: 7px 10px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
}
.nova-pm-input:focus {
    border-color: #00d4ff66;
}
.nova-pm-input-sm {
    flex: 0 0 70px;
    text-align: center;
}

/* ── Select ── */
.nova-pm-select {
    flex: 1;
    min-width: 0;
    background: #0a0a18;
    border: 1px solid #222;
    border-radius: 4px;
    color: #ccc;
    padding: 7px 10px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    appearance: none;
    cursor: pointer;
    transition: border-color 0.2s;
}
.nova-pm-select:focus {
    border-color: #00d4ff66;
}

/* ── Labels ── */
.nova-pm-label {
    font-size: 11px;
    color: #778;
    white-space: nowrap;
}

/* ── Buttons ── */
.nova-pm-btn {
    padding: 7px 16px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    letter-spacing: 0.6px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
    text-transform: uppercase;
}
.nova-pm-btn-primary {
    background: linear-gradient(135deg, #00b4d8, #0077b6);
    color: #fff;
    border-color: #00d4ff44;
}
.nova-pm-btn-primary:hover {
    background: linear-gradient(135deg, #00d4ff, #0096c7);
    box-shadow: 0 0 12px #00d4ff44;
}
.nova-pm-btn-secondary {
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    color: #aab;
    border-color: #334;
}
.nova-pm-btn-secondary:hover {
    color: #dde;
    border-color: #00d4ff44;
    box-shadow: 0 0 8px #00d4ff22;
}
.nova-pm-btn-danger {
    background: linear-gradient(135deg, #2a0a14, #3a1020);
    color: #ff6688;
    border-color: #ff446633;
}
.nova-pm-btn-danger:hover {
    background: linear-gradient(135deg, #3a0a14, #4a1020);
    box-shadow: 0 0 10px #ff446633;
}
.nova-pm-btn-record {
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    color: #ff4466;
    border-color: #ff446644;
}
.nova-pm-btn-record:hover {
    box-shadow: 0 0 10px #ff446633;
}
.nova-pm-btn-record.nova-pm-recording {
    background: linear-gradient(135deg, #4a0a1a, #5a1020);
    color: #ff4466;
    border-color: #ff4466;
    animation: nova-pm-pulse 1s ease-in-out infinite;
}

/* ── Status ── */
.nova-pm-status {
    margin-top: 12px;
    font-size: 11px;
    color: #00d4ff;
    min-height: 16px;
    transition: color 0.2s;
}

/* ── Recording pulse ── */
@keyframes nova-pm-pulse {
    0%, 100% { box-shadow: 0 0 6px #ff446644; }
    50%      { box-shadow: 0 0 18px #ff446688; }
}

/* ── Scrollbar ── */
.nova-pm-body::-webkit-scrollbar {
    width: 6px;
}
.nova-pm-body::-webkit-scrollbar-track {
    background: transparent;
}
.nova-pm-body::-webkit-scrollbar-thumb {
    background: #222;
    border-radius: 3px;
}
`;
        document.head.appendChild(style);
    }
}
