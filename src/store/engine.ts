import { create } from "zustand";
import { DEFAULT_KIT, type TrackSound } from "@/lib/sounds";

// ── Types ──────────────────────────────────────────────────────
export type PlaybackState = "stopped" | "playing" | "paused";
export type FilterType = "lowpass" | "highpass";

export interface TrackEffects {
  filterOn: boolean;
  filterType: FilterType;
  filterFreq: number; // 20–20000 Hz
  filterQ: number; // 0.1–20

  delayOn: boolean;
  delayTime: number; // 0–1 seconds
  delayFeedback: number; // 0–0.9
  delayWet: number; // 0–1

  reverbOn: boolean;
  reverbDecay: number; // 0.1–10 seconds
  reverbWet: number; // 0–1
}

export interface MasterBus {
  volume: number; // 0–1
  compressorOn: boolean;
  compressorThreshold: number; // -60 to 0 dB
  compressorRatio: number; // 1–20
  compressorAttack: number; // 0–1 seconds
  compressorRelease: number; // 0–1 seconds
  limiterOn: boolean;
  limiterThreshold: number; // -30 to 0 dB
}

export interface Track {
  id: number;
  sound: TrackSound;
  steps: boolean[];
  volume: number; // 0-1
  muted: boolean;
  solo: boolean;
  effects: TrackEffects;
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

  // Master bus
  master: MasterBus;

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
  setTrackEffect: <K extends keyof TrackEffects>(trackId: number, key: K, value: TrackEffects[K]) => void;

  // Actions — master bus
  setMaster: <K extends keyof MasterBus>(key: K, value: MasterBus[K]) => void;
}

// ── Helpers ────────────────────────────────────────────────────
const INITIAL_STEPS = 16;

export const DEFAULT_EFFECTS: TrackEffects = {
  filterOn: false,
  filterType: "lowpass",
  filterFreq: 20000,
  filterQ: 1,
  delayOn: false,
  delayTime: 0.25,
  delayFeedback: 0.3,
  delayWet: 0.3,
  reverbOn: false,
  reverbDecay: 1.5,
  reverbWet: 0.2,
};

const DEFAULT_MASTER: MasterBus = {
  volume: 0.8,
  compressorOn: true,
  compressorThreshold: -18,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.25,
  limiterOn: true,
  limiterThreshold: -3,
};

function createTracks(totalSteps: number): Track[] {
  return DEFAULT_KIT.map((sound, i) => ({
    id: i,
    sound,
    steps: Array(totalSteps).fill(false),
    volume: 0.75,
    muted: false,
    solo: false,
    effects: { ...DEFAULT_EFFECTS },
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
  master: { ...DEFAULT_MASTER },

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

  setTrackEffect: (trackId, key, value) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, effects: { ...t.effects, [key]: value } }
          : t
      ),
    })),

  setMaster: (key, value) =>
    set((state) => ({
      master: { ...state.master, [key]: value },
    })),
}));
