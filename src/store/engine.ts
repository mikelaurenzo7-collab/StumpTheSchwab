import { create } from "zustand";
import {
  DEFAULT_TRACKS,
  STEPS,
  emptyPattern,
  defaultProbabilities,
  type VoiceId,
} from "@/lib/sounds";

export interface TrackState {
  id: string;
  name: string;
  voice: VoiceId;
  hue: number;
  pattern: boolean[];
  probability: number[];
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

export interface PatternSlot {
  tracks: TrackState[];
  name: string;
}

interface Snapshot {
  patterns: PatternSlot[];
  currentPattern: number;
  bpm: number;
  swing: number;
  macros: Macro;
}

const MAX_HISTORY = 60;
const THROTTLE_MS = 500;

function buildDefaultTracks(): TrackState[] {
  return DEFAULT_TRACKS.map((def) => ({
    id: def.id,
    name: def.name,
    voice: def.voice,
    hue: def.hue,
    pattern: [...def.defaultPattern],
    probability: defaultProbabilities(),
    level: def.defaultLevel,
    pitch: def.pitch,
    muted: false,
    soloed: false,
  }));
}

function buildDefaultPattern(): PatternSlot {
  return { tracks: buildDefaultTracks(), name: "A" };
}

function takeSnapshot(state: EngineState): Snapshot {
  return {
    patterns: state.patterns.map((p) => ({
      name: p.name,
      tracks: p.tracks.map((t) => ({ ...t, pattern: [...t.pattern], probability: [...t.probability] })),
    })),
    currentPattern: state.currentPattern,
    bpm: state.bpm,
    swing: state.swing,
    macros: { ...state.macros },
  };
}

function applySnapshot(snap: Snapshot): Partial<EngineState> {
  return {
    patterns: snap.patterns.map((p) => ({
      name: p.name,
      tracks: p.tracks.map((t) => ({ ...t, pattern: [...t.pattern], probability: [...t.probability] })),
    })),
    currentPattern: snap.currentPattern,
    bpm: snap.bpm,
    swing: snap.swing,
    macros: { ...snap.macros },
  };
}

export interface EngineState {
  // Transport
  playing: boolean;
  bpm: number;
  swing: number;
  currentStep: number;

  // Patterns
  patterns: PatternSlot[];
  currentPattern: number;

  // Macros
  macros: Macro;

  // Song mode
  songMode: boolean;
  chain: number[];

  // AI
  generating: boolean;
  generatePrompt: string;

  // History
  _history: Snapshot[];
  _future: Snapshot[];
  _lastPush: number;

  // Transport actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setCurrentStep: (step: number) => void;

  // Pattern actions
  toggleStep: (trackIndex: number, stepIndex: number) => void;
  setStepProbability: (trackIndex: number, stepIndex: number, value: number) => void;
  clearTrack: (trackIndex: number) => void;
  selectPattern: (index: number) => void;
  duplicatePattern: () => void;

  // Mixer actions
  setTrackLevel: (trackIndex: number, level: number) => void;
  toggleMute: (trackIndex: number) => void;
  toggleSolo: (trackIndex: number) => void;
  setTrackPitch: (trackIndex: number, pitch: number) => void;

  // Macro actions
  setMacro: (key: keyof Macro, value: number) => void;

  // AI actions
  setGeneratePrompt: (prompt: string) => void;
  setGenerating: (generating: boolean) => void;
  applyGeneratedBeat: (beat: GeneratedBeat) => void;

  // History
  pushHistory: (throttle?: boolean) => void;
  undo: () => void;
  redo: () => void;

  // Tracks helper
  tracks: () => TrackState[];
}

export interface GeneratedBeat {
  name: string;
  bpm: number;
  tracks: Array<{
    voice: VoiceId;
    pattern: boolean[];
    level: number;
    probability?: number[];
  }>;
}

export const useEngine = create<EngineState>((set, get) => ({
  playing: false,
  bpm: 126,
  swing: 0,
  currentStep: -1,

  patterns: [buildDefaultPattern()],
  currentPattern: 0,

  macros: { bloom: 72, gravity: 44, shimmer: 63, fracture: 28 },

  songMode: false,
  chain: [],

  generating: false,
  generatePrompt: "",

  _history: [],
  _future: [],
  _lastPush: 0,

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  stop: () => set({ playing: false, currentStep: -1 }),

  setBpm: (bpm) => {
    get().pushHistory(true);
    set({ bpm: Math.max(30, Math.min(300, bpm)) });
  },

  setSwing: (swing) => {
    get().pushHistory(true);
    set({ swing: Math.max(0, Math.min(100, swing)) });
  },

  setCurrentStep: (step) => set({ currentStep: step }),

  toggleStep: (trackIndex, stepIndex) => {
    get().pushHistory();
    set((state) => {
      const slot = state.patterns[state.currentPattern];
      const newTracks = slot.tracks.map((t, ti) => {
        if (ti !== trackIndex) return t;
        const newPattern = [...t.pattern];
        newPattern[stepIndex] = !newPattern[stepIndex];
        return { ...t, pattern: newPattern };
      });
      const newPatterns = [...state.patterns];
      newPatterns[state.currentPattern] = { ...slot, tracks: newTracks };
      return { patterns: newPatterns };
    });
  },

  setStepProbability: (trackIndex, stepIndex, value) => {
    get().pushHistory(true);
    set((state) => {
      const slot = state.patterns[state.currentPattern];
      const newTracks = slot.tracks.map((t, ti) => {
        if (ti !== trackIndex) return t;
        const newProb = [...t.probability];
        newProb[stepIndex] = Math.max(0, Math.min(100, value));
        return { ...t, probability: newProb };
      });
      const newPatterns = [...state.patterns];
      newPatterns[state.currentPattern] = { ...slot, tracks: newTracks };
      return { patterns: newPatterns };
    });
  },

  clearTrack: (trackIndex) => {
    get().pushHistory();
    set((state) => {
      const slot = state.patterns[state.currentPattern];
      const newTracks = slot.tracks.map((t, ti) =>
        ti !== trackIndex ? t : { ...t, pattern: emptyPattern(), probability: defaultProbabilities() }
      );
      const newPatterns = [...state.patterns];
      newPatterns[state.currentPattern] = { ...slot, tracks: newTracks };
      return { patterns: newPatterns };
    });
  },

  selectPattern: (index) => {
    if (index >= 0 && index < get().patterns.length) {
      set({ currentPattern: index });
    }
  },

  duplicatePattern: () => {
    get().pushHistory();
    set((state) => {
      const src = state.patterns[state.currentPattern];
      const copy: PatternSlot = {
        name: String.fromCharCode(65 + state.patterns.length),
        tracks: src.tracks.map((t) => ({ ...t, pattern: [...t.pattern], probability: [...t.probability] })),
      };
      const newPatterns = [...state.patterns, copy];
      return { patterns: newPatterns, currentPattern: newPatterns.length - 1 };
    });
  },

  setTrackLevel: (trackIndex, level) => {
    get().pushHistory(true);
    set((state) => {
      const slot = state.patterns[state.currentPattern];
      const newTracks = slot.tracks.map((t, ti) =>
        ti !== trackIndex ? t : { ...t, level: Math.max(0, Math.min(1, level)) }
      );
      const newPatterns = [...state.patterns];
      newPatterns[state.currentPattern] = { ...slot, tracks: newTracks };
      return { patterns: newPatterns };
    });
  },

  toggleMute: (trackIndex) => {
    set((state) => {
      const slot = state.patterns[state.currentPattern];
      const newTracks = slot.tracks.map((t, ti) =>
        ti !== trackIndex ? t : { ...t, muted: !t.muted }
      );
      const newPatterns = [...state.patterns];
      newPatterns[state.currentPattern] = { ...slot, tracks: newTracks };
      return { patterns: newPatterns };
    });
  },

  toggleSolo: (trackIndex) => {
    set((state) => {
      const slot = state.patterns[state.currentPattern];
      const newTracks = slot.tracks.map((t, ti) =>
        ti !== trackIndex ? t : { ...t, soloed: !t.soloed }
      );
      const newPatterns = [...state.patterns];
      newPatterns[state.currentPattern] = { ...slot, tracks: newTracks };
      return { patterns: newPatterns };
    });
  },

  setTrackPitch: (trackIndex, pitch) => {
    get().pushHistory(true);
    set((state) => {
      const slot = state.patterns[state.currentPattern];
      const newTracks = slot.tracks.map((t, ti) =>
        ti !== trackIndex ? t : { ...t, pitch }
      );
      const newPatterns = [...state.patterns];
      newPatterns[state.currentPattern] = { ...slot, tracks: newTracks };
      return { patterns: newPatterns };
    });
  },

  setMacro: (key, value) => {
    get().pushHistory(true);
    set((state) => ({
      macros: { ...state.macros, [key]: Math.max(0, Math.min(100, value)) },
    }));
  },

  setGeneratePrompt: (prompt) => set({ generatePrompt: prompt }),
  setGenerating: (generating) => set({ generating }),

  applyGeneratedBeat: (beat) => {
    get().pushHistory();
    set((state) => {
      const slot = state.patterns[state.currentPattern];
      const newTracks = slot.tracks.map((track) => {
        const gen = beat.tracks.find((g) => g.voice === track.voice);
        if (!gen) return track;
        return {
          ...track,
          pattern: gen.pattern.slice(0, STEPS).concat(emptyPattern().slice(gen.pattern.length)),
          level: gen.level,
          probability: gen.probability
            ? gen.probability.slice(0, STEPS).concat(defaultProbabilities().slice(gen.probability.length))
            : track.probability,
        };
      });
      const newPatterns = [...state.patterns];
      newPatterns[state.currentPattern] = { ...slot, tracks: newTracks, name: beat.name || slot.name };
      return {
        patterns: newPatterns,
        bpm: beat.bpm > 0 ? Math.max(30, Math.min(300, beat.bpm)) : state.bpm,
      };
    });
  },

  pushHistory: (throttle) => {
    const now = Date.now();
    const state = get();
    if (throttle && now - state._lastPush < THROTTLE_MS) return;
    const snap = takeSnapshot(state);
    set({
      _history: [...state._history.slice(-MAX_HISTORY), snap],
      _future: [],
      _lastPush: now,
    });
  },

  undo: () => {
    const state = get();
    if (state._history.length === 0) return;
    const prev = state._history[state._history.length - 1];
    const current = takeSnapshot(state);
    set({
      ...applySnapshot(prev),
      _history: state._history.slice(0, -1),
      _future: [...state._future, current],
    });
  },

  redo: () => {
    const state = get();
    if (state._future.length === 0) return;
    const next = state._future[state._future.length - 1];
    const current = takeSnapshot(state);
    set({
      ...applySnapshot(next),
      _history: [...state._history, current],
      _future: state._future.slice(0, -1),
    });
  },

  tracks: () => {
    const state = get();
    return state.patterns[state.currentPattern]?.tracks ?? [];
  },
}));
