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

export interface EngineState {
  // Transport
  bpm: number;
  swing: number;
  playbackState: PlaybackState;
  currentStep: number;
  totalSteps: number;

  // Tracks
  tracks: Track[];

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
}

// ── Helpers ────────────────────────────────────────────────────
const INITIAL_STEPS = 16;

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

// ── Store ──────────────────────────────────────────────────────
export const useEngineStore = create<EngineState>()((set) => ({
  bpm: 120,
  swing: 0,
  playbackState: "stopped",
  currentStep: -1,
  totalSteps: INITIAL_STEPS,
  tracks: createTracks(INITIAL_STEPS),

  setBpm: (bpm) => set({ bpm: Math.max(30, Math.min(300, bpm)) }),
  setSwing: (swing) => set({ swing: Math.max(0, Math.min(1, swing)) }),

  play: () => set({ playbackState: "playing" }),
  pause: () => set({ playbackState: "paused" }),
  stop: () => set({ playbackState: "stopped", currentStep: -1 }),
  setCurrentStep: (step) => set({ currentStep: step }),

  toggleStep: (trackId, step) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, steps: t.steps.map((s, i) => (i === step ? !s : s)) }
          : t
      ),
    })),

  clearTrack: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, steps: t.steps.map(() => false) } : t
      ),
    })),

  clearAll: () =>
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        steps: t.steps.map(() => false),
      })),
    })),

  setTotalSteps: (totalSteps) =>
    set((state) => ({
      totalSteps,
      tracks: state.tracks.map((t) => ({
        ...t,
        steps: Array(totalSteps)
          .fill(false)
          .map((_, i) => t.steps[i] ?? false),
      })),
    })),

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
}));
