/**
 * UndoManager — Global undo/redo system for NOVA DAW.
 * Uses the command pattern: each undoable action carries its own undo/redo functions.
 */
export default class UndoManager {
    constructor(maxHistory = 50) {
        this._undoStack = [];
        this._redoStack = [];
        this._maxHistory = maxHistory;
        this._listeners = [];
        this._batching = false;
        this._batchCommands = [];
        this._batchDescription = '';
    }

    // ─── Core ────────────────────────────────────────────────────────

    push(command) {
        command.timestamp = command.timestamp || Date.now();

        if (this._batching) {
            this._batchCommands.push(command);
            return;
        }

        this._undoStack.push(command);
        this._redoStack.length = 0;

        if (this._undoStack.length > this._maxHistory) {
            this._undoStack.shift();
        }

        this._notify();
    }

    undo() {
        if (!this.canUndo()) return null;
        const command = this._undoStack.pop();
        command.undo();
        this._redoStack.push(command);
        this._notify();
        return command;
    }

    redo() {
        if (!this.canRedo()) return null;
        const command = this._redoStack.pop();
        command.redo();
        this._undoStack.push(command);
        this._notify();
        return command;
    }

    clear() {
        this._undoStack.length = 0;
        this._redoStack.length = 0;
        this._notify();
    }

    // ─── State ───────────────────────────────────────────────────────

    canUndo() {
        return this._undoStack.length > 0;
    }

    canRedo() {
        return this._redoStack.length > 0;
    }

    getUndoDescription() {
        if (!this.canUndo()) return '';
        return this._undoStack[this._undoStack.length - 1].description;
    }

    getRedoDescription() {
        if (!this.canRedo()) return '';
        return this._redoStack[this._redoStack.length - 1].description;
    }

    getHistory() {
        return [...this._undoStack]
            .reverse()
            .map(({ type, description, timestamp }) => ({ type, description, timestamp }));
    }

    // ─── Callbacks ───────────────────────────────────────────────────

    onChange(cb) {
        this._listeners.push(cb);
        return () => {
            this._listeners = this._listeners.filter(fn => fn !== cb);
        };
    }

    _notify() {
        const state = {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoDesc: this.getUndoDescription(),
            redoDesc: this.getRedoDescription()
        };
        for (const cb of this._listeners) {
            cb(state);
        }
    }

    // ─── Batch Operations ────────────────────────────────────────────

    beginBatch(description) {
        this._batching = true;
        this._batchCommands = [];
        this._batchDescription = description;
    }

    endBatch() {
        this._batching = false;
        const commands = this._batchCommands;
        this._batchCommands = [];

        if (commands.length === 0) return;

        const batchCommand = {
            type: 'batch',
            description: this._batchDescription,
            timestamp: Date.now(),
            undo: () => {
                for (let i = commands.length - 1; i >= 0; i--) {
                    commands[i].undo();
                }
            },
            redo: () => {
                for (const cmd of commands) {
                    cmd.redo();
                }
            }
        };

        this.push(batchCommand);
    }

    // ─── Helper Factories ────────────────────────────────────────────

    static noteCommand(pianoRoll, action, noteData) {
        const { note, time, duration, velocity } = noteData;
        const descriptions = {
            add: `Added note ${note}`,
            remove: `Removed note ${note}`,
            move: `Moved note ${note}`
        };

        if (action === 'add') {
            return {
                type: 'pianoroll:addNote',
                description: descriptions.add,
                undo: () => pianoRoll.removeNote(noteData),
                redo: () => pianoRoll.addNote(noteData)
            };
        }

        if (action === 'remove') {
            return {
                type: 'pianoroll:removeNote',
                description: descriptions.remove,
                undo: () => pianoRoll.addNote(noteData),
                redo: () => pianoRoll.removeNote(noteData)
            };
        }

        // move — noteData should include { ...noteProps, prevTime, prevNote }
        const { prevTime, prevNote } = noteData;
        return {
            type: 'pianoroll:moveNote',
            description: descriptions.move,
            undo: () => pianoRoll.moveNote(noteData, prevTime, prevNote),
            redo: () => pianoRoll.moveNote({ ...noteData, time: prevTime, note: prevNote }, time, note)
        };
    }

    static stepCommand(sequencer, drums, sound, step, oldVelocity, newVelocity) {
        const desc = newVelocity > 0
            ? `Enabled ${sound} step ${step + 1}`
            : `Disabled ${sound} step ${step + 1}`;

        return {
            type: 'sequencer:toggleStep',
            description: desc,
            undo: () => sequencer.setStep(drums, sound, step, oldVelocity),
            redo: () => sequencer.setStep(drums, sound, step, newVelocity)
        };
    }

    static paramCommand(target, param, oldValue, newValue, description) {
        return {
            type: 'synth:paramChange',
            description: description || `Changed ${param}`,
            undo: () => target.setParam(param, oldValue),
            redo: () => target.setParam(param, newValue)
        };
    }

    // ─── Keyboard Hint ───────────────────────────────────────────────

    getShortcutHint() {
        return 'Ctrl+Z / Ctrl+Shift+Z';
    }
}
