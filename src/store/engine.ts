import { create } from "zustand";

export const STEPS = 16;

export type Voice = "kick" | "snare" | "hat" | "bass" | "pluck" | "pad";

export interface Track {
  id: string;
  name: string;
  voice: Voice;
  hue: number;
  pitch: number;
  pattern: boolean[];
  level: number;
  muted: boolean;
  solo: boolean;
}

export interface Macros {
  bloom: number;
  gravity: number;
  shimmer: number;
  fracture: number;
}

export interface GeneratedBeat {
  bpm?: number;
  tracks: { voice: Voice; pattern: boolean[]; level?: number }[];
}

const INITIAL_TRACKS: Track[] = [
  { id: "pulse", name: "Pulse Engine", voice: "kick", hue: 270, pitch: 46, level: 0.92, muted: false, solo: false, pattern: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false] },
  { id: "glass", name: "Glass Impact", voice: "snare", hue: 318, pitch: 188, level: 0.76, muted: false, solo: false, pattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true] },
  { id: "dust", name: "Photon Dust", voice: "hat", hue: 190, pitch: 6200, level: 0.58, muted: false, solo: false, pattern: [true, false, true, false, true, true, true, false, true, false, true, false, true, true, false, true] },
  { id: "sub", name: "Sub Collider", voice: "bass", hue: 154, pitch: 55, level: 0.84, muted: false, solo: false, pattern: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false] },
  { id: "keys", name: "Neon Keys", voice: "pluck", hue: 42, pitch: 330, level: 0.64, muted: false, solo: false, pattern: [false, true, false, false, false, true, false, true, false, false, true, false, false, true, false, false] },
  { id: "aura", name: "Aura Pad", voice: "pad", hue: 226, pitch: 110, level: 0.52, muted: false, solo: false, pattern: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false] },
];

const SCENES = [
  "Nebula Breaks", "Quantum Bounce", "Chrome Ritual",
  "Zero-G Garage", "Solar Drill", "Dream Collider",
];

const scale = [0, 2, 3, 5, 7, 10, 12, 14];

function makePattern(voice: Voice, hue: number, density: number, gravity: number): boolean[] {
  return Array.from({ length: STEPS }, (_, step) => {
    const downbeat = step % 4 === 0;
    const offbeat = step % 4 === 2;
    const phase = Math.sin((step + hue / 36) * (0.9 + gravity / 80));
    const threshold = density / 100 + (downbeat ? 0.22 : 0) + (offbeat ? 0.08 : 0);
    if (voice === "kick") return downbeat || (phase > 0.75 && density > 64);
    if (voice === "snare") return step === 4 || step === 12 || (phase > 0.86 && density > 74);
    if (voice === "hat") return step % 2 === 0 || phase > 0.38;
    if (voice === "pad") return step === 0 || step === 8 || (phase > 0.92 && density > 80);
    return phase + threshold > 1.08;
  });
}

interface EngineState {
  tracks: Track[];
  bpm: number;
  playing: boolean;
  currentStep: number;
  density: number;
  scene: string;
  macros: Macros;
  generating: boolean;
  generateError: string | null;

  toggleStep: (trackIndex: number, stepIndex: number) => void;
  setPlaying: (playing: boolean) => void;
  setBpm: (bpm: number) => void;
  setDensity: (density: number) => void;
  setCurrentStep: (step: number) => void;
  setScene: (scene: string) => void;
  setMacro: (key: keyof Macros, value: number) => void;
  setTrackLevel: (trackId: string, level: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  regenerate: () => void;
  mutate: () => void;
  clearTrack: (trackId: string) => void;
  clearAll: () => void;
  applyGeneratedBeat: (beat: GeneratedBeat) => void;
  setGenerating: (generating: boolean) => void;
  setGenerateError: (error: string | null) => void;
}

export const useEngineStore = create<EngineState>((set, get) => ({
  tracks: INITIAL_TRACKS,
  bpm: 126,
  playing: false,
  currentStep: 0,
  density: 62,
  scene: "Nebula Breaks",
  macros: { bloom: 72, gravity: 44, shimmer: 63, fracture: 28 },
  generating: false,
  generateError: null,

  toggleStep: (trackIndex, stepIndex) =>
    set((s) => ({
      tracks: s.tracks.map((t, i) =>
        i === trackIndex
          ? { ...t, pattern: t.pattern.map((v, j) => (j === stepIndex ? !v : v)) }
          : t
      ),
    })),

  setPlaying: (playing) => set({ playing }),
  setBpm: (bpm) => set({ bpm }),
  setDensity: (density) => set({ density }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setScene: (scene) => set({ scene }),

  setMacro: (key, value) =>
    set((s) => ({ macros: { ...s.macros, [key]: value } })),

  setTrackLevel: (trackId, level) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, level } : t)),
    })),

  toggleMute: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
    })),

  toggleSolo: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, solo: !t.solo } : t)),
    })),

  regenerate: () => {
    const { density, macros } = get();
    set((s) => ({
      scene: SCENES[Math.floor(Math.random() * SCENES.length)],
      tracks: s.tracks.map((t) => ({
        ...t,
        pattern: makePattern(t.voice, t.hue, density, macros.gravity),
      })),
    }));
  },

  mutate: () => {
    const { macros, currentStep } = get();
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        pattern: t.pattern.map((v, i) =>
          Math.random() < macros.fracture / 260 || i === currentStep ? !v : v
        ),
      })),
    }));
  },

  clearTrack: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, pattern: Array(STEPS).fill(false) as boolean[] } : t
      ),
    })),

  clearAll: () =>
    set((s) => ({
      tracks: s.tracks.map((t) => ({
        ...t,
        pattern: Array(STEPS).fill(false) as boolean[],
      })),
    })),

  applyGeneratedBeat: (beat) =>
    set((s) => {
      const newTracks = [...s.tracks];
      for (const gen of beat.tracks) {
        const idx = newTracks.findIndex((t) => t.voice === gen.voice);
        if (idx !== -1) {
          newTracks[idx] = {
            ...newTracks[idx],
            pattern: gen.pattern.slice(0, STEPS),
            ...(gen.level != null ? { level: gen.level } : {}),
          };
        }
      }
      return {
        tracks: newTracks,
        ...(beat.bpm ? { bpm: beat.bpm } : {}),
      };
    }),

  setGenerating: (generating) => set({ generating }),
  setGenerateError: (error) => set({ generateError: error }),
}));

export { scale };
