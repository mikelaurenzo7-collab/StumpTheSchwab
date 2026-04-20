import { create } from "zustand";
import { useEngineStore, _setCheckpoint, type Track, type Pattern, type MasterBus } from "./engine";

const MAX_HISTORY = 50;

interface Snapshot {
  bpm: number;
  swing: number;
  totalSteps: number;
  tracks: Pick<Track, "steps" | "notes" | "volume" | "pan" | "muted" | "solo" | "effects">[];
  patterns: Pattern[];
  currentPattern: number;
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
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      solo: t.solo,
      effects: { ...t.effects },
    })),
    patterns: s.patterns.map((p) => ({
      ...p,
      steps: p.steps.map((row) => [...row]),
    })),
    currentPattern: s.currentPattern,
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
    master: snapshot.master,
    tracks: state.tracks.map((t, i) => ({
      ...t,
      steps: snapshot.tracks[i]?.steps ?? t.steps,
      notes: snapshot.tracks[i]?.notes ?? t.notes,
      volume: snapshot.tracks[i]?.volume ?? t.volume,
      pan: snapshot.tracks[i]?.pan ?? t.pan,
      muted: snapshot.tracks[i]?.muted ?? t.muted,
      solo: snapshot.tracks[i]?.solo ?? t.solo,
      effects: snapshot.tracks[i]?.effects ?? t.effects,
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
