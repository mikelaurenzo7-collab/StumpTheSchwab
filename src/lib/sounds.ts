export type VoiceType = "kick" | "snare" | "hat" | "clap" | "bass" | "pluck" | "pad" | "perc";

export interface TrackDef {
  id: string;
  name: string;
  voice: VoiceType;
  color: string;
  hue: number;
  defaultPitch: number;
  defaultLevel: number;
  defaultPattern: boolean[];
}

export const STEPS = 16;

export const TRACKS: TrackDef[] = [
  {
    id: "kick",
    name: "Pulse Engine",
    voice: "kick",
    color: "#8b5cf6",
    hue: 270,
    defaultPitch: 46,
    defaultLevel: 0.92,
    defaultPattern: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false],
  },
  {
    id: "snare",
    name: "Glass Impact",
    voice: "snare",
    color: "#ec4899",
    hue: 318,
    defaultPitch: 188,
    defaultLevel: 0.76,
    defaultPattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true],
  },
  {
    id: "hat",
    name: "Photon Dust",
    voice: "hat",
    color: "#22d3ee",
    hue: 190,
    defaultPitch: 6200,
    defaultLevel: 0.58,
    defaultPattern: [true, false, true, false, true, true, true, false, true, false, true, false, true, true, false, true],
  },
  {
    id: "clap",
    name: "Ion Clap",
    voice: "clap",
    color: "#f472b6",
    hue: 340,
    defaultPitch: 1200,
    defaultLevel: 0.68,
    defaultPattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
  },
  {
    id: "bass",
    name: "Sub Collider",
    voice: "bass",
    color: "#34d399",
    hue: 154,
    defaultPitch: 55,
    defaultLevel: 0.84,
    defaultPattern: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false],
  },
  {
    id: "pluck",
    name: "Neon Keys",
    voice: "pluck",
    color: "#fbbf24",
    hue: 42,
    defaultPitch: 330,
    defaultLevel: 0.64,
    defaultPattern: [false, true, false, false, false, true, false, true, false, false, true, false, false, true, false, false],
  },
  {
    id: "perc",
    name: "Fracture Hit",
    voice: "perc",
    color: "#fb923c",
    hue: 28,
    defaultPitch: 800,
    defaultLevel: 0.55,
    defaultPattern: [false, false, true, false, false, false, false, true, false, false, true, false, false, false, true, false],
  },
  {
    id: "pad",
    name: "Aura Pad",
    voice: "pad",
    color: "#6366f1",
    hue: 226,
    defaultPitch: 110,
    defaultLevel: 0.52,
    defaultPattern: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
  },
];

export const SCALE = [0, 2, 3, 5, 7, 10, 12, 14];

export const SCENE_NAMES = [
  "Nebula Breaks",
  "Quantum Bounce",
  "Chrome Ritual",
  "Zero-G Garage",
  "Solar Drill",
  "Dream Collider",
  "Void Funk",
  "Plasma Drift",
];
