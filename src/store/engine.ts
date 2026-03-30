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

  // Effects
  reverbWet: number; // 0-1
  delayWet: number; // 0-1
  delayTime: string; // Tone.js time notation ("8n", "16n", etc.)
  delayFeedback: number; // 0-1

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

  // Actions — effects
  setReverbWet: (wet: number) => void;
  setDelayWet: (wet: number) => void;
  setDelayTime: (time: string) => void;
  setDelayFeedback: (feedback: number) => void;

  // Actions — persistence
  savePattern: () => void;
  loadPattern: () => void;
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

// ── Persistence ───────────────────────────────────────────────
const STORAGE_KEY = "sts-pattern";

interface SavedState {
  bpm: number;
  swing: number;
  totalSteps: number;
  reverbWet: number;
  delayWet: number;
  delayTime: string;
  delayFeedback: number;
  tracks: { id: number; steps: boolean[]; volume: number; muted: boolean; solo: boolean }[];
}

// ── Store ──────────────────────────────────────────────────────
export const useEngineStore = create<EngineState>()((set, get) => ({
  bpm: 120,
  swing: 0,
  playbackState: "stopped",
  currentStep: -1,
  totalSteps: INITIAL_STEPS,
  tracks: createTracks(INITIAL_STEPS),

  // Effects defaults
  reverbWet: 0.2,
  delayWet: 0.12,
  delayTime: "8n",
  delayFeedback: 0.25,

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

  // Effects
  setReverbWet: (wet) => set({ reverbWet: Math.max(0, Math.min(1, wet)) }),
  setDelayWet: (wet) => set({ delayWet: Math.max(0, Math.min(1, wet)) }),
  setDelayTime: (time) => set({ delayTime: time }),
  setDelayFeedback: (feedback) => set({ delayFeedback: Math.max(0, Math.min(1, feedback)) }),

  // Persistence
  savePattern: () => {
    const state = get();
    const saved: SavedState = {
      bpm: state.bpm,
      swing: state.swing,
      totalSteps: state.totalSteps,
      reverbWet: state.reverbWet,
      delayWet: state.delayWet,
      delayTime: state.delayTime,
      delayFeedback: state.delayFeedback,
      tracks: state.tracks.map((t) => ({
        id: t.id,
        steps: t.steps,
        volume: t.volume,
        muted: t.muted,
        solo: t.solo,
      })),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  },

  loadPattern: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved: SavedState = JSON.parse(raw);
      set((state) => ({
        bpm: saved.bpm ?? state.bpm,
        swing: saved.swing ?? state.swing,
        totalSteps: saved.totalSteps ?? state.totalSteps,
        reverbWet: saved.reverbWet ?? state.reverbWet,
        delayWet: saved.delayWet ?? state.delayWet,
        delayTime: saved.delayTime ?? state.delayTime,
        delayFeedback: saved.delayFeedback ?? state.delayFeedback,
        tracks: state.tracks.map((t) => {
          const st = saved.tracks?.find((s) => s.id === t.id);
          if (!st) return t;
          return {
            ...t,
            steps: Array(saved.totalSteps ?? state.totalSteps)
              .fill(false)
              .map((_, i) => st.steps[i] ?? false),
            volume: st.volume ?? t.volume,
            muted: st.muted ?? t.muted,
            solo: st.solo ?? t.solo,
          };
        }),
      }));
    } catch {
      // Corrupted data — silently ignore
    }
  },
}));
