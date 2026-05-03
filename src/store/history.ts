import { create } from "zustand";
import { useEngineStore, _setCheckpoint, type Track, type Pattern, type MasterBus, type TrackEffects } from "./engine";

const MAX_HISTORY = 50;

interface SnapshotTrack {
  steps: number[];
  notes: string[];
  probabilities: number[];
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  effects: TrackEffects;
  noteLength: number;
  nudge: number[];
  stepLocks: Array<Partial<TrackEffects> | undefined>;
  sampleReverse: boolean;
  samplePitchShift: number;
}

interface Snapshot {
  bpm: number;
  swing: number;
  totalSteps: number;
  tracks: SnapshotTrack[];
  patterns: Pattern[];
  currentPattern: number;
  chain: number[];
  chainMeta: Array<{ bpmOverride?: number; swingOverride?: number }>;
  songMode: boolean;
  master: MasterBus;
}

interface HistoryState {
  past: Snapshot[];
  future: Snapshot[];
  undo: () => void;
  redo: () => void;
  checkpoint: () => void;
}

function captureSnapshot(): Snapshot {
  const s = useEngineStore.getState();
  return {
    bpm: s.bpm,
    swing: s.swing,
    totalSteps: s.totalSteps,
    tracks: s.tracks.map((t) => ({
      steps: [...t.steps],
      notes: [...t.notes],
      probabilities: [...t.probabilities],
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      solo: t.solo,
      effects: { ...t.effects },
      noteLength: t.noteLength,
      nudge: [...t.nudge],
      stepLocks: [...t.stepLocks],
      sampleReverse: t.sampleReverse,
      samplePitchShift: t.samplePitchShift,
    })),
    patterns: s.patterns.map((p) => ({
      ...p,
      steps: p.steps.map((row) => [...row]),
      probabilities: p.probabilities.map((row) => [...row]),
    })),
    currentPattern: s.currentPattern,
    chain: [...s.chain],
    chainMeta: s.chainMeta.map((m) => ({ ...m })),
    songMode: s.songMode,
    master: { ...s.master },
  };
}

function restoreSnapshot(snapshot: Snapshot) {
  const state = useEngineStore.getState();
  useEngineStore.setState({
    bpm: snapshot.bpm,
    swing: snapshot.swing,
    totalSteps: snapshot.totalSteps,
    currentPattern: snapshot.currentPattern,
    patterns: snapshot.patterns,
    chain: snapshot.chain,
    chainMeta: snapshot.chainMeta,
    songMode: snapshot.songMode,
    master: snapshot.master,
    tracks: state.tracks.map((t, i) => ({
      ...t,
      steps: snapshot.tracks[i]?.steps ?? t.steps,
      notes: snapshot.tracks[i]?.notes ?? t.notes,
      probabilities: snapshot.tracks[i]?.probabilities ?? t.probabilities,
      volume: snapshot.tracks[i]?.volume ?? t.volume,
      pan: snapshot.tracks[i]?.pan ?? t.pan,
      muted: snapshot.tracks[i]?.muted ?? t.muted,
      solo: snapshot.tracks[i]?.solo ?? t.solo,
      effects: snapshot.tracks[i]?.effects ?? t.effects,
      noteLength: snapshot.tracks[i]?.noteLength ?? t.noteLength,
      nudge: snapshot.tracks[i]?.nudge ?? t.nudge,
      stepLocks: snapshot.tracks[i]?.stepLocks ?? t.stepLocks,
      sampleReverse: snapshot.tracks[i]?.sampleReverse ?? t.sampleReverse,
      samplePitchShift: snapshot.tracks[i]?.samplePitchShift ?? t.samplePitchShift,
    })),
  });
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],

  checkpoint: () => {
    const snapshot = captureSnapshot();
    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snapshot],
      future: [],
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;

    const current = captureSnapshot();
    const previous = past[past.length - 1];

    set((s) => ({
      past: s.past.slice(0, -1),
      future: [current, ...s.future],
    }));

    restoreSnapshot(previous);
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;

    const current = captureSnapshot();
    const next = future[0];

    set((s) => ({
      past: [...s.past, current],
      future: s.future.slice(1),
    }));

    restoreSnapshot(next);
  },
}));

export function checkpoint() {
  useHistoryStore.getState().checkpoint();
}

_setCheckpoint(checkpoint);
