export type Voice = "kick" | "snare" | "hat" | "bass" | "pluck" | "pad";

export interface TrackDef {
  id: string;
  name: string;
  voice: Voice;
  hue: number;
  defaultLevel: number;
  defaultPitch: number;
  defaultPattern: boolean[];
}

export const STEPS = 16;

export const SCALE = [0, 2, 3, 5, 7, 10, 12, 14];

export const TRACK_DEFS: TrackDef[] = [
  { id: "pulse", name: "Pulse Engine", voice: "kick", hue: 270, defaultLevel: 0.92, defaultPitch: 46, defaultPattern: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false] },
  { id: "glass", name: "Glass Impact", voice: "snare", hue: 318, defaultLevel: 0.76, defaultPitch: 188, defaultPattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true] },
  { id: "dust", name: "Photon Dust", voice: "hat", hue: 190, defaultLevel: 0.58, defaultPitch: 6200, defaultPattern: [true, false, true, false, true, true, true, false, true, false, true, false, true, true, false, true] },
  { id: "sub", name: "Sub Collider", voice: "bass", hue: 154, defaultLevel: 0.84, defaultPitch: 55, defaultPattern: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false] },
  { id: "keys", name: "Neon Keys", voice: "pluck", hue: 42, defaultLevel: 0.64, defaultPitch: 330, defaultPattern: [false, true, false, false, false, true, false, true, false, false, true, false, false, true, false, false] },
  { id: "aura", name: "Aura Pad", voice: "pad", hue: 226, defaultLevel: 0.52, defaultPitch: 110, defaultPattern: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false] },
];

export const SCENES = [
  "Nebula Breaks",
  "Quantum Bounce",
  "Chrome Ritual",
  "Zero-G Garage",
  "Solar Drill",
  "Dream Collider",
];

export function makePattern(voice: Voice, hue: number, density: number, gravity: number): boolean[] {
  return Array.from({ length: STEPS }, (_, step) => {
    const downbeat = step % 4 === 0;
    const offbeat = step % 4 === 2;
    const phase = Math.sin((step + hue / 36) * (0.9 + gravity / 80));

    if (voice === "kick") return downbeat || (phase > 0.75 && density > 64);
    if (voice === "snare") return step === 4 || step === 12 || (phase > 0.86 && density > 74);
    if (voice === "hat") return step % 2 === 0 || phase > 0.38;
    if (voice === "pad") return step === 0 || step === 8 || (phase > 0.92 && density > 80);
    const threshold = density / 100 + (downbeat ? 0.22 : 0) + (offbeat ? 0.08 : 0);
    return phase + threshold > 1.08;
  });
}
