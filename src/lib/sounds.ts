export type VoiceId = "kick" | "snare" | "hat" | "clap" | "bass" | "pluck" | "pad" | "perc";

export interface TrackDef {
  id: string;
  name: string;
  voice: VoiceId;
  hue: number;
  defaultPattern: boolean[];
  defaultLevel: number;
  pitch: number;
}

export const STEPS = 16;

export const VOICES: Record<VoiceId, { label: string; short: string }> = {
  kick:  { label: "Kick",       short: "KK" },
  snare: { label: "Snare",      short: "SN" },
  hat:   { label: "Hi-Hat",     short: "HH" },
  clap:  { label: "Clap",       short: "CP" },
  bass:  { label: "Bass",       short: "BS" },
  pluck: { label: "Pluck",      short: "PL" },
  pad:   { label: "Pad",        short: "PD" },
  perc:  { label: "Percussion", short: "PC" },
};

export const DEFAULT_TRACKS: TrackDef[] = [
  {
    id: "kick",
    name: "Pulse Engine",
    voice: "kick",
    hue: 270,
    defaultLevel: 0.9,
    pitch: 46,
    defaultPattern: [true,false,false,false, true,false,false,true, true,false,false,false, true,false,true,false],
  },
  {
    id: "snare",
    name: "Glass Impact",
    voice: "snare",
    hue: 318,
    defaultLevel: 0.78,
    pitch: 200,
    defaultPattern: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,true],
  },
  {
    id: "hat",
    name: "Photon Dust",
    voice: "hat",
    hue: 190,
    defaultLevel: 0.55,
    pitch: 6200,
    defaultPattern: [true,false,true,false, true,true,true,false, true,false,true,false, true,true,false,true],
  },
  {
    id: "clap",
    name: "Ion Snap",
    voice: "clap",
    hue: 340,
    defaultLevel: 0.65,
    pitch: 1200,
    defaultPattern: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false],
  },
  {
    id: "bass",
    name: "Sub Collider",
    voice: "bass",
    hue: 154,
    defaultLevel: 0.85,
    pitch: 55,
    defaultPattern: [true,false,false,true, false,false,true,false, false,true,false,false, true,false,false,false],
  },
  {
    id: "pluck",
    name: "Neon Keys",
    voice: "pluck",
    hue: 42,
    defaultLevel: 0.6,
    pitch: 330,
    defaultPattern: [false,true,false,false, false,true,false,true, false,false,true,false, false,true,false,false],
  },
  {
    id: "pad",
    name: "Aura Pad",
    voice: "pad",
    hue: 226,
    defaultLevel: 0.5,
    pitch: 110,
    defaultPattern: [true,false,false,false, false,false,false,false, true,false,false,false, false,false,false,false],
  },
  {
    id: "perc",
    name: "Debris Hit",
    voice: "perc",
    hue: 28,
    defaultLevel: 0.45,
    pitch: 800,
    defaultPattern: [false,false,true,false, false,false,false,true, false,false,true,false, false,true,false,false],
  },
];

export function emptyPattern(): boolean[] {
  return Array.from({ length: STEPS }, () => false);
}

export function defaultProbabilities(): number[] {
  return Array.from({ length: STEPS }, () => 100);
}
