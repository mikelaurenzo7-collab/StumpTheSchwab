import { create } from "zustand";
import { STEPS, TRACK_DEFS, SCENES, makePattern, type Voice } from "../lib/sounds";

export interface Track {
  id: string;
  name: string;
  voice: Voice;
  hue: number;
  pattern: boolean[];
  level: number;
  pitch: number;
  muted: boolean;
  soloed: boolean;
}

export interface Macro {
  bloom: number;
  gravity: number;
  shimmer: number;
  fracture: number;
}

interface Snapshot {
  tracks: Track[];
  macros: Macro;
  bpm: number;
}

function deepCopyTracks(tracks: Track[]): Track[] {
  return tracks.map((t) => ({ ...t, pattern: [...t.pattern] }));
}

function snap(state: { tracks: Track[]; macros: Macro; bpm: number }): Snapshot {
  return { tracks: deepCopyTracks(state.tracks), macros: { ...state.macros }, bpm: state.bpm };
}

const MAX_HISTORY = 50;

const initialTracks: Track[] = TRACK_DEFS.map((def) => ({
  id: def.id,
  name: def.name,
  voice: def.voice,
  hue: def.hue,
  level: def.defaultLevel,
  pitch: def.defaultPitch,
  pattern: [...def.defaultPattern],
  muted: false,
  soloed: false,
}));

export interface EngineState {
  playing: boolean;
  bpm: number;
  currentStep: number;
  swing: number;
  density: number;
  tracks: Track[];
  macros: Macro;
  scene: string;
  exporting: boolean;

  past: Snapshot[];
  future: Snapshot[];

  setPlaying: (playing: boolean) => void;
  setBpm: (bpm: number) => void;
  setCurrentStep: (step: number) => void;
  setSwing: (swing: number) => void;
  setDensity: (density: number) => void;
  setExporting: (exporting: boolean) => void;

  toggleStep: (trackIndex: number, step: number) => void;
  setTrackLevel: (trackId: string, level: number) => void;
  setTrackMute: (trackId: string) => void;
  setTrackSolo: (trackId: string) => void;

  setMacro: (key: keyof Macro, value: number) => void;

  randomizePattern: () => void;
  clearPattern: () => void;
  mutatePattern: () => void;

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

export const useEngineStore = create<EngineState>()((set, get) => ({
  playing: false,
  bpm: 126,
  currentStep: 0,
  swing: 0,
  density: 62,
  tracks: initialTracks,
  macros: { bloom: 72, gravity: 44, shimmer: 63, fracture: 28 },
  scene: "Nebula Breaks",
  exporting: false,
  past: [],
  future: [],

  setPlaying: (playing) => set({ playing }),
  setBpm: (bpm) => set({ bpm }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  setSwing: (swing) => set({ swing }),
  setDensity: (density) => set({ density }),
  setExporting: (exporting) => set({ exporting }),

  toggleStep: (trackIndex, step) => {
    const s = get();
    set({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snap(s)],
      future: [],
      tracks: s.tracks.map((t, i) =>
        i === trackIndex ? { ...t, pattern: t.pattern.map((v, j) => (j === step ? !v : v)) } : t,
      ),
    });
  },

  setTrackLevel: (trackId, level) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, level } : t)),
    })),

  setTrackMute: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
    })),

  setTrackSolo: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, soloed: !t.soloed } : t)),
    })),

  setMacro: (key, value) =>
    set((s) => ({
      macros: { ...s.macros, [key]: value },
    })),

  randomizePattern: () => {
    const s = get();
    set({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snap(s)],
      future: [],
      scene: SCENES[Math.floor(Math.random() * SCENES.length)],
      tracks: s.tracks.map((track) => ({
        ...track,
        pattern: makePattern(track.voice, track.hue, s.density, s.macros.gravity),
      })),
    });
  },

  clearPattern: () => {
    const s = get();
    set({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snap(s)],
      future: [],
      tracks: s.tracks.map((track) => ({
        ...track,
        pattern: new Array(STEPS).fill(false),
      })),
    });
  },

  mutatePattern: () => {
    const s = get();
    set({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snap(s)],
      future: [],
      tracks: s.tracks.map((track) => ({
        ...track,
        pattern: track.pattern.map((active, i) =>
          Math.random() < s.macros.fracture / 260 || i === s.currentStep ? !active : active,
        ),
      })),
    });
  },

  pushHistory: () => {
    const s = get();
    set({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snap(s)],
      future: [],
    });
  },

  undo: () => {
    const s = get();
    if (s.past.length === 0) return;
    const prev = s.past[s.past.length - 1];
    set({
      past: s.past.slice(0, -1),
      future: [snap(s), ...s.future.slice(0, MAX_HISTORY - 1)],
      tracks: deepCopyTracks(prev.tracks),
      macros: { ...prev.macros },
      bpm: prev.bpm,
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    set({
      past: [...s.past, snap(s)],
      future: s.future.slice(1),
      tracks: deepCopyTracks(next.tracks),
      macros: { ...next.macros },
      bpm: next.bpm,
    });
  },
}));
