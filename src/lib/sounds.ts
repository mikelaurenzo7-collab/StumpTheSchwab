export type Voice = "kick" | "snare" | "hat" | "bass" | "pluck" | "pad";

export type Track = {
  id: string;
  name: string;
  voice: Voice;
  hue: number;
  pattern: boolean[];
  level: number;
  pitch: number;
  muted: boolean;
  soloed: boolean;
};

export type Macro = {
  bloom: number;
  gravity: number;
  shimmer: number;
  fracture: number;
};

export type GeneratedBeat = {
  bpm?: number;
  tracks: Array<{
    voice: string;
    pattern: boolean[];
    level?: number;
  }>;
  macros?: Partial<Macro>;
};

export const STEPS = 16;
export const scale = [0, 2, 3, 5, 7, 10, 12, 14];

export const defaultTracks: Track[] = [
  { id: "pulse", name: "Pulse Engine", voice: "kick", hue: 270, level: 0.92, pitch: 46, muted: false, soloed: false, pattern: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false] },
  { id: "glass", name: "Glass Impact", voice: "snare", hue: 318, level: 0.76, pitch: 188, muted: false, soloed: false, pattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true] },
  { id: "dust", name: "Photon Dust", voice: "hat", hue: 190, level: 0.58, pitch: 6200, muted: false, soloed: false, pattern: [true, false, true, false, true, true, true, false, true, false, true, false, true, true, false, true] },
  { id: "sub", name: "Sub Collider", voice: "bass", hue: 154, level: 0.84, pitch: 55, muted: false, soloed: false, pattern: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false] },
  { id: "keys", name: "Neon Keys", voice: "pluck", hue: 42, level: 0.64, pitch: 330, muted: false, soloed: false, pattern: [false, true, false, false, false, true, false, true, false, false, true, false, false, true, false, false] },
  { id: "aura", name: "Aura Pad", voice: "pad", hue: 226, level: 0.52, pitch: 110, muted: false, soloed: false, pattern: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false] },
];
