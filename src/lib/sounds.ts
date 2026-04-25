// Default kit: maps track names to synth configs
// We use Tone.js synths so everything works out of the box — no sample loading needed.
// Each track defines a synth type and the note/config to trigger.

export interface TrackSound {
  name: string;
  color: string;
  synth: "membrane" | "metal" | "noise" | "synth" | "am" | "fm" | "monosynth" | "mic";
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
    // Warm 808-style: 4-octave pitch sweep over a 40 ms decay gives a defined
    // "thump" without sounding clicky. The amp envelope's longer release lets
    // the body bloom and tail off naturally rather than choking the low end.
    options: { pitchDecay: 0.04, octaves: 4, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 } },
  },
  {
    name: "Snare",
    color: "#f59e0b",
    synth: "noise",
    note: "16n",
    melodic: false,
    // White noise with a cracky body. Slightly longer decay/release than the
    // typical 16n burst gives the snare presence and "snap" without stepping
    // on the next downbeat.
    options: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.12 } },
  },
  {
    name: "Hi-Hat",
    color: "#22c55e",
    synth: "metal",
    note: "C6",
    melodic: false,
    // Tamed metallic burst: lower modulation index avoids the Tone.js default
    // "angry kettle" sound. Resonance peak around 7 kHz keeps it crisp but
    // not piercing; brief release prevents ringing into the next 16th.
    options: { frequency: 250, envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 4.1, modulationIndex: 16, resonance: 7000, octaves: 1 },
  },
  {
    name: "Open Hat",
    color: "#06b6d4",
    synth: "metal",
    note: "C6",
    melodic: false,
    // Same character as the closed hat with a longer decay/release so it
    // sustains across beats believably without going washy.
    options: { frequency: 250, envelope: { attack: 0.001, decay: 0.4, release: 0.2 }, harmonicity: 4.1, modulationIndex: 16, resonance: 7000, octaves: 1 },
  },
  {
    name: "Clap",
    color: "#8b5cf6",
    synth: "noise",
    note: "32n",
    melodic: false,
    // Pink noise gives a more "hand-shaped" body than white. Slightly slower
    // attack mimics multi-finger contact; medium decay creates the room reflection.
    options: { noise: { type: "pink" }, envelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.1 } },
  },
  {
    name: "Tom",
    color: "#ec4899",
    synth: "membrane",
    note: "A2",
    melodic: true,
    noteRange: ["C1", "C3"],
    // Rack-tom range: 3-octave sweep, longer decay than the kick so it sings.
    options: { pitchDecay: 0.06, octaves: 3, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 } },
  },
  {
    name: "Perc",
    color: "#14b8a6",
    synth: "fm",
    note: "C5",
    melodic: true,
    noteRange: ["C4", "C6"],
    // FM bell-pluck: lower modIndex than before keeps the timbre musical not
    // metallic; carrier/mod envelopes shape a quick "pling" with a short tail.
    options: {
      harmonicity: 3.5,
      modulationIndex: 5,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    },
  },
  {
    name: "Bass",
    color: "#6366f1",
    synth: "monosynth",
    note: "C2",
    melodic: true,
    noteRange: ["C1", "C4"],
    // MonoSynth gives us a real filter envelope — the secret to a fat, plucky
    // bass that opens up on the attack and closes back down. 24 dB/oct lowpass
    // at moderate Q + saw oscillator = classic synth-bass weight.
    options: {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.002, decay: 0.2, sustain: 0.6, release: 0.2 },
      filterEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.2, baseFrequency: 60, octaves: 3.5 },
      filter: { Q: 4, type: "lowpass", rolloff: -24 },
    },
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
