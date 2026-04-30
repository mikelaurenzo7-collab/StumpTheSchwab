import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { TRACKS, STEPS, SCENE_NAMES, type VoiceType } from "@/lib/sounds";

export interface Step {
  active: boolean;
  probability: number;
}

export interface Track {
  id: string;
  name: string;
  voice: VoiceType;
  color: string;
  hue: number;
  steps: Step[];
  level: number;
  pitch: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

export interface Pattern {
  id: number;
  name: string;
  tracks: Track[];
}

export interface Macro {
  bloom: number;
  gravity: number;
  shimmer: number;
  fracture: number;
}

export interface GeneratedBeat {
  bpm?: number;
  swing?: number;
  tracks: {
    voice: VoiceType;
    steps: boolean[];
    level?: number;
    pitch?: number;
  }[];
}

interface Snapshot {
  patterns: Pattern[];
  currentPattern: number;
  bpm: number;
  swing: number;
  macros: Macro;
}

function makeStep(active: boolean): Step {
  return { active, probability: 100 };
}

function makeTrackFromDef(def: (typeof TRACKS)[number]): Track {
  return {
    id: def.id,
    name: def.name,
    voice: def.voice,
    color: def.color,
    hue: def.hue,
    steps: def.defaultPattern.map(makeStep),
    level: def.defaultLevel,
    pitch: def.defaultPitch,
    pan: 0,
    mute: false,
    solo: false,
  };
}

function makeDefaultPattern(id: number): Pattern {
  return {
    id,
    name: `Pattern ${id + 1}`,
    tracks: TRACKS.map(makeTrackFromDef),
  };
}

function takeSnapshot(state: EngineState): Snapshot {
  return {
    patterns: JSON.parse(JSON.stringify(state.patterns)),
    currentPattern: state.currentPattern,
    bpm: state.bpm,
    swing: state.swing,
    macros: { ...state.macros },
  };
}

function applySnapshot(snapshot: Snapshot): Partial<EngineState> {
  return {
    patterns: snapshot.patterns,
    currentPattern: snapshot.currentPattern,
    bpm: snapshot.bpm,
    swing: snapshot.swing,
    macros: snapshot.macros,
  };
}

const MAX_HISTORY = 64;

export interface EngineState {
  // Transport
  playing: boolean;
  bpm: number;
  swing: number;
  currentStep: number;
  scene: string;

  // Patterns
  patterns: Pattern[];
  currentPattern: number;

  // Macros
  macros: Macro;

  // Song mode
  songMode: boolean;
  chain: number[];

  // AI
  generating: boolean;
  prompt: string;

  // History
  past: Snapshot[];
  future: Snapshot[];

  // Computed
  tracks: () => Track[];
  energy: () => number;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Transport actions
  togglePlay: () => void;
  stop: () => void;
  setStep: (step: number) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  randomizeScene: () => void;

  // Sequencer actions
  toggleStep: (trackIndex: number, stepIndex: number) => void;
  setStepProbability: (trackIndex: number, stepIndex: number, probability: number) => void;
  clearTrack: (trackIndex: number) => void;
  fillTrack: (trackIndex: number) => void;

  // Mixer actions
  setLevel: (trackIndex: number, level: number) => void;
  setPan: (trackIndex: number, pan: number) => void;
  setPitch: (trackIndex: number, pitch: number) => void;
  toggleMute: (trackIndex: number) => void;
  toggleSolo: (trackIndex: number) => void;

  // Pattern actions
  selectPattern: (index: number) => void;
  copyPattern: (from: number, to: number) => void;

  // Macro actions
  setMacro: (key: keyof Macro, value: number) => void;

  // AI actions
  setPrompt: (prompt: string) => void;
  setGenerating: (generating: boolean) => void;
  applyGeneratedBeat: (beat: GeneratedBeat) => void;

  // Generative actions
  regenerate: () => void;
  mutate: () => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

function updateTrack(
  state: EngineState,
  trackIndex: number,
  updater: (track: Track) => Track,
): Partial<EngineState> {
  const patterns = state.patterns.map((p, pi) =>
    pi === state.currentPattern
      ? { ...p, tracks: p.tracks.map((t, ti) => (ti === trackIndex ? updater(t) : t)) }
      : p,
  );
  return { patterns };
}

function currentTracks(state: EngineState): Track[] {
  return state.patterns[state.currentPattern]?.tracks ?? [];
}

function generatePattern(voice: VoiceType, density: number, gravity: number, hue: number): boolean[] {
  return Array.from({ length: STEPS }, (_, step) => {
    const downbeat = step % 4 === 0;
    const offbeat = step % 4 === 2;
    const phase = Math.sin((step + hue / 36) * (0.9 + gravity / 80));

    if (voice === "kick") return downbeat || (phase > 0.75 && density > 64);
    if (voice === "snare") return step === 4 || step === 12 || (phase > 0.86 && density > 74);
    if (voice === "clap") return step === 4 || step === 12;
    if (voice === "hat") return step % 2 === 0 || phase > 0.38;
    if (voice === "pad") return step === 0 || step === 8 || (phase > 0.92 && density > 80);
    if (voice === "perc") return phase > 0.6 && !downbeat;
    const threshold = density / 100 + (downbeat ? 0.22 : 0) + (offbeat ? 0.08 : 0);
    return phase + threshold > 1.08;
  });
}

export const useEngine = create<EngineState>()(subscribeWithSelector((set, get) => ({
  playing: false,
  bpm: 126,
  swing: 0,
  currentStep: 0,
  scene: "Nebula Breaks",

  patterns: [makeDefaultPattern(0), makeDefaultPattern(1), makeDefaultPattern(2), makeDefaultPattern(3)],
  currentPattern: 0,

  macros: { bloom: 72, gravity: 44, shimmer: 63, fracture: 28 },

  songMode: false,
  chain: [],

  generating: false,
  prompt: "",

  past: [],
  future: [],

  tracks: () => currentTracks(get()),
  energy: () => {
    const tracks = currentTracks(get());
    const active = tracks.reduce((sum, t) => sum + t.steps.filter((s) => s.active).length * t.level, 0);
    return Math.round((active / (tracks.length * STEPS)) * 100);
  },
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  togglePlay: () => set((s) => ({ playing: !s.playing })),
  stop: () => set({ playing: false, currentStep: 0 }),
  setStep: (step) => set({ currentStep: step }),
  setBpm: (bpm) => set({ bpm: Math.max(40, Math.min(220, bpm)) }),
  setSwing: (swing) => set({ swing: Math.max(0, Math.min(100, swing)) }),
  randomizeScene: () => {
    set({ scene: SCENE_NAMES[Math.floor(Math.random() * SCENE_NAMES.length)] });
  },

  toggleStep: (trackIndex, stepIndex) => {
    const state = get();
    state.pushHistory();
    set(updateTrack(state, trackIndex, (t) => ({
      ...t,
      steps: t.steps.map((s, i) => (i === stepIndex ? { ...s, active: !s.active } : s)),
    })));
  },

  setStepProbability: (trackIndex, stepIndex, probability) => {
    set((s) =>
      updateTrack(s, trackIndex, (t) => ({
        ...t,
        steps: t.steps.map((step, i) => (i === stepIndex ? { ...step, probability } : step)),
      })),
    );
  },

  clearTrack: (trackIndex) => {
    const state = get();
    state.pushHistory();
    set(updateTrack(state, trackIndex, (t) => ({
      ...t,
      steps: t.steps.map((s) => ({ ...s, active: false })),
    })));
  },

  fillTrack: (trackIndex) => {
    const state = get();
    state.pushHistory();
    set(updateTrack(state, trackIndex, (t) => ({
      ...t,
      steps: t.steps.map((s) => ({ ...s, active: true })),
    })));
  },

  setLevel: (trackIndex, level) => {
    set((s) => updateTrack(s, trackIndex, (t) => ({ ...t, level })));
  },

  setPan: (trackIndex, pan) => {
    set((s) => updateTrack(s, trackIndex, (t) => ({ ...t, pan })));
  },

  setPitch: (trackIndex, pitch) => {
    set((s) => updateTrack(s, trackIndex, (t) => ({ ...t, pitch })));
  },

  toggleMute: (trackIndex) => {
    set((s) => updateTrack(s, trackIndex, (t) => ({ ...t, mute: !t.mute })));
  },

  toggleSolo: (trackIndex) => {
    set((s) => updateTrack(s, trackIndex, (t) => ({ ...t, solo: !t.solo })));
  },

  selectPattern: (index) => {
    const state = get();
    if (index >= 0 && index < state.patterns.length) {
      set({ currentPattern: index });
    }
  },

  copyPattern: (from, to) => {
    const state = get();
    state.pushHistory();
    const source = state.patterns[from];
    if (!source) return;
    set({
      patterns: state.patterns.map((p, i) =>
        i === to ? { ...JSON.parse(JSON.stringify(source)), id: to, name: `Pattern ${to + 1}` } : p,
      ),
    });
  },

  setMacro: (key, value) => {
    set((s) => ({ macros: { ...s.macros, [key]: Math.max(0, Math.min(100, value)) } }));
  },

  setPrompt: (prompt) => set({ prompt }),
  setGenerating: (generating) => set({ generating }),

  applyGeneratedBeat: (beat) => {
    const state = get();
    state.pushHistory();
    if (beat.bpm) set({ bpm: beat.bpm });
    if (beat.swing !== undefined) set({ swing: beat.swing });

    const tracks = currentTracks(state);
    const updated = tracks.map((track) => {
      const match = beat.tracks.find((bt) => bt.voice === track.voice);
      if (!match) return track;
      return {
        ...track,
        steps: match.steps.map((active) => makeStep(active)),
        level: match.level ?? track.level,
        pitch: match.pitch ?? track.pitch,
      };
    });

    set({
      patterns: state.patterns.map((p, i) =>
        i === state.currentPattern ? { ...p, tracks: updated } : p,
      ),
    });
  },

  regenerate: () => {
    const state = get();
    state.pushHistory();
    const density = 62;
    const { gravity } = state.macros;
    state.randomizeScene();
    const tracks = currentTracks(state);
    const updated = tracks.map((track) => ({
      ...track,
      steps: generatePattern(track.voice, density, gravity, track.hue).map(makeStep),
    }));
    set({
      patterns: state.patterns.map((p, i) =>
        i === state.currentPattern ? { ...p, tracks: updated } : p,
      ),
    });
  },

  mutate: () => {
    const state = get();
    state.pushHistory();
    const { fracture } = state.macros;
    const step = state.currentStep;
    const tracks = currentTracks(state);
    const updated = tracks.map((track) => ({
      ...track,
      steps: track.steps.map((s, i) => ({
        ...s,
        active: Math.random() < fracture / 260 || i === step ? !s.active : s.active,
      })),
    }));
    set({
      patterns: state.patterns.map((p, i) =>
        i === state.currentPattern ? { ...p, tracks: updated } : p,
      ),
    });
  },

  pushHistory: () => {
    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), takeSnapshot(s)],
      future: [],
    }));
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    set({
      ...applySnapshot(previous),
      past: state.past.slice(0, -1),
      future: [takeSnapshot(state), ...state.future],
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    set({
      ...applySnapshot(next),
      past: [...state.past, takeSnapshot(state)],
      future: state.future.slice(1),
    });
  },
})));
