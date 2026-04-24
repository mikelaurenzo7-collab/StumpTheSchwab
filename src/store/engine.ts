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
  filterFreq: number;
  filterQ: number;
  delayOn: boolean;
  delayTime: number;
  delayFeedback: number;
  delayWet: number;
  reverbOn: boolean;
  reverbDecay: number;
  reverbWet: number;
}

export interface MasterBus {
  volume: number;
  compressorOn: boolean;
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  limiterOn: boolean;
  limiterThreshold: number;
}

export interface Track {
  id: number;
  sound: TrackSound;
  steps: number[];
  notes: string[];
  probabilities: number[];
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  effects: TrackEffects;
}

export interface Pattern {
  name: string;
  steps: number[][];
  probabilities: number[][];
}

export const PATTERN_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const MAX_PATTERNS = PATTERN_LABELS.length;

export interface EngineState {
  bpm: number;
  swing: number;
  playbackState: PlaybackState;
  currentStep: number;
  totalSteps: number;

  patterns: Pattern[];
  currentPattern: number;

  tracks: Track[];

  master: MasterBus;

  pianoRollTrack: number | null;

  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setCurrentStep: (step: number) => void;

  toggleStep: (trackId: number, step: number) => void;
  setStepVelocity: (trackId: number, step: number, velocity: number) => void;
  setStepNote: (trackId: number, step: number, note: string) => void;
  setStepProbability: (trackId: number, step: number, probability: number) => void;
  clearTrack: (trackId: number) => void;
  clearAll: () => void;
  setTotalSteps: (steps: number) => void;

  setPianoRollTrack: (trackId: number | null) => void;
  pianoRollToggleNote: (trackId: number, step: number, note: string) => void;

  setCurrentPattern: (index: number) => void;
  copyPattern: (from: number, to: number) => void;
  clearPattern: (index: number) => void;
  loadPreset: (preset: PatternPreset) => void;

  setTrackVolume: (trackId: number, volume: number) => void;
  setTrackPan: (trackId: number, pan: number) => void;
  toggleMute: (trackId: number) => void;
  toggleSolo: (trackId: number) => void;

  setTrackEffect: <K extends keyof TrackEffects>(trackId: number, key: K, value: TrackEffects[K]) => void;
  setMaster: <K extends keyof MasterBus>(key: K, value: MasterBus[K]) => void;

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
export const PROBABILITY_LEVELS = [1.0, 0.75, 0.5, 0.25] as const;

export function nextVelocity(current: number): number {
  const idx = VELOCITY_LEVELS.indexOf(current as (typeof VELOCITY_LEVELS)[number]);
  return VELOCITY_LEVELS[(idx + 1) % VELOCITY_LEVELS.length];
}

export function nextProbability(current: number): number {
  const idx = PROBABILITY_LEVELS.indexOf(current as (typeof PROBABILITY_LEVELS)[number]);
  if (idx === -1) return 0.75;
  return PROBABILITY_LEVELS[(idx + 1) % PROBABILITY_LEVELS.length];
}

function createTracks(totalSteps: number): Track[] {
  return DEFAULT_KIT.map((sound, i) => ({
    id: i,
    sound,
    steps: Array(totalSteps).fill(0),
    notes: Array(totalSteps).fill(""),
    probabilities: Array(totalSteps).fill(1.0),
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
  tracks: {
    steps: number[];
    notes: string[];
    probabilities?: number[];
    volume: number;
    pan?: number;
    muted: boolean;
    solo: boolean;
    effects: TrackEffects;
  }[];
  patterns?: { name: string; steps: number[][]; probabilities?: number[][] }[];
  currentPattern?: number;
  master: MasterBus;
}

function serializeSession(state: EngineState): SessionData {
  return {
    bpm: state.bpm,
    swing: state.swing,
    totalSteps: state.totalSteps,
    currentPattern: state.currentPattern,
    tracks: state.tracks.map((t) => ({
      steps: t.steps,
      notes: t.notes,
      probabilities: t.probabilities,
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      solo: t.solo,
      effects: t.effects,
    })),
    patterns: state.patterns.map((p) => ({
      name: p.name,
      steps: p.steps,
      probabilities: p.probabilities,
    })),
    master: state.master,
  };
}

// ── Pattern helpers ───────────────────────────────────────────
function createEmptyPattern(name: string, trackCount: number, totalSteps: number): Pattern {
  return {
    name,
    steps: Array.from({ length: trackCount }, () => Array(totalSteps).fill(0)),
    probabilities: Array.from({ length: trackCount }, () => Array(totalSteps).fill(1.0)),
  };
}

function snapshotPattern(tracks: Track[]): { steps: number[][]; probabilities: number[][] } {
  return {
    steps: tracks.map((t) => [...t.steps]),
    probabilities: tracks.map((t) => [...t.probabilities]),
  };
}

function applyPatternToTracks(tracks: Track[], pattern: { steps: number[][]; probabilities: number[][] }, totalSteps: number): Track[] {
  return tracks.map((t, i) => {
    const srcSteps = pattern.steps[i] ?? [];
    const srcProbs = pattern.probabilities[i] ?? [];
    return {
      ...t,
      steps: Array(totalSteps).fill(0).map((_, j) => srcSteps[j] ?? 0),
      probabilities: Array(totalSteps).fill(1.0).map((_, j) => srcProbs[j] ?? 1.0),
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
              probabilities: t.steps[step] > 0
                ? t.probabilities.map((p, i) => (i === step ? 1.0 : p))
                : t.probabilities,
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

  setStepProbability: (trackId, step, probability) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, probabilities: t.probabilities.map((p, i) => (i === step ? probability : p)) }
          : t
      ),
    }));
  },

  clearTrack: (trackId) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              steps: t.steps.map(() => 0),
              notes: t.notes.map(() => ""),
              probabilities: t.probabilities.map(() => 1.0),
            }
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
        probabilities: t.probabilities.map(() => 1.0),
      })),
    }));
  },

  setTotalSteps: (totalSteps) => {
    pushHistory();
    set((state) => ({
      totalSteps,
      tracks: state.tracks.map((t) => ({
        ...t,
        steps: Array(totalSteps).fill(0).map((_, i) => t.steps[i] ?? 0),
        notes: Array(totalSteps).fill("").map((_, i) => t.notes[i] ?? ""),
        probabilities: Array(totalSteps).fill(1.0).map((_, i) => t.probabilities[i] ?? 1.0),
      })),
      patterns: state.patterns.map((p) => ({
        ...p,
        steps: p.steps.map((trackSteps) =>
          Array(totalSteps).fill(0).map((_, i) => trackSteps[i] ?? 0)
        ),
        probabilities: p.probabilities.map((trackProbs) =>
          Array(totalSteps).fill(1.0).map((_, i) => trackProbs[i] ?? 1.0)
        ),
      })),
    }));
  },

  setPianoRollTrack: (trackId) => set({ pianoRollTrack: trackId }),

  pianoRollToggleNote: (trackId, step, note) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const currentVelocity = t.steps[step];
        const currentNote = t.notes[step];

        if (currentVelocity > 0 && currentNote === note) {
          return {
            ...t,
            steps: t.steps.map((s, i) => (i === step ? 0 : s)),
            notes: t.notes.map((n, i) => (i === step ? "" : n)),
            probabilities: t.probabilities.map((p, i) => (i === step ? 1.0 : p)),
          };
        }

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

      const snapshot = snapshotPattern(state.tracks);
      const updatedPatterns = state.patterns.map((p, i) =>
        i === state.currentPattern
          ? { ...p, steps: snapshot.steps, probabilities: snapshot.probabilities }
          : p
      );

      const target = updatedPatterns[index];
      return {
        patterns: updatedPatterns,
        currentPattern: index,
        tracks: applyPatternToTracks(state.tracks, target, state.totalSteps),
      };
    });
  },

  copyPattern: (from, to) => {
    pushHistory();
    set((state) => {
      if (from === to || from < 0 || to < 0 || from >= MAX_PATTERNS || to >= MAX_PATTERNS) return state;

      const source =
        from === state.currentPattern
          ? snapshotPattern(state.tracks)
          : {
              steps: state.patterns[from].steps.map((s) => [...s]),
              probabilities: state.patterns[from].probabilities.map((probs) => [...probs]),
            };

      const updatedPatterns = state.patterns.map((p, i) =>
        i === to ? { ...p, steps: source.steps, probabilities: source.probabilities } : p
      );

      if (to === state.currentPattern) {
        return {
          patterns: updatedPatterns,
          tracks: applyPatternToTracks(state.tracks, source, state.totalSteps),
        };
      }

      return { patterns: updatedPatterns };
    });
  },

  clearPattern: (index) => {
    pushHistory();
    set((state) => {
      const empty = {
        steps: Array.from({ length: state.tracks.length }, () => Array(state.totalSteps).fill(0)),
        probabilities: Array.from({ length: state.tracks.length }, () => Array(state.totalSteps).fill(1.0)),
      };

      const updatedPatterns = state.patterns.map((p, i) =>
        i === index ? { ...p, ...empty } : p
      );

      if (index === state.currentPattern) {
        return {
          patterns: updatedPatterns,
          tracks: state.tracks.map((t) => ({
            ...t,
            steps: t.steps.map(() => 0),
            probabilities: t.probabilities.map(() => 1.0),
          })),
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

      const presetSteps = Array.from({ length: trackCount }, (_, trackIdx) => {
        const src = preset.tracks[trackIdx] ?? [];
        return Array(totalSteps).fill(0).map((_, stepIdx) => src[stepIdx] ?? 0);
      });

      const defaultProbs = Array.from({ length: trackCount }, () =>
        Array(totalSteps).fill(1.0)
      );

      const updatedPatterns = state.patterns.map((p, i) =>
        i === state.currentPattern
          ? { ...p, steps: presetSteps, probabilities: defaultProbs }
          : p
      );

      return {
        bpm: preset.bpm,
        swing: preset.swing,
        totalSteps,
        patterns: updatedPatterns.map((p) => ({
          ...p,
          steps: p.steps.map((trackSteps) =>
            Array(totalSteps).fill(0).map((_, i) => trackSteps[i] ?? 0)
          ),
          probabilities: p.probabilities.map((trackProbs) =>
            Array(totalSteps).fill(1.0).map((_, i) => trackProbs[i] ?? 1.0)
          ),
        })),
        tracks: state.tracks.map((t, i) => ({
          ...t,
          steps: presetSteps[i] ?? Array(totalSteps).fill(0),
          probabilities: defaultProbs[i] ?? Array(totalSteps).fill(1.0),
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
      pushHistory();
      set((state) => ({
        bpm: data.bpm,
        swing: data.swing,
        totalSteps: data.totalSteps,
        playbackState: "stopped",
        currentStep: -1,
        currentPattern: data.currentPattern ?? 0,
        tracks: state.tracks.map((t, i) => ({
          ...t,
          steps: data.tracks[i]?.steps ?? t.steps,
          notes: data.tracks[i]?.notes ?? t.notes.map(() => ""),
          probabilities: data.tracks[i]?.probabilities ?? t.probabilities.map(() => 1.0),
          volume: data.tracks[i]?.volume ?? t.volume,
          pan: data.tracks[i]?.pan ?? t.pan,
          muted: data.tracks[i]?.muted ?? t.muted,
          solo: data.tracks[i]?.solo ?? t.solo,
          effects: data.tracks[i]?.effects ?? t.effects,
        })),
        patterns: data.patterns
          ? data.patterns.map((p, i) => ({
              name: p.name,
              steps: p.steps,
              probabilities: p.probabilities ?? state.patterns[i]?.probabilities ??
                Array.from({ length: state.tracks.length }, () => Array(data.totalSteps).fill(1.0)),
            }))
          : state.patterns,
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
