import { create } from 'zustand';

export type Voice = 'kick' | 'snare' | 'hat' | 'bass' | 'pluck' | 'pad';

export interface Track {
  id: string;
  name: string;
  voice: Voice;
  hue: number;
  pattern: boolean[];
  level: number;
  pitch: number;
  muted: boolean;
}

export interface Macro {
  bloom: number;
  gravity: number;
  shimmer: number;
  fracture: number;
}

export interface Snapshot {
  tracks: Track[];
  bpm: number;
  swing: number;
  density: number;
  macros: Macro;
  scene: string;
}

export const STEPS = 16;
const MAX_HISTORY = 64;

export const INITIAL_TRACKS: Track[] = [
  { id: 'pulse', name: 'Pulse Engine', voice: 'kick', hue: 270, level: 0.92, pitch: 46, muted: false, pattern: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false] },
  { id: 'glass', name: 'Glass Impact', voice: 'snare', hue: 318, level: 0.76, pitch: 188, muted: false, pattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true] },
  { id: 'dust', name: 'Photon Dust', voice: 'hat', hue: 190, level: 0.58, pitch: 6200, muted: false, pattern: [true, false, true, false, true, true, true, false, true, false, true, false, true, true, false, true] },
  { id: 'sub', name: 'Sub Collider', voice: 'bass', hue: 154, level: 0.84, pitch: 55, muted: false, pattern: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false] },
  { id: 'keys', name: 'Neon Keys', voice: 'pluck', hue: 42, level: 0.64, pitch: 330, muted: false, pattern: [false, true, false, false, false, true, false, true, false, false, true, false, false, true, false, false] },
  { id: 'aura', name: 'Aura Pad', voice: 'pad', hue: 226, level: 0.52, pitch: 110, muted: false, pattern: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false] },
];

export const SCENE_NAMES = [
  'Nebula Breaks', 'Quantum Bounce', 'Chrome Ritual',
  'Zero-G Garage', 'Solar Drill', 'Dream Collider',
];

export function makePattern(track: Track, density: number, gravity: number): boolean[] {
  return Array.from({ length: STEPS }, (_, step) => {
    const downbeat = step % 4 === 0;
    const offbeat = step % 4 === 2;
    const phase = Math.sin((step + track.hue / 36) * (0.9 + gravity / 80));
    const threshold = density / 100 + (downbeat ? 0.22 : 0) + (offbeat ? 0.08 : 0);
    if (track.voice === 'kick') return downbeat || (phase > 0.75 && density > 64);
    if (track.voice === 'snare') return step === 4 || step === 12 || (phase > 0.86 && density > 74);
    if (track.voice === 'hat') return step % 2 === 0 || phase > 0.38;
    if (track.voice === 'pad') return step === 0 || step === 8 || (phase > 0.92 && density > 80);
    return phase + threshold > 1.08;
  });
}

function takeSnapshot(state: EngineState): Snapshot {
  return {
    tracks: state.tracks.map(t => ({ ...t, pattern: [...t.pattern] })),
    bpm: state.bpm,
    swing: state.swing,
    density: state.density,
    macros: { ...state.macros },
    scene: state.scene,
  };
}

function applySnapshot(snap: Snapshot): Partial<EngineState> {
  return {
    tracks: snap.tracks.map(t => ({ ...t, pattern: [...t.pattern] })),
    bpm: snap.bpm,
    swing: snap.swing,
    density: snap.density,
    macros: { ...snap.macros },
    scene: snap.scene,
  };
}

export interface EngineState {
  tracks: Track[];
  bpm: number;
  swing: number;
  playing: boolean;
  currentStep: number;
  density: number;
  scene: string;
  macros: Macro;
  past: Snapshot[];
  future: Snapshot[];

  pushUndo: () => void;
  toggleStep: (trackIndex: number, stepIndex: number) => void;
  setTrackLevel: (trackId: string, level: number) => void;
  setTrackMuted: (trackId: string, muted: boolean) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setCurrentStep: (step: number) => void;
  regenerate: () => void;
  mutate: () => void;
  setMacro: (key: keyof Macro, value: number) => void;
  setDensity: (density: number) => void;
  clearTrack: (trackId: string) => void;
  undo: () => void;
  redo: () => void;
  loadSession: (data: Snapshot) => void;
  getSnapshot: () => Snapshot;
}

export const useEngine = create<EngineState>((set, get) => ({
  tracks: INITIAL_TRACKS.map(t => ({ ...t, pattern: [...t.pattern] })),
  bpm: 126,
  swing: 0,
  playing: false,
  currentStep: 0,
  density: 62,
  scene: 'Nebula Breaks',
  macros: { bloom: 72, gravity: 44, shimmer: 63, fracture: 28 },
  past: [],
  future: [],

  pushUndo: () => set(state => ({
    past: [...state.past.slice(-(MAX_HISTORY - 1)), takeSnapshot(state)],
    future: [],
  })),

  toggleStep: (trackIndex, stepIndex) => {
    const state = get();
    set({
      past: [...state.past.slice(-(MAX_HISTORY - 1)), takeSnapshot(state)],
      future: [],
      tracks: state.tracks.map((t, i) =>
        i === trackIndex
          ? { ...t, pattern: t.pattern.map((v, si) => (si === stepIndex ? !v : v)) }
          : t
      ),
    });
  },

  setTrackLevel: (trackId, level) => set(state => ({
    tracks: state.tracks.map(t => (t.id === trackId ? { ...t, level } : t)),
  })),

  setTrackMuted: (trackId, muted) => {
    const state = get();
    set({
      past: [...state.past.slice(-(MAX_HISTORY - 1)), takeSnapshot(state)],
      future: [],
      tracks: state.tracks.map(t => (t.id === trackId ? { ...t, muted } : t)),
    });
  },

  setBpm: (bpm) => set({ bpm }),
  setSwing: (swing) => set({ swing }),
  setPlaying: (playing) => set({ playing }),
  togglePlay: () => set(state => ({ playing: !state.playing })),
  setCurrentStep: (currentStep) => set({ currentStep }),

  regenerate: () => {
    const state = get();
    set({
      past: [...state.past.slice(-(MAX_HISTORY - 1)), takeSnapshot(state)],
      future: [],
      scene: SCENE_NAMES[Math.floor(Math.random() * SCENE_NAMES.length)],
      tracks: state.tracks.map(t => ({
        ...t,
        pattern: makePattern(t, state.density, state.macros.gravity),
      })),
    });
  },

  mutate: () => {
    const state = get();
    set({
      past: [...state.past.slice(-(MAX_HISTORY - 1)), takeSnapshot(state)],
      future: [],
      tracks: state.tracks.map(t => ({
        ...t,
        pattern: t.pattern.map((active, i) =>
          Math.random() < state.macros.fracture / 260 || i === state.currentStep
            ? !active
            : active
        ),
      })),
    });
  },

  setMacro: (key, value) => set(state => ({
    macros: { ...state.macros, [key]: value },
  })),

  setDensity: (density) => set({ density }),

  clearTrack: (trackId) => {
    const state = get();
    set({
      past: [...state.past.slice(-(MAX_HISTORY - 1)), takeSnapshot(state)],
      future: [],
      tracks: state.tracks.map(t =>
        t.id === trackId ? { ...t, pattern: Array(STEPS).fill(false) } : t
      ),
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const current = takeSnapshot(state);
    const previous = state.past[state.past.length - 1];
    set({
      ...applySnapshot(previous),
      past: state.past.slice(0, -1),
      future: [current, ...state.future].slice(0, MAX_HISTORY),
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const current = takeSnapshot(state);
    const next = state.future[0];
    set({
      ...applySnapshot(next),
      past: [...state.past, current].slice(-MAX_HISTORY),
      future: state.future.slice(1),
    });
  },

  loadSession: (data) => set({
    ...applySnapshot(data),
    past: [],
    future: [],
  }),

  getSnapshot: () => takeSnapshot(get()),
}));
