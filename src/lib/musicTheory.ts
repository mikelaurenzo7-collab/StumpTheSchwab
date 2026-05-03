const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type NoteName = typeof NOTE_NAMES[number];
export const ALL_NOTES: readonly NoteName[] = NOTE_NAMES;

export type ScaleType =
  | "major"
  | "minor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian"
  | "harmonic-minor"
  | "melodic-minor"
  | "pentatonic-major"
  | "pentatonic-minor"
  | "blues";

export const SCALE_TYPES: readonly { id: ScaleType; label: string }[] = [
  { id: "major", label: "Major" },
  { id: "minor", label: "Minor" },
  { id: "dorian", label: "Dorian" },
  { id: "phrygian", label: "Phrygian" },
  { id: "lydian", label: "Lydian" },
  { id: "mixolydian", label: "Mixolydian" },
  { id: "locrian", label: "Locrian" },
  { id: "harmonic-minor", label: "Harm. Min" },
  { id: "melodic-minor", label: "Mel. Min" },
  { id: "pentatonic-major", label: "Pent. Maj" },
  { id: "pentatonic-minor", label: "Pent. Min" },
  { id: "blues", label: "Blues" },
];

const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  "major":            [0, 2, 4, 5, 7, 9, 11],
  "minor":            [0, 2, 3, 5, 7, 8, 10],
  "dorian":           [0, 2, 3, 5, 7, 9, 10],
  "phrygian":         [0, 1, 3, 5, 7, 8, 10],
  "lydian":           [0, 2, 4, 6, 7, 9, 11],
  "mixolydian":       [0, 2, 4, 5, 7, 9, 10],
  "locrian":          [0, 1, 3, 5, 6, 8, 10],
  "harmonic-minor":   [0, 2, 3, 5, 7, 8, 11],
  "melodic-minor":    [0, 2, 3, 5, 7, 9, 11],
  "pentatonic-major": [0, 2, 4, 7, 9],
  "pentatonic-minor": [0, 3, 5, 7, 10],
  "blues":            [0, 3, 5, 6, 7, 10],
};

export type ChordType = "triad" | "7th" | "sus2" | "sus4" | "power";

export const CHORD_TYPES: readonly { id: ChordType; label: string }[] = [
  { id: "triad", label: "Triad" },
  { id: "7th", label: "7th" },
  { id: "sus2", label: "Sus2" },
  { id: "sus4", label: "Sus4" },
  { id: "power", label: "Power" },
];

function noteToMidi(note: string): number {
  const name = note.slice(0, -1);
  const octave = parseInt(note.slice(-1));
  const idx = NOTE_NAMES.indexOf(name as NoteName);
  if (idx === -1) return -1;
  return octave * 12 + idx;
}

function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12);
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

export function getScaleNotes(root: NoteName, scale: ScaleType): NoteName[] {
  const rootIdx = NOTE_NAMES.indexOf(root);
  return SCALE_INTERVALS[scale].map((interval) => NOTE_NAMES[(rootIdx + interval) % 12]);
}

export function isNoteInScale(note: string, root: NoteName, scale: ScaleType): boolean {
  const noteName = note.slice(0, -1) as NoteName;
  const scaleNotes = getScaleNotes(root, scale);
  return scaleNotes.includes(noteName);
}

export function getScaleDegree(note: string, root: NoteName, scale: ScaleType): number {
  const noteName = note.slice(0, -1) as NoteName;
  const scaleNotes = getScaleNotes(root, scale);
  return scaleNotes.indexOf(noteName);
}

export function snapToScale(note: string, root: NoteName, scale: ScaleType): string {
  if (isNoteInScale(note, root, scale)) return note;
  const midi = noteToMidi(note);
  if (midi === -1) return note;

  for (let offset = 1; offset <= 6; offset++) {
    const down = midiToNote(midi - offset);
    if (isNoteInScale(down, root, scale)) return down;
    const up = midiToNote(midi + offset);
    if (isNoteInScale(up, root, scale)) return up;
  }
  return note;
}

export function buildChord(
  rootNote: string,
  chordType: ChordType,
  scaleRoot: NoteName,
  scale: ScaleType,
  noteRange: string[],
): string[] {
  const midi = noteToMidi(rootNote);
  if (midi === -1) return [rootNote];

  const scaleNotes = getScaleNotes(scaleRoot, scale);
  const rootName = rootNote.slice(0, -1) as NoteName;
  const degree = scaleNotes.indexOf(rootName);

  let intervals: number[];
  if (degree === -1) {
    intervals = chordType === "7th" ? [0, 4, 7, 11]
      : chordType === "sus2" ? [0, 2, 7]
      : chordType === "sus4" ? [0, 5, 7]
      : chordType === "power" ? [0, 7]
      : [0, 4, 7];
  } else {
    intervals = buildDiatonicIntervals(degree, chordType, scaleRoot, scale);
  }

  const notes: string[] = [];
  const rangeSet = new Set(noteRange);
  for (const interval of intervals) {
    const candidate = midiToNote(midi + interval);
    if (rangeSet.has(candidate)) {
      notes.push(candidate);
    }
  }
  return notes.length > 0 ? notes : [rootNote];
}

function buildDiatonicIntervals(
  degree: number,
  chordType: ChordType,
  root: NoteName,
  scale: ScaleType,
): number[] {
  const intervals = SCALE_INTERVALS[scale];
  const rootInterval = intervals[degree];

  if (chordType === "power") {
    const fifth = intervals[(degree + 4) % intervals.length];
    const fifthSemitones = ((fifth - rootInterval) % 12 + 12) % 12;
    return [0, fifthSemitones];
  }

  if (chordType === "sus2") {
    const second = intervals[(degree + 1) % intervals.length];
    const fifth = intervals[(degree + 4) % intervals.length];
    return [0, ((second - rootInterval) % 12 + 12) % 12, ((fifth - rootInterval) % 12 + 12) % 12];
  }

  if (chordType === "sus4") {
    const fourth = intervals[(degree + 3) % intervals.length];
    const fifth = intervals[(degree + 4) % intervals.length];
    return [0, ((fourth - rootInterval) % 12 + 12) % 12, ((fifth - rootInterval) % 12 + 12) % 12];
  }

  const third = intervals[(degree + 2) % intervals.length];
  const fifth = intervals[(degree + 4) % intervals.length];
  const thirdSemitones = ((third - rootInterval) % 12 + 12) % 12;
  const fifthSemitones = ((fifth - rootInterval) % 12 + 12) % 12;

  if (chordType === "7th") {
    const seventh = intervals[(degree + 6) % intervals.length];
    const seventhSemitones = ((seventh - rootInterval) % 12 + 12) % 12;
    return [0, thirdSemitones, fifthSemitones, seventhSemitones];
  }

  return [0, thirdSemitones, fifthSemitones];
}

export function snapPatternToScale(
  notes: string[],
  steps: number[],
  root: NoteName,
  scale: ScaleType,
): string[] {
  return notes.map((noteStr, i) => {
    if (steps[i] === 0 || !noteStr) return noteStr;
    const parts = noteStr.split(",");
    const snapped = parts.map((n) => snapToScale(n, root, scale));
    return snapped.join(",");
  });
}
