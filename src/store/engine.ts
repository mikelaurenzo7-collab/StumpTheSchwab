import { create } from "zustand";
import { DEFAULT_KIT, type TrackSound } from "@/lib/sounds";
import type { PatternPreset } from "@/lib/presets";

let _checkpoint: (() => void) | null = null;
export function _setCheckpoint(fn: () => void) { _checkpoint = fn; }
function pushHistory() { _checkpoint?.(); }

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
  steps: number[]; // 0 = off, 0.25–1.0 = velocity
  notes: string[]; // per-step note (empty string = use track default)
  volume: number; // 0-1
  pan: number; // -1 (left) to 1 (right)
  muted: boolean;
  solo: boolean;
  effects: TrackEffects;
}

// ── Pattern: snapshot of step data per track ──────────────────
export interface Pattern {
  name: string;
  steps: number[][]; // [trackIndex][stepIndex]
}

export const PATTERN_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const MAX_PATTERNS = PATTERN_LABELS.length;

export interface EngineState {
  // Transport
  bpm: number;
  swing: number;
  playbackState: PlaybackState;
  currentStep: number;
  totalSteps: number;

  // Patterns
  patterns: Pattern[];
  currentPattern: number; // 0–7

  // Tracks
  tracks: Track[];

  // Master bus
  master: MasterBus;

  // Piano roll
  pianoRollTrack: number | null; // which track has piano roll open, null = closed

  // Actions — transport
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setCurrentStep: (step: number) => void;

  // Actions — sequencer
  toggleStep: (trackId: number, step: number) => void;
  setStepVelocity: (trackId: number, step: number, velocity: number) => void;
  setStepNote: (trackId: number, step: number, note: string) => void;
  clearTrack: (trackId: number) => void;
  clearAll: () => void;
  setTotalSteps: (steps: number) => void;

  // Actions — piano roll
  setPianoRollTrack: (trackId: number | null) => void;
  pianoRollToggleNote: (trackId: number, step: number, note: string) => void;

  // Actions — patterns
  setCurrentPattern: (index: number) => void;
  copyPattern: (from: number, to: number) => void;
  clearPattern: (index: number) => void;
  loadPreset: (preset: PatternPreset) => void;

  // Actions — mixer
  setTrackVolume: (trackId: number, volume: number) => void;
  setTrackPan: (trackId: number, pan: number) => void;
  toggleMute: (trackId: number) => void;
  toggleSolo: (trackId: number) => void;

  // Actions — effects
  setTrackEffect: <K extends keyof TrackEffects>(trackId: number, key: K, value: TrackEffects[K]) => void;

  // Actions — master bus
  setMaster: <K extends keyof MasterBus>(key: K, value: MasterBus[K]) => void;

  // Actions — persistence
  saveSession: (name: string) => void;
  loadSession: (name: string) => boolean;
  deleteSession: (name: string) => void;
  getSavedSessions: () => string[];
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

export const VELOCITY_LEVELS = [1.0, 0.75, 0.5, 0.25] as const;

export function nextVelocity(current: number): number {
  const idx = VELOCITY_LEVELS.indexOf(current as (typeof VELOCITY_LEVELS)[number]);
  return VELOCITY_LEVELS[(idx + 1) % VELOCITY_LEVELS.length];
}

function createTracks(totalSteps: number): Track[] {
  return DEFAULT_KIT.map((sound, i) => ({
    id: i,
    sound,
    steps: Array(totalSteps).fill(0),
    notes: Array(totalSteps).fill(""),
    volume: 0.75,
    pan: 0,
    muted: false,
    solo: false,
    effects: { ...DEFAULT_EFFECTS },
  }));
}

// ── Persistence helpers ───────────────────────────────────────
const STORAGE_PREFIX = "sts_session_";

interface SessionData {
  bpm: number;
  swing: number;
  totalSteps: number;
  tracks: { steps: number[]; notes: string[]; volume: number; muted: boolean; solo: boolean; effects: TrackEffects }[];
  master: MasterBus;
}

function serializeSession(state: EngineState): SessionData {
  return {
    bpm: state.bpm,
    swing: state.swing,
    totalSteps: state.totalSteps,
    tracks: state.tracks.map((t) => ({
      steps: t.steps,
      notes: t.notes,
      volume: t.volume,
      muted: t.muted,
      solo: t.solo,
      effects: t.effects,
    })),
    master: state.master,
  };
}

// ── Pattern helpers ───────────────────────────────────────────
function createEmptyPattern(name: string, trackCount: number, totalSteps: number): Pattern {
  return {
    name,
    steps: Array.from({ length: trackCount }, () => Array(totalSteps).fill(0)),
  };
}

function snapshotSteps(tracks: Track[]): number[][] {
  return tracks.map((t) => [...t.steps]);
}

function applyStepsToTracks(tracks: Track[], patternSteps: number[][], totalSteps: number): Track[] {
  return tracks.map((t, i) => {
    const src = patternSteps[i] ?? [];
    return {
      ...t,
      steps: Array(totalSteps)
        .fill(0)
        .map((_, j) => src[j] ?? 0),
    };
  });
}

// ── Store ──────────────────────────────────────────────────────
export const useEngineStore = create<EngineState>()((set, get) => ({
  bpm: 120,
  swing: 0,
  playbackState: "stopped",
  currentStep: -1,
  totalSteps: INITIAL_STEPS,
  tracks: createTracks(INITIAL_STEPS),
  master: { ...DEFAULT_MASTER },
  pianoRollTrack: null,

  // Patterns: 8 slots, all empty, first one is active
  patterns: PATTERN_LABELS.map((label) =>
    createEmptyPattern(label, DEFAULT_KIT.length, INITIAL_STEPS)
  ),
  currentPattern: 0,

  setBpm: (bpm) => set({ bpm: Math.max(30, Math.min(300, bpm)) }),
  setSwing: (swing) => set({ swing: Math.max(0, Math.min(1, swing)) }),

  play: () => set({ playbackState: "playing" }),
  pause: () => set({ playbackState: "paused" }),
  stop: () => set({ playbackState: "stopped", currentStep: -1 }),
  setCurrentStep: (step) => set({ currentStep: step }),

  toggleStep: (trackId, step) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              steps: t.steps.map((s, i) => (i === step ? (s > 0 ? 0 : 1.0) : s)),
              notes: t.steps[step] > 0
                ? t.notes.map((n, i) => (i === step ? "" : n))
                : t.notes,
            }
          : t
      ),
    }));
  },

  setStepVelocity: (trackId, step, velocity) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, steps: t.steps.map((s, i) => (i === step ? velocity : s)) }
          : t
      ),
    }));
  },

  setStepNote: (trackId, step, note) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, notes: t.notes.map((n, i) => (i === step ? note : n)) }
          : t
      ),
    }));
  },

  clearTrack: (trackId) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, steps: t.steps.map(() => 0), notes: t.notes.map(() => "") }
          : t
      ),
    }));
  },

  clearAll: () => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        steps: t.steps.map(() => 0),
        notes: t.notes.map(() => ""),
      })),
    }));
  },

  setTotalSteps: (totalSteps) => {
    pushHistory();
    set((state) => ({
      totalSteps,
      tracks: state.tracks.map((t) => ({
        ...t,
        steps: Array(totalSteps)
          .fill(0)
          .map((_, i) => t.steps[i] ?? 0),
        notes: Array(totalSteps)
          .fill("")
          .map((_, i) => t.notes[i] ?? ""),
      })),
      // Resize all patterns too
      patterns: state.patterns.map((p) => ({
        ...p,
        steps: p.steps.map((trackSteps) =>
          Array(totalSteps)
            .fill(0)
            .map((_, i) => trackSteps[i] ?? 0)
        ),
      })),
    }));
  },

  // Piano roll
  setPianoRollTrack: (trackId) => set({ pianoRollTrack: trackId }),

  pianoRollToggleNote: (trackId, step, note) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const currentVelocity = t.steps[step];
        const currentNote = t.notes[step];

        // If this exact note is already on this step, turn the step off
        if (currentVelocity > 0 && currentNote === note) {
          return {
            ...t,
            steps: t.steps.map((s, i) => (i === step ? 0 : s)),
            notes: t.notes.map((n, i) => (i === step ? "" : n)),
          };
        }

        // Otherwise, set this note on this step (full velocity if step was off)
        return {
          ...t,
          steps: t.steps.map((s, i) => (i === step ? (s > 0 ? s : 1.0) : s)),
          notes: t.notes.map((n, i) => (i === step ? note : n)),
        };
      }),
    }));
  },

  // ── Pattern actions ──────────────────────────────────────────
  setCurrentPattern: (index) => {
    pushHistory();
    set((state) => {
      if (index === state.currentPattern || index < 0 || index >= MAX_PATTERNS) return state;

      // Save current steps into current pattern slot
      const updatedPatterns = state.patterns.map((p, i) =>
        i === state.currentPattern
          ? { ...p, steps: snapshotSteps(state.tracks) }
          : p
      );

      // Load target pattern's steps into tracks
      const targetSteps = updatedPatterns[index].steps;
      return {
        patterns: updatedPatterns,
        currentPattern: index,
        tracks: applyStepsToTracks(state.tracks, targetSteps, state.totalSteps),
      };
    });
  },

  copyPattern: (from, to) => {
    pushHistory();
    set((state) => {
      if (from === to || from < 0 || to < 0 || from >= MAX_PATTERNS || to >= MAX_PATTERNS) return state;

      // If copying from the active pattern, snapshot current live steps
      const sourceSteps =
        from === state.currentPattern
          ? snapshotSteps(state.tracks)
          : state.patterns[from].steps.map((s) => [...s]);

      const updatedPatterns = state.patterns.map((p, i) =>
        i === to ? { ...p, steps: sourceSteps } : p
      );

      // If we copied into the active pattern, also update tracks
      if (to === state.currentPattern) {
        return {
          patterns: updatedPatterns,
          tracks: applyStepsToTracks(state.tracks, sourceSteps, state.totalSteps),
        };
      }

      return { patterns: updatedPatterns };
    });
  },

  clearPattern: (index) => {
    pushHistory();
    set((state) => {
      const emptySteps = Array.from({ length: state.tracks.length }, () =>
        Array(state.totalSteps).fill(0)
      );

      const updatedPatterns = state.patterns.map((p, i) =>
        i === index ? { ...p, steps: emptySteps } : p
      );

      // If clearing active pattern, also clear tracks
      if (index === state.currentPattern) {
        return {
          patterns: updatedPatterns,
          tracks: state.tracks.map((t) => ({ ...t, steps: t.steps.map(() => 0) })),
        };
      }

      return { patterns: updatedPatterns };
    });
  },

  loadPreset: (preset) => {
    pushHistory();
    set((state) => {
      const totalSteps = preset.steps;
      const trackCount = state.tracks.length;

      // Build steps array, pad/truncate to match track count and step count
      const presetSteps = Array.from({ length: trackCount }, (_, trackIdx) => {
        const src = preset.tracks[trackIdx] ?? [];
        return Array(totalSteps)
          .fill(0)
          .map((_, stepIdx) => src[stepIdx] ?? 0);
      });

      // Save into current pattern slot and apply to tracks
      const updatedPatterns = state.patterns.map((p, i) =>
        i === state.currentPattern ? { ...p, steps: presetSteps } : p
      );

      return {
        bpm: preset.bpm,
        swing: preset.swing,
        totalSteps,
        patterns: updatedPatterns.map((p) => ({
          ...p,
          steps: p.steps.map((trackSteps) =>
            Array(totalSteps)
              .fill(0)
              .map((_, i) => trackSteps[i] ?? 0)
          ),
        })),
        tracks: state.tracks.map((t, i) => ({
          ...t,
          steps: presetSteps[i] ?? Array(totalSteps).fill(0),
        })),
      };
    });
  },

  setTrackVolume: (trackId, volume) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, volume: Math.max(0, Math.min(1, volume)) } : t
      ),
    })),

  setTrackPan: (trackId, pan) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, pan: Math.max(-1, Math.min(1, pan)) } : t
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

  // Persistence
  saveSession: (name) => {
    try {
      const data = serializeSession(get());
      localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(data));
    } catch { /* storage full or unavailable */ }
  },

  loadSession: (name) => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + name);
      if (!raw) return false;
      const data: SessionData = JSON.parse(raw);
      set((state) => ({
        bpm: data.bpm,
        swing: data.swing,
        totalSteps: data.totalSteps,
        playbackState: "stopped",
        currentStep: -1,
        tracks: state.tracks.map((t, i) => ({
          ...t,
          steps: data.tracks[i]?.steps ?? t.steps,
          notes: data.tracks[i]?.notes ?? t.notes.map(() => ""),
          volume: data.tracks[i]?.volume ?? t.volume,
          muted: data.tracks[i]?.muted ?? t.muted,
          solo: data.tracks[i]?.solo ?? t.solo,
          effects: data.tracks[i]?.effects ?? t.effects,
        })),
        master: data.master,
      }));
      return true;
    } catch {
      return false;
    }
  },

  deleteSession: (name) => {
    try {
      localStorage.removeItem(STORAGE_PREFIX + name);
    } catch { /* unavailable */ }
  },

  getSavedSessions: () => {
    try {
      const sessions: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          sessions.push(key.slice(STORAGE_PREFIX.length));
        }
      }
      return sessions.sort();
    } catch {
      return [];
    }
  },
}));
