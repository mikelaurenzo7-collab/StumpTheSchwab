/**
 * NOVA DAW - Project Manager
 * Handles project save/load via localStorage and audio recording/export.
 */

const STORAGE_PREFIX = 'nova_project_';

export default class ProjectManager {
    constructor() {
        this._isRecording = false;
        this._mediaRecorder = null;
        this._recordedChunks = [];
    }

    // ═══════════════════════════════════════════════════════════════
    //  Project Save / Load (localStorage)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Save project state to localStorage.
     * @param {string} name
     * @param {object} state
     */
    saveProject(name, state) {
        const key = STORAGE_PREFIX + name;
        const data = {
            name,
            date: new Date().toISOString(),
            version: '2.0',
            state
        };
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('[ProjectManager] Save failed:', e);
            alert('Save failed — localStorage may be full.');
        }
    }

    /**
     * Load project state from localStorage.
     * @param {string} name
     * @returns {object|null}
     */
    loadProject(name) {
        const key = STORAGE_PREFIX + name;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const data = JSON.parse(raw);
            return data.state || null;
        } catch (e) {
            console.error('[ProjectManager] Load failed:', e);
            return null;
        }
    }

    /**
     * List all saved projects.
     * @returns {Array<{name: string, date: string}>}
     */
    listProjects() {
        const projects = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key.startsWith(STORAGE_PREFIX)) continue;
            try {
                const data = JSON.parse(localStorage.getItem(key));
                projects.push({
                    name: data.name || key.slice(STORAGE_PREFIX.length),
                    date: data.date || 'Unknown'
                });
            } catch (_) {
                // Skip corrupt entries
            }
        }
        return projects.sort((a, b) => b.date.localeCompare(a.date));
    }

    /**
     * Delete a saved project.
     * @param {string} name
     */
    deleteProject(name) {
        localStorage.removeItem(STORAGE_PREFIX + name);
    }

    // ═══════════════════════════════════════════════════════════════
    //  JSON Import / Export
    // ═══════════════════════════════════════════════════════════════

    /**
     * Export project state as a downloadable .nova.json file.
     * @param {object} state
     * @param {string} filename
     */
    exportProjectJSON(state, filename = 'nova-project') {
        const data = {
            format: 'nova-daw',
            version: '2.0',
            date: new Date().toISOString(),
            state
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this._downloadBlob(blob, `${filename}.nova.json`);
    }

    /**
     * Import a .nova.json file.
     * @param {File} file
     * @returns {Promise<object>}
     */
    importProjectJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result);
                    if (data.format !== 'nova-daw') {
                        reject(new Error('Invalid NOVA project file'));
                        return;
                    }
                    resolve(data.state);
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Audio Recording / Export
    // ═══════════════════════════════════════════════════════════════

    /**
     * Start recording audio from a Web Audio node.
     * Uses MediaRecorder with MediaStreamDestination for real-time capture.
     * @param {AudioContext} audioContext
     * @param {AudioNode} sourceNode - The node to record from (e.g., master gain)
     */
    startRecording(audioContext, sourceNode) {
        if (this._isRecording) return;

        const dest = audioContext.createMediaStreamDestination();
        sourceNode.connect(dest);

        this._recordedChunks = [];
        this._streamDest = dest;

        // Determine supported MIME type
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg'
        ];
        let mimeType = '';
        for (const mt of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mt)) {
                mimeType = mt;
                break;
            }
        }

        const options = mimeType ? { mimeType } : {};
        this._mediaRecorder = new MediaRecorder(dest.stream, options);

        this._mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this._recordedChunks.push(e.data);
            }
        };

        this._mediaRecorder.start(100); // Collect data every 100ms
        this._isRecording = true;
    }

    /**
     * Stop recording and return the audio as a Blob.
     * @returns {Promise<Blob>}
     */
    stopRecording() {
        return new Promise((resolve) => {
            if (!this._isRecording || !this._mediaRecorder) {
                resolve(new Blob());
                return;
            }

            this._mediaRecorder.onstop = () => {
                const blob = new Blob(this._recordedChunks, {
                    type: this._mediaRecorder.mimeType || 'audio/webm'
                });
                this._recordedChunks = [];
                this._isRecording = false;

                // Disconnect the stream destination
                if (this._streamDest) {
                    try { this._streamDest.disconnect(); } catch (_) {}
                    this._streamDest = null;
                }

                resolve(blob);
            };

            this._mediaRecorder.stop();
        });
    }

    /**
     * Download a recorded audio blob.
     * @param {Blob} blob
     * @param {string} filename
     */
    downloadRecording(blob, filename = 'nova-export.webm') {
        this._downloadBlob(blob, filename);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Utilities
    // ═══════════════════════════════════════════════════════════════

    /**
     * Trigger a browser download for a Blob.
     * @private
     */
    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);
    }
}
