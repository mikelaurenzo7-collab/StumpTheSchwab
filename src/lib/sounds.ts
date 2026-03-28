// Default kit: maps track names to synth configs
// We use Tone.js synths so everything works out of the box — no sample loading needed.
// Each track defines a synth type and the note/config to trigger.

export interface TrackSound {
  name: string;
  color: string;
  synth: "membrane" | "metal" | "noise" | "synth" | "am" | "fm";
  note: string;
  options?: Record<string, unknown>;
}

export const DEFAULT_KIT: TrackSound[] = [
  {
    name: "Kick",
    color: "#ef4444",
    synth: "membrane",
    note: "C1",
    options: { pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } },
  },
  {
    name: "Snare",
    color: "#f59e0b",
    synth: "noise",
    note: "16n",
    options: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 } },
  },
  {
    name: "Hi-Hat",
    color: "#22c55e",
    synth: "metal",
    note: "C6",
    options: { frequency: 400, envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 },
  },
  {
    name: "Open Hat",
    color: "#06b6d4",
    synth: "metal",
    note: "C6",
    options: { frequency: 400, envelope: { attack: 0.001, decay: 0.3, release: 0.1 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 },
  },
  {
    name: "Clap",
    color: "#8b5cf6",
    synth: "noise",
    note: "32n",
    options: { noise: { type: "pink" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 } },
  },
  {
    name: "Tom",
    color: "#ec4899",
    synth: "membrane",
    note: "G1",
    options: { pitchDecay: 0.08, octaves: 4, envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 } },
  },
  {
    name: "Perc",
    color: "#14b8a6",
    synth: "fm",
    note: "C5",
    options: { harmonicity: 8, modulationIndex: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 } },
  },
  {
    name: "Bass",
    color: "#6366f1",
    synth: "synth",
    note: "C2",
    options: { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.1 } },
  },
];
