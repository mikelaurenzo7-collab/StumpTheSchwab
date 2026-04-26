import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { type Track, type Macro, type GeneratedBeat, STEPS, defaultTracks } from "../lib/sounds";

type Snapshot = {
  tracks: Track[];
  bpm: number;
  macros: Macro;
};

const SCENE_NAMES = [
  "Nebula Breaks", "Quantum Bounce", "Chrome Ritual", "Zero-G Garage",
  "Solar Drill", "Dream Collider", "Plasma Funk", "Void Techno",
  "Lunar Drift", "Neon Cascade",
];

const MAX_HISTORY = 64;

function snap(state: { tracks: Track[]; bpm: number; macros: Macro }): Snapshot {
  return {
    tracks: state.tracks.map((t) => ({ ...t, pattern: [...t.pattern] })),
    bpm: state.bpm,
    macros: { ...state.macros },
  };
}

function makePattern(voice: string, hue: number, density: number, gravity: number): boolean[] {
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

export interface EngineState {
  tracks: Track[];
  currentStep: number;
  playing: boolean;
  bpm: number;
  swing: number;
  density: number;
  scene: string;
  macros: Macro;
  generating: boolean;
  generatePrompt: string;

  past: Snapshot[];
  future: Snapshot[];

  toggleStep: (trackId: string, step: number) => void;
  setTrackLevel: (trackId: string, level: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  clearTrack: (trackId: string) => void;

  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setDensity: (density: number) => void;
  setMacro: (key: keyof Macro, value: number) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentStep: (step: number) => void;
  setGeneratePrompt: (prompt: string) => void;
  setGenerating: (v: boolean) => void;

  regenerate: () => void;
  mutate: () => void;

  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  applyGeneratedBeat: (beat: GeneratedBeat) => void;
}

export const useEngine = create<EngineState>()(
  subscribeWithSelector((set, get) => ({
    tracks: defaultTracks,
    currentStep: 0,
    playing: false,
    bpm: 126,
    swing: 0,
    density: 62,
    scene: "Nebula Breaks",
    macros: { bloom: 72, gravity: 44, shimmer: 63, fracture: 28 },
    generating: false,
    generatePrompt: "",

    past: [],
    future: [],

    toggleStep: (trackId, step) => {
      const s = get();
      set({
        tracks: s.tracks.map((t) =>
          t.id === trackId ? { ...t, pattern: t.pattern.map((v, i) => (i === step ? !v : v)) } : t,
        ),
        past: [...s.past.slice(-MAX_HISTORY), snap(s)],
        future: [],
      });
    },

    setTrackLevel: (trackId, level) =>
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, level } : t)) })),

    toggleMute: (trackId) =>
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)) })),

    toggleSolo: (trackId) =>
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, soloed: !t.soloed } : t)) })),

    clearTrack: (trackId) => {
      const s = get();
      set({
        tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, pattern: Array(STEPS).fill(false) } : t)),
        past: [...s.past.slice(-MAX_HISTORY), snap(s)],
        future: [],
      });
    },

    setBpm: (bpm) => set({ bpm }),
    setSwing: (swing) => set({ swing }),
    setDensity: (density) => set({ density }),
    setMacro: (key, value) => set((s) => ({ macros: { ...s.macros, [key]: value } })),
    setPlaying: (playing) => set({ playing }),
    setCurrentStep: (step) => set({ currentStep: step }),
    setGeneratePrompt: (prompt) => set({ generatePrompt: prompt }),
    setGenerating: (generating) => set({ generating }),

    regenerate: () => {
      const s = get();
      set({
        scene: SCENE_NAMES[Math.floor(Math.random() * SCENE_NAMES.length)],
        tracks: s.tracks.map((t) => ({
          ...t,
          pattern: makePattern(t.voice, t.hue, s.density, s.macros.gravity),
        })),
        past: [...s.past.slice(-MAX_HISTORY), snap(s)],
        future: [],
      });
    },

    mutate: () => {
      const s = get();
      set({
        tracks: s.tracks.map((t) => ({
          ...t,
          pattern: t.pattern.map((active, i) =>
            Math.random() < s.macros.fracture / 260 || i === s.currentStep ? !active : active,
          ),
        })),
        past: [...s.past.slice(-MAX_HISTORY), snap(s)],
        future: [],
      });
    },

    pushSnapshot: () => {
      const s = get();
      set({ past: [...s.past.slice(-MAX_HISTORY), snap(s)], future: [] });
    },

    undo: () => {
      const s = get();
      if (s.past.length === 0) return;
      const previous = s.past[s.past.length - 1];
      set({
        tracks: previous.tracks,
        bpm: previous.bpm,
        macros: previous.macros,
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future],
      });
    },

    redo: () => {
      const s = get();
      if (s.future.length === 0) return;
      const next = s.future[0];
      set({
        tracks: next.tracks,
        bpm: next.bpm,
        macros: next.macros,
        past: [...s.past, snap(s)],
        future: s.future.slice(1),
      });
    },

    applyGeneratedBeat: (beat) => {
      const s = get();
      const newTracks = s.tracks.map((track) => {
        const gen = beat.tracks.find((t) => t.voice === track.voice);
        if (!gen) return track;
        return {
          ...track,
          pattern: gen.pattern
            .slice(0, STEPS)
            .concat(Array(Math.max(0, STEPS - gen.pattern.length)).fill(false)),
          level: gen.level ?? track.level,
        };
      });
      set({
        tracks: newTracks,
        bpm: beat.bpm ?? s.bpm,
        macros: beat.macros ? { ...s.macros, ...beat.macros } : s.macros,
        past: [...s.past.slice(-MAX_HISTORY), snap(s)],
        future: [],
      });
    },
  })),
);

export const selectEnergy = (state: EngineState) => {
  const active = state.tracks.reduce((sum, t) => sum + t.pattern.filter(Boolean).length * t.level, 0);
  return Math.round((active / (state.tracks.length * STEPS)) * 100);
};
