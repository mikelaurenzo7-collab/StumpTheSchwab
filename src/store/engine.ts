import { create } from "zustand";
import { DEFAULT_KIT, type TrackSound } from "@/lib/sounds";

// ── Types ──────────────────────────────────────────────────────
export type PlaybackState = "stopped" | "playing" | "paused";

export interface Track {
  id: number;
  sound: TrackSound;
  steps: boolean[];
  volume: number; // 0-1
  muted: boolean;
  solo: boolean;
}

// Snapshot captures the user-editable state for undo/redo
interface Snapshot {
  tracks: Track[];
  bpm: number;
  swing: number;
  totalSteps: number;
}

export interface EngineState {
  // Transport
  bpm: number;
  swing: number;
  playbackState: PlaybackState;
  currentStep: number;
  totalSteps: number;

  // Tracks
  tracks: Track[];

  // History
  _past: Snapshot[];
  _future: Snapshot[];
  canUndo: boolean;
  canRedo: boolean;

  // Actions — transport
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setCurrentStep: (step: number) => void;

  // Actions — sequencer
  toggleStep: (trackId: number, step: number) => void;
  clearTrack: (trackId: number) => void;
  clearAll: () => void;
  setTotalSteps: (steps: number) => void;

  // Actions — mixer
  setTrackVolume: (trackId: number, volume: number) => void;
  toggleMute: (trackId: number) => void;
  toggleSolo: (trackId: number) => void;

  // Actions — history
  undo: () => void;
  redo: () => void;

  // Actions — pattern loading
  loadPattern: (pattern: { tracks: Track[]; bpm: number; swing: number; totalSteps: number }) => void;
}

// ── Helpers ────────────────────────────────────────────────────
const INITIAL_STEPS = 16;
const MAX_HISTORY = 50;

function createTracks(totalSteps: number): Track[] {
  return DEFAULT_KIT.map((sound, i) => ({
    id: i,
    sound,
    steps: Array(totalSteps).fill(false),
    volume: 0.75,
    muted: false,
    solo: false,
  }));
}

function snapshot(state: EngineState): Snapshot {
  return {
    tracks: state.tracks.map((t) => ({ ...t, steps: [...t.steps] })),
    bpm: state.bpm,
    swing: state.swing,
    totalSteps: state.totalSteps,
  };
}

// Wraps a state update to push current state onto the undo stack
function withHistory(
  state: EngineState,
  changes: Partial<EngineState>
): Partial<EngineState> {
  const past = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
  return { ...changes, _past: past, _future: [], canUndo: true, canRedo: false };
}

// ── Store ──────────────────────────────────────────────────────
export const useEngineStore = create<EngineState>()((set) => ({
  bpm: 120,
  swing: 0,
  playbackState: "stopped",
  currentStep: -1,
  totalSteps: INITIAL_STEPS,
  tracks: createTracks(INITIAL_STEPS),

  _past: [],
  _future: [],
  canUndo: false,
  canRedo: false,

  setBpm: (bpm) =>
    set((state) =>
      withHistory(state, { bpm: Math.max(30, Math.min(300, bpm)) })
    ),
  setSwing: (swing) =>
    set((state) =>
      withHistory(state, { swing: Math.max(0, Math.min(1, swing)) })
    ),

  play: () => set({ playbackState: "playing" }),
  pause: () => set({ playbackState: "paused" }),
  stop: () => set({ playbackState: "stopped", currentStep: -1 }),
  setCurrentStep: (step) => set({ currentStep: step }),

  toggleStep: (trackId, step) =>
    set((state) =>
      withHistory(state, {
        tracks: state.tracks.map((t) =>
          t.id === trackId
            ? { ...t, steps: t.steps.map((s, i) => (i === step ? !s : s)) }
            : t
        ),
      })
    ),

  clearTrack: (trackId) =>
    set((state) =>
      withHistory(state, {
        tracks: state.tracks.map((t) =>
          t.id === trackId ? { ...t, steps: t.steps.map(() => false) } : t
        ),
      })
    ),

  clearAll: () =>
    set((state) =>
      withHistory(state, {
        tracks: state.tracks.map((t) => ({
          ...t,
          steps: t.steps.map(() => false),
        })),
      })
    ),

  setTotalSteps: (totalSteps) =>
    set((state) =>
      withHistory(state, {
        totalSteps,
        tracks: state.tracks.map((t) => ({
          ...t,
          steps: Array(totalSteps)
            .fill(false)
            .map((_, i) => t.steps[i] ?? false),
        })),
      })
    ),

  setTrackVolume: (trackId, volume) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, volume: Math.max(0, Math.min(1, volume)) } : t
      ),
    })),

  toggleMute: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    })),

  toggleSolo: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, solo: !t.solo } : t
      ),
    })),

  undo: () =>
    set((state) => {
      if (state._past.length === 0) return state;
      const prev = state._past[state._past.length - 1];
      const newPast = state._past.slice(0, -1);
      const newFuture = [snapshot(state), ...state._future].slice(0, MAX_HISTORY);
      return {
        ...prev,
        _past: newPast,
        _future: newFuture,
        canUndo: newPast.length > 0,
        canRedo: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state._future.length === 0) return state;
      const next = state._future[0];
      const newFuture = state._future.slice(1);
      const newPast = [...state._past, snapshot(state)].slice(-MAX_HISTORY);
      return {
        ...next,
        _past: newPast,
        _future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
      };
    }),

  loadPattern: (pattern) =>
    set((state) =>
      withHistory(state, {
        tracks: pattern.tracks,
        bpm: pattern.bpm,
        swing: pattern.swing,
        totalSteps: pattern.totalSteps,
      })
    ),
}));
