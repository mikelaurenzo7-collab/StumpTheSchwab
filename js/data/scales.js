// ============================================================================
// NOVA DAW - Music Theory Module
// Scales, chords, note utilities, and theory helpers
// ============================================================================

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Enharmonic aliases for display purposes
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const MIDI_MIN = 0;
export const MIDI_MAX = 127;
export const MIDDLE_C = 60;       // C4
export const A4_MIDI = 69;
export const A4_FREQ = 440;
export const SEMITONES_PER_OCTAVE = 12;

// ---------------------------------------------------------------------------
// Scales — intervals as semitones from root
// ---------------------------------------------------------------------------

export const SCALES = {
  // Diatonic modes
  'major':              { name: 'Major (Ionian)',       intervals: [0, 2, 4, 5, 7, 9, 11] },
  'minor':              { name: 'Minor (Aeolian)',      intervals: [0, 2, 3, 5, 7, 8, 10] },
  'dorian':             { name: 'Dorian',               intervals: [0, 2, 3, 5, 7, 9, 10] },
  'phrygian':           { name: 'Phrygian',             intervals: [0, 1, 3, 5, 7, 8, 10] },
  'lydian':             { name: 'Lydian',               intervals: [0, 2, 4, 6, 7, 9, 11] },
  'mixolydian':         { name: 'Mixolydian',           intervals: [0, 2, 4, 5, 7, 9, 10] },
  'locrian':            { name: 'Locrian',              intervals: [0, 1, 3, 5, 6, 8, 10] },

  // Melodic / harmonic variants
  'harmonicMinor':      { name: 'Harmonic Minor',       intervals: [0, 2, 3, 5, 7, 8, 11] },
  'melodicMinor':       { name: 'Melodic Minor',        intervals: [0, 2, 3, 5, 7, 9, 11] },

  // Pentatonic & blues
  'pentatonicMajor':    { name: 'Pentatonic Major',     intervals: [0, 2, 4, 7, 9] },
  'pentatonicMinor':    { name: 'Pentatonic Minor',     intervals: [0, 3, 5, 7, 10] },
  'blues':              { name: 'Blues',                 intervals: [0, 3, 5, 6, 7, 10] },

  // Symmetric
  'wholeTone':          { name: 'Whole Tone',           intervals: [0, 2, 4, 6, 8, 10] },
  'chromatic':          { name: 'Chromatic',            intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  'diminishedWH':       { name: 'Diminished (W-H)',     intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
  'diminishedHW':       { name: 'Diminished (H-W)',     intervals: [0, 1, 3, 4, 6, 7, 9, 10] },

  // World / exotic
  'hungarianMinor':     { name: 'Hungarian Minor',      intervals: [0, 2, 3, 6, 7, 8, 11] },
  'arabic':             { name: 'Arabic (Double Harmonic)', intervals: [0, 1, 4, 5, 7, 8, 11] },
  'japanese':           { name: 'Japanese (In-Sen)',     intervals: [0, 1, 5, 7, 10] }
};

// ---------------------------------------------------------------------------
// Chords — intervals as semitones from root
// ---------------------------------------------------------------------------

export const CHORDS = {
  // Triads
  'major':        { name: 'Major',           intervals: [0, 4, 7] },
  'minor':        { name: 'Minor',           intervals: [0, 3, 7] },
  'diminished':   { name: 'Diminished',      intervals: [0, 3, 6] },
  'augmented':    { name: 'Augmented',       intervals: [0, 4, 8] },

  // Seventh chords
  'maj7':         { name: 'Major 7th',       intervals: [0, 4, 7, 11] },
  'min7':         { name: 'Minor 7th',       intervals: [0, 3, 7, 10] },
  'dom7':         { name: 'Dominant 7th',    intervals: [0, 4, 7, 10] },
  'dim7':         { name: 'Diminished 7th',  intervals: [0, 3, 6, 9] },
  'minMaj7':      { name: 'Minor-Major 7th', intervals: [0, 3, 7, 11] },
  'aug7':         { name: 'Augmented 7th',   intervals: [0, 4, 8, 10] },
  'halfDim7':     { name: 'Half-Diminished 7th', intervals: [0, 3, 6, 10] },

  // Extended chords
  '9':            { name: 'Dominant 9th',    intervals: [0, 4, 7, 10, 14] },
  'maj9':         { name: 'Major 9th',       intervals: [0, 4, 7, 11, 14] },
  'min9':         { name: 'Minor 9th',       intervals: [0, 3, 7, 10, 14] },
  '11':           { name: 'Dominant 11th',   intervals: [0, 4, 7, 10, 14, 17] },
  'maj11':        { name: 'Major 11th',      intervals: [0, 4, 7, 11, 14, 17] },
  'min11':        { name: 'Minor 11th',      intervals: [0, 3, 7, 10, 14, 17] },
  '13':           { name: 'Dominant 13th',   intervals: [0, 4, 7, 10, 14, 17, 21] },

  // Suspended & added-tone
  'sus2':         { name: 'Suspended 2nd',   intervals: [0, 2, 7] },
  'sus4':         { name: 'Suspended 4th',   intervals: [0, 5, 7] },
  'add9':         { name: 'Add 9',           intervals: [0, 4, 7, 14] },
  '6':            { name: '6th',             intervals: [0, 4, 7, 9] },
  'min6':         { name: 'Minor 6th',       intervals: [0, 3, 7, 9] },

  // Power chord
  '5':            { name: 'Power (5th)',     intervals: [0, 7] }
};

// ---------------------------------------------------------------------------
// Diatonic chord quality lookup — used by getChordProgression
// For each scale degree (1-7) in a major scale, which chord quality is built.
// ---------------------------------------------------------------------------

const DIATONIC_CHORD_QUALITIES = {
  major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'],
  minor: ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'],
  dorian: ['minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major'],
  phrygian: ['minor', 'major', 'major', 'minor', 'diminished', 'major', 'minor'],
  lydian: ['major', 'major', 'minor', 'diminished', 'major', 'minor', 'minor'],
  mixolydian: ['major', 'minor', 'diminished', 'major', 'minor', 'minor', 'major'],
  locrian: ['diminished', 'major', 'minor', 'minor', 'major', 'major', 'minor'],
  harmonicMinor: ['minor', 'diminished', 'augmented', 'minor', 'major', 'major', 'diminished'],
  melodicMinor: ['minor', 'minor', 'augmented', 'major', 'major', 'diminished', 'diminished']
};

// ---------------------------------------------------------------------------
// Note / frequency conversion helpers
// ---------------------------------------------------------------------------

/**
 * Get frequency in Hz for a named note and octave.
 * e.g. getNoteFrequency('A', 4) => 440
 */
export function getNoteFrequency(note, octave) {
  const midi = noteNameToMidi(note + octave);
  return midiToFrequency(midi);
}

/**
 * MIDI note number to frequency in Hz.
 * A4 (69) = 440 Hz, equal temperament.
 */
export function midiToFrequency(midiNote) {
  return A4_FREQ * Math.pow(2, (midiNote - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

/**
 * Frequency in Hz to nearest MIDI note number.
 */
export function frequencyToMidi(freq) {
  if (freq <= 0) return 0;
  return Math.round(A4_MIDI + SEMITONES_PER_OCTAVE * Math.log2(freq / A4_FREQ));
}

/**
 * MIDI note number to human-readable name.
 * e.g. 60 => "C4", 69 => "A4"
 */
export function midiToNoteName(midi) {
  const noteIndex = ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
  const octave = Math.floor(midi / SEMITONES_PER_OCTAVE) - 1;
  return NOTE_NAMES[noteIndex] + octave;
}

/**
 * Note name string to MIDI number.
 * Accepts sharps (#) and flats (b).
 * e.g. "C4" => 60, "A#3" => 58, "Bb3" => 58
 */
export function noteNameToMidi(name) {
  const match = name.match(/^([A-Ga-g])(#{0,2}|b{0,2})(-?\d+)$/);
  if (!match) return -1;

  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const octave = parseInt(match[3], 10);

  const letterSemitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semitone = letterSemitones[letter];
  if (semitone === undefined) return -1;

  // Apply accidentals
  for (const ch of accidental) {
    if (ch === '#') semitone++;
    if (ch === 'b') semitone--;
  }

  return (octave + 1) * SEMITONES_PER_OCTAVE + semitone;
}

// ---------------------------------------------------------------------------
// Scale & chord note generation
// ---------------------------------------------------------------------------

/**
 * Return an array of MIDI note numbers for a given scale.
 * @param {string|number} root - Root note name (e.g. 'C') or MIDI pitch class 0-11
 * @param {string} scaleName - Key into SCALES
 * @param {number} octave - Starting octave (default 4)
 * @returns {number[]} Array of MIDI note numbers
 */
export function getScaleNotes(root, scaleName, octave = 4) {
  const scale = SCALES[scaleName];
  if (!scale) return [];

  const rootPc = typeof root === 'number' ? root : noteNameToPitchClass(root);
  const baseMidi = (octave + 1) * SEMITONES_PER_OCTAVE + rootPc;

  return scale.intervals.map(interval => baseMidi + interval);
}

/**
 * Return an array of MIDI note numbers for a given chord.
 * @param {string|number} root - Root note name (e.g. 'C') or pitch class 0-11
 * @param {string} chordName - Key into CHORDS
 * @param {number} octave - Starting octave (default 4)
 * @returns {number[]} Array of MIDI note numbers
 */
export function getChordNotes(root, chordName, octave = 4) {
  const chord = CHORDS[chordName];
  if (!chord) return [];

  const rootPc = typeof root === 'number' ? root : noteNameToPitchClass(root);
  const baseMidi = (octave + 1) * SEMITONES_PER_OCTAVE + rootPc;

  return chord.intervals.map(interval => baseMidi + interval);
}

/**
 * Build a chord progression from Roman-numeral-style degree numbers.
 * Returns an array of chord arrays (each chord is an array of MIDI notes).
 *
 * @param {string|number} key - Key root note name or pitch class
 * @param {string} scaleName - Scale to derive diatonic chords from
 * @param {number[]} numerals - 1-based scale degrees, e.g. [1, 5, 6, 4]
 * @param {number} octave - Base octave (default 4)
 * @returns {number[][]} Array of chord note arrays
 */
export function getChordProgression(key, scaleName, numerals, octave = 4) {
  const scale = SCALES[scaleName];
  if (!scale) return [];

  const rootPc = typeof key === 'number' ? key : noteNameToPitchClass(key);
  const qualities = DIATONIC_CHORD_QUALITIES[scaleName] || DIATONIC_CHORD_QUALITIES.major;

  return numerals.map(degree => {
    // Clamp degree to 1-7 range
    const deg = ((degree - 1) % scale.intervals.length + scale.intervals.length) % scale.intervals.length;
    const scaleInterval = scale.intervals[deg];
    const chordRootPc = (rootPc + scaleInterval) % SEMITONES_PER_OCTAVE;
    const quality = qualities[deg] || 'major';

    return getChordNotes(chordRootPc, quality, octave);
  });
}

/**
 * Quantize a MIDI note to the nearest tone in a scale.
 * @param {number} midiNote - Input MIDI note
 * @param {string|number} root - Root note name or pitch class
 * @param {string} scaleName - Key into SCALES
 * @returns {number} Quantized MIDI note
 */
export function quantizeToScale(midiNote, root, scaleName) {
  const scale = SCALES[scaleName];
  if (!scale) return midiNote;

  const rootPc = typeof root === 'number' ? root : noteNameToPitchClass(root);

  // Build a set of valid pitch classes for this scale
  const validPCs = new Set(scale.intervals.map(i => (rootPc + i) % SEMITONES_PER_OCTAVE));

  const pc = ((midiNote % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;

  if (validPCs.has(pc)) return midiNote;

  // Search outward for nearest scale tone
  for (let offset = 1; offset <= 6; offset++) {
    const up = (pc + offset) % SEMITONES_PER_OCTAVE;
    const down = ((pc - offset) % SEMITONES_PER_OCTAVE + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
    if (validPCs.has(down)) return midiNote - offset;
    if (validPCs.has(up)) return midiNote + offset;
  }

  return midiNote;
}

/**
 * Get the relative minor root given a major root.
 * e.g. 'C' => 'A', 'G' => 'E'
 * @param {string} majorRoot - Note name of the major key root
 * @returns {string} Note name of the relative minor root
 */
export function getRelativeMinor(majorRoot) {
  const pc = noteNameToPitchClass(majorRoot);
  // Relative minor is 3 semitones below (or 9 above)
  const minorPc = (pc + 9) % SEMITONES_PER_OCTAVE;
  return NOTE_NAMES[minorPc];
}

/**
 * Get the relative major root given a minor root.
 * e.g. 'A' => 'C', 'E' => 'G'
 * @param {string} minorRoot - Note name of the minor key root
 * @returns {string} Note name of the relative major root
 */
export function getRelativeMajor(minorRoot) {
  const pc = noteNameToPitchClass(minorRoot);
  // Relative major is 3 semitones above
  const majorPc = (pc + 3) % SEMITONES_PER_OCTAVE;
  return NOTE_NAMES[majorPc];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a note name (without octave) to a pitch class 0-11.
 * Handles sharps and flats.
 */
function noteNameToPitchClass(name) {
  if (typeof name === 'number') return ((name % 12) + 12) % 12;
  const match = name.match(/^([A-Ga-g])(#{0,2}|b{0,2})$/);
  if (!match) return 0;

  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const letterSemitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semitone = letterSemitones[letter] || 0;

  for (const ch of accidental) {
    if (ch === '#') semitone++;
    if (ch === 'b') semitone--;
  }

  return ((semitone % 12) + 12) % 12;
}
