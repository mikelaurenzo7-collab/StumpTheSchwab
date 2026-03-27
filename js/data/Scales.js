export default class Scales {

    static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    static SCALES = {
        'Major':            [0, 2, 4, 5, 7, 9, 11],
        'Natural Minor':    [0, 2, 3, 5, 7, 8, 10],
        'Harmonic Minor':   [0, 2, 3, 5, 7, 8, 11],
        'Melodic Minor':    [0, 2, 3, 5, 7, 9, 11],
        'Dorian':           [0, 2, 3, 5, 7, 9, 10],
        'Mixolydian':       [0, 2, 4, 5, 7, 9, 10],
        'Phrygian':         [0, 1, 3, 5, 7, 8, 10],
        'Lydian':           [0, 2, 4, 6, 7, 9, 11],
        'Pentatonic Major': [0, 2, 4, 7, 9],
        'Pentatonic Minor': [0, 3, 5, 7, 10],
        'Blues':            [0, 3, 5, 6, 7, 10],
        'Chromatic':        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        'Whole Tone':       [0, 2, 4, 6, 8, 10]
    };

    // ── Note / Frequency Utilities ──────────────────────────────────────

    /**
     * Convert note (0-11, C=0) and octave to frequency. A4 = 440 Hz.
     */
    static noteToFreq(note, octave) {
        const midi = (octave + 1) * 12 + note;
        return Scales.midiToFreq(midi);
    }

    /**
     * MIDI note number (0-127) to frequency in Hz.
     */
    static midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    /**
     * Frequency to nearest MIDI note number.
     */
    static freqToMidi(freq) {
        return Math.round(12 * Math.log2(freq / 440) + 69);
    }

    /**
     * Return human-readable name for a MIDI note, e.g. "C4", "F#3".
     */
    static noteName(midi) {
        const name = Scales.NOTE_NAMES[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        return `${name}${octave}`;
    }

    // ── Scale Queries ───────────────────────────────────────────────────

    /**
     * Get semitone-interval array for a named scale.
     */
    static getScale(name) {
        return Scales.SCALES[name] || null;
    }

    /**
     * Return every MIDI note (0-127) that belongs to the given scale and root.
     * @param {number} rootNote  0-11 (C=0)
     * @param {string} scaleName
     */
    static getScaleNotes(rootNote, scaleName) {
        const intervals = Scales.getScale(scaleName);
        if (!intervals) return [];

        const notes = [];
        for (let midi = 0; midi <= 127; midi++) {
            const degree = ((midi - rootNote) % 12 + 12) % 12;
            if (intervals.includes(degree)) {
                notes.push(midi);
            }
        }
        return notes;
    }

    /**
     * Check whether a MIDI note belongs to a scale.
     */
    static isInScale(midiNote, rootNote, scaleName) {
        const intervals = Scales.getScale(scaleName);
        if (!intervals) return false;
        const degree = ((midiNote - rootNote) % 12 + 12) % 12;
        return intervals.includes(degree);
    }

    /**
     * Return all registered scale names.
     */
    static getScaleNames() {
        return Object.keys(Scales.SCALES);
    }

    // ── Chord Progressions ──────────────────────────────────────────────

    /**
     * Common chord progressions expressed as scale-degree numbers (1-based).
     */
    static getChordProgressions() {
        return {
            Pop:   [1, 5, 6, 4],
            Jazz:  [2, 5, 1],
            Blues: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5],
            Sad:   [6, 4, 1, 5],
            Epic:  [1, 3, 4, 5]
        };
    }

    // ── QWERTY Keyboard Mapping ─────────────────────────────────────────

    /**
     * Build a mapping from keyboard key to MIDI note number.
     *
     * Layout mirrors a piano:
     *   Bottom row  (z-m)            : white keys at baseOctave
     *   Sharp keys  (s,d,g,h,j)      : black keys at baseOctave
     *   Middle row  (q-u)            : white keys at baseOctave+1
     *   Sharp keys  (2,3,5,6,7)      : black keys at baseOctave+1
     *   Number keys 1-8 switch octave (returned for convenience)
     *
     * @param {number} baseOctave  Starting octave (default 4)
     * @returns {Object<string, number>}  key -> MIDI note
     */
    static getKeyboardMap(baseOctave = 4) {
        const base = (baseOctave + 1) * 12; // MIDI note for C at baseOctave
        const upper = base + 12;             // one octave up

        return {
            // ── Bottom row: white keys at baseOctave ────────────
            'z': base + 0,   // C
            's': base + 1,   // C#
            'x': base + 2,   // D
            'd': base + 3,   // D#
            'c': base + 4,   // E
            'v': base + 5,   // F
            'g': base + 6,   // F#
            'b': base + 7,   // G
            'h': base + 8,   // G#
            'n': base + 9,   // A
            'j': base + 10,  // A#
            'm': base + 11,  // B

            // ── Top row: white keys at baseOctave+1 ─────────────
            'q': upper + 0,  // C
            '2': upper + 1,  // C#
            'w': upper + 2,  // D
            '3': upper + 3,  // D#
            'e': upper + 4,  // E
            'r': upper + 5,  // F
            '5': upper + 6,  // F#
            't': upper + 7,  // G
            '6': upper + 8,  // G#
            'y': upper + 9,  // A
            '7': upper + 10, // A#
            'u': upper + 11, // B
            'i': upper + 12, // C  (baseOctave+2)
            '9': upper + 13, // C#
            'o': upper + 14, // D
            '0': upper + 15, // D#
            'p': upper + 16, // E

            // ── Octave switching keys ───────────────────────────
            '1': 1,
            '4': 4,
            '8': 8
        };
    }
}
