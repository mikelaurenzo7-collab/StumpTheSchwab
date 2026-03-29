import { create } from "zustand";
import { DEFAULT_KIT, type TrackSound } from "@/lib/sounds";

// ── Types ──────────────────────────────────────────────────────
export type PlaybackState = "stopped" | "playing" | "paused";
export type FilterType = "lowpass" | "highpass" | "bandpass";

export interface Track {
  id: number;
  sound: TrackSound;
  steps: boolean[];
  volume: number; // 0-1
  muted: boolean;
  solo: boolean;
  // Effects — per track
  filterFreq: number; // 20-20000 Hz
  filterType: FilterType;
  filterQ: number; // 0.1-20
  reverbSend: number; // 0-1
  delaySend: number; // 0-1
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

  // Master effects
  reverbDecay: number; // 0.1-10
  delayTime: string; // "16n" | "8n" | "4n" | "8t"
  delayFeedback: number; // 0-0.95

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
  setFilterFreq: (trackId: number, freq: number) => void;
  setFilterType: (trackId: number, type: FilterType) => void;
  setFilterQ: (trackId: number, q: number) => void;
  setReverbSend: (trackId: number, level: number) => void;
  setDelaySend: (trackId: number, level: number) => void;
  setReverbDecay: (decay: number) => void;
  setDelayTime: (time: string) => void;
  setDelayFeedback: (feedback: number) => void;
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
    filterFreq: 20000,
    filterType: "lowpass" as FilterType,
    filterQ: 1,
    reverbSend: 0,
    delaySend: 0,
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
  reverbDecay: 2.5,
  delayTime: "8n",
  delayFeedback: 0.3,

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

  setFilterFreq: (trackId, freq) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, filterFreq: Math.max(20, Math.min(20000, freq)) } : t
      ),
    })),

  setFilterType: (trackId, type) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, filterType: type } : t
      ),
    })),

  setFilterQ: (trackId, q) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, filterQ: Math.max(0.1, Math.min(20, q)) } : t
      ),
    })),

  setReverbSend: (trackId, level) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, reverbSend: Math.max(0, Math.min(1, level)) } : t
      ),
    })),

  setDelaySend: (trackId, level) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, delaySend: Math.max(0, Math.min(1, level)) } : t
      ),
    })),

  setReverbDecay: (decay) => set({ reverbDecay: Math.max(0.1, Math.min(10, decay)) }),
  setDelayTime: (time) => set({ delayTime: time }),
  setDelayFeedback: (feedback) => set({ delayFeedback: Math.max(0, Math.min(0.95, feedback)) }),
}));
