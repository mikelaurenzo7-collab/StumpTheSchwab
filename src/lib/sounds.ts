// Default kit: maps track names to synth configs
// We use Tone.js synths so everything works out of the box — no sample loading needed.
// Each track defines a synth type and the note/config to trigger.

export interface TrackSound {
  name: string;
  color: string;
  synth: "membrane" | "metal" | "noise" | "synth" | "am" | "fm" | "mic";
  note: string;
  melodic: boolean; // true = supports per-step pitch via piano roll
  noteRange?: [string, string]; // [low, high] for piano roll range
  options?: Record<string, unknown>;
}

// Note helpers for piano roll
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export function generateNoteRange(lowNote: string, highNote: string): string[] {
  const notes: string[] = [];
  const lowOctave = parseInt(lowNote.slice(-1));
  const highOctave = parseInt(highNote.slice(-1));
  const lowName = lowNote.slice(0, -1);
  const highName = highNote.slice(0, -1);
  const lowIdx = NOTE_NAMES.indexOf(lowName as typeof NOTE_NAMES[number]);
  const highIdx = NOTE_NAMES.indexOf(highName as typeof NOTE_NAMES[number]);

  for (let oct = lowOctave; oct <= highOctave; oct++) {
    for (let i = 0; i < 12; i++) {
      if (oct === lowOctave && i < lowIdx) continue;
      if (oct === highOctave && i > highIdx) continue;
      notes.push(`${NOTE_NAMES[i]}${oct}`);
    }
  }
  return notes;
}

export function isBlackKey(note: string): boolean {
  return note.includes("#");
}

export const DEFAULT_KIT: TrackSound[] = [
  {
    name: "Kick",
    color: "#ef4444",
    synth: "membrane",
    note: "C1",
    melodic: false,
    options: { pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } },
  },
  {
    name: "Snare",
    color: "#f59e0b",
    synth: "noise",
    note: "16n",
    melodic: false,
    options: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 } },
  },
  {
    name: "Hi-Hat",
    color: "#22c55e",
    synth: "metal",
    note: "C6",
    melodic: false,
    options: { frequency: 400, envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 },
  },
  {
    name: "Open Hat",
    color: "#06b6d4",
    synth: "metal",
    note: "C6",
    melodic: false,
    options: { frequency: 400, envelope: { attack: 0.001, decay: 0.3, release: 0.1 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 },
  },
  {
    name: "Clap",
    color: "#8b5cf6",
    synth: "noise",
    note: "32n",
    melodic: false,
    options: { noise: { type: "pink" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 } },
  },
  {
    name: "Tom",
    color: "#ec4899",
    synth: "membrane",
    note: "G1",
    melodic: true,
    noteRange: ["C1", "C3"],
    options: { pitchDecay: 0.08, octaves: 4, envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 } },
  },
  {
    name: "Perc",
    color: "#14b8a6",
    synth: "fm",
    note: "C5",
    melodic: true,
    noteRange: ["C4", "C6"],
    options: { harmonicity: 8, modulationIndex: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 } },
  },
  {
    name: "Bass",
    color: "#6366f1",
    synth: "synth",
    note: "C2",
    melodic: true,
    noteRange: ["C1", "C4"],
    options: { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.1 } },
  },
  {
    name: "Mic / Live",
    color: "#eab308",
    synth: "mic",
    note: "16n",
    melodic: false,
    options: {},
  },
];
