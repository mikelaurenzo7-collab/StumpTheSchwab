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
  driveOn: boolean;
  driveAmount: number;
  delayOn: boolean;
  delayTime: number;
  delayFeedback: number;
  delayWet: number;
  reverbOn: boolean;
  reverbDecay: number;
  reverbWet: number;
  // Sidechain ducking — Tone.js has no native sidechain input on its compressor,
  // so we model the classic kick→bass pump as scheduled gain automation:
  // whenever the source track fires a step, the target's duck gain dips to
  // (1 - depth) and recovers linearly over `release` seconds.
  sidechainOn: boolean;
  sidechainSource: number | null;
  sidechainDepth: number;
  sidechainRelease: number;
  // Tempo-synced auto-pan LFO. The LFO's output is summed with the manual
  // pan value (which acts as the center), so left/right movement happens
  // around wherever the user has the strip parked.
  panLfoOn: boolean;
  panLfoRate: LfoRate;
  panLfoDepth: number; // 0..1 (full sweep = 1)
  panLfoShape: LfoShape;
}

export type LfoRate = "1n" | "2n" | "4n" | "8n" | "16n" | "32n";
export type LfoShape = "sine" | "triangle" | "square" | "sawtooth";
export const LFO_RATES: readonly LfoRate[] = ["1n", "2n", "4n", "8n", "16n", "32n"];
export const LFO_SHAPES: readonly LfoShape[] = ["sine", "triangle", "square", "sawtooth"];

export interface MasterBus {
  volume: number;
  compressorOn: boolean;
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  limiterOn: boolean;
  limiterThreshold: number;
  eqOn: boolean;
  eqLow: number;   // dB, -24..+24
  eqMid: number;   // dB
  eqHigh: number;  // dB
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
  customSampleUrl: string | null;
  customSampleName: string | null;
  // Note length as fraction of one step. 1.0 = full step (legato bass/pads),
  // 0.5 = half step (normal hits), 0.1 = staccato. Percussive synths decay
  // quickly regardless, but this is essential for tight bass and held pads.
  noteLength: number;
  // Per-step micro-timing offset. -0.5 = half a step early (ahead of beat),
  // +0.5 = half a step late (behind the beat). This is the secret to groove —
  // slightly pushing or pulling individual hits creates human-feeling rhythms.
  nudge: number[];
}

export interface Pattern {
  name: string;
  steps: number[][];
  notes: string[][];
  probabilities: number[][];
  nudge: number[][];
}

export const PATTERN_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const MAX_PATTERNS = PATTERN_LABELS.length;

// ── AI beat generation types ─────────────────────────────────
// Track keys here match the order of DEFAULT_KIT in src/lib/sounds.ts.
export type GeneratedTrackKey =
  | "kick"
  | "snare"
  | "hihat"
  | "openhat"
  | "clap"
  | "tom"
  | "perc"
  | "bass";

export const GENERATED_TRACK_KEYS: readonly GeneratedTrackKey[] = [
  "kick",
  "snare",
  "hihat",
  "openhat",
  "clap",
  "tom",
  "perc",
  "bass",
] as const;

export interface GeneratedBeat {
  name: string;
  bpm: number;
  swing: number;
  totalSteps: 16 | 32;
  tracks: Record<GeneratedTrackKey, number[]>;
  melodicNotes: Record<"tom" | "perc" | "bass", string[]>;
  explanation: string;
}

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

  chain: number[];
  songMode: boolean;
  chainPosition: number;
  trackClipboard: { steps: number[]; notes: string[]; probabilities: number[]; nudge: number[] } | null;

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

  setSongMode: (on: boolean) => void;
  addToChain: (patternIndex: number) => void;
  removeFromChain: (position: number) => void;
  clearChain: () => void;
  setChainPosition: (pos: number) => void;
  switchPatternSilent: (index: number) => void;
  moveChainItem: (from: number, to: number) => void;
  renamePattern: (index: number, name: string) => void;
  euclideanFill: (trackId: number, hits: number, rotation: number) => void;
  applyGeneratedBeat: (beat: GeneratedBeat) => void;

  copyTrackSteps: (trackId: number) => void;
  pasteTrackSteps: (trackId: number) => void;

  humanize: (trackId: number | null, amount: number) => void;

  loadSample: (trackId: number, url: string, name: string) => void;
  clearSample: (trackId: number) => void;

  setNoteLength: (trackId: number, length: number) => void;
  setStepNudge: (trackId: number, step: number, nudge: number) => void;

  saveSession: (name: string) => void;
  loadSession: (name: string) => boolean;
  deleteSession: (name: string) => void;
  getSavedSessions: () => string[];
}

// ── Helpers ────────────────────────────────────────────────────
const INITIAL_STEPS = 16;

/**
 * Generate an evenly-distributed (euclidean) rhythm.
 * Uses Bresenham-style accumulation primed so step 0 always lands on a hit
 * (when hits > 0) — this matches the canonical Bjorklund patterns producers
 * recognize: tresillo E(3,8), cinquillo E(5,8), 4-on-floor E(4,16), etc.
 * Rotation shifts the result to the right.
 */
export function euclideanPattern(
  hits: number,
  steps: number,
  rotation: number = 0
): boolean[] {
  if (steps <= 0) return [];
  const h = Math.max(0, Math.min(steps, Math.floor(hits)));
  if (h === 0) return Array(steps).fill(false);
  if (h === steps) return Array(steps).fill(true);

  const pattern: boolean[] = Array(steps).fill(false);
  // Prime accumulator so the first overflow lands on step 0
  let acc = steps - h;
  for (let i = 0; i < steps; i++) {
    acc += h;
    if (acc >= steps) {
      acc -= steps;
      pattern[i] = true;
    }
  }
  if (rotation === 0) return pattern;
  const r = ((rotation % steps) + steps) % steps;
  return [...pattern.slice(steps - r), ...pattern.slice(0, steps - r)];
}

export const DEFAULT_EFFECTS: TrackEffects = {
  filterOn: false,
  filterType: "lowpass",
  filterFreq: 20000,
  filterQ: 1,
  driveOn: false,
  driveAmount: 0.3,
  delayOn: false,
  delayTime: 0.25,
  delayFeedback: 0.3,
  delayWet: 0.3,
  reverbOn: false,
  reverbDecay: 1.5,
  reverbWet: 0.2,
  sidechainOn: false,
  sidechainSource: null,
  sidechainDepth: 0.7,
  sidechainRelease: 0.18,
  panLfoOn: false,
  panLfoRate: "4n",
  panLfoDepth: 0.5,
  panLfoShape: "sine",
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
  eqOn: false,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
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
    customSampleUrl: null,
    customSampleName: null,
    noteLength: 1.0,
    nudge: Array(totalSteps).fill(0),
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
    customSampleUrl?: string | null;
    customSampleName?: string | null;
    noteLength?: number;
    nudge?: number[];
  }[];
  patterns?: { name: string; steps: number[][]; notes?: string[][]; probabilities?: number[][]; nudge?: number[][] }[];
  currentPattern?: number;
  chain?: number[];
  songMode?: boolean;
  master: MasterBus;
}

function serializeSession(state: EngineState): SessionData {
  const currentSnapshot = snapshotPattern(state.tracks);
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
      customSampleUrl: t.customSampleUrl,
      customSampleName: t.customSampleName,
      noteLength: t.noteLength,
      nudge: t.nudge,
    })),
    patterns: state.patterns.map((p, i) => ({
      name: p.name,
      steps: i === state.currentPattern ? currentSnapshot.steps : p.steps,
      notes: i === state.currentPattern ? currentSnapshot.notes : p.notes,
      probabilities: i === state.currentPattern ? currentSnapshot.probabilities : p.probabilities,
      nudge: i === state.currentPattern ? currentSnapshot.nudge : p.nudge,
    })),
    chain: state.chain,
    songMode: state.songMode,
    master: state.master,
  };
}

// ── Pattern helpers ───────────────────────────────────────────
function createEmptyPattern(name: string, trackCount: number, totalSteps: number): Pattern {
  return {
    name,
    steps: Array.from({ length: trackCount }, () => Array(totalSteps).fill(0)),
    notes: Array.from({ length: trackCount }, () => Array(totalSteps).fill("")),
    probabilities: Array.from({ length: trackCount }, () => Array(totalSteps).fill(1.0)),
    nudge: Array.from({ length: trackCount }, () => Array(totalSteps).fill(0)),
  };
}

function snapshotPattern(tracks: Track[]): { steps: number[][]; notes: string[][]; probabilities: number[][]; nudge: number[][] } {
  return {
    steps: tracks.map((t) => [...t.steps]),
    notes: tracks.map((t) => [...t.notes]),
    probabilities: tracks.map((t) => [...t.probabilities]),
    nudge: tracks.map((t) => [...t.nudge]),
  };
}

function applyPatternToTracks(
  tracks: Track[],
  pattern: { steps: number[][]; notes?: string[][]; probabilities: number[][]; nudge?: number[][] },
  totalSteps: number
): Track[] {
  return tracks.map((t, i) => {
    const srcSteps = pattern.steps[i] ?? [];
    const srcNotes = pattern.notes?.[i] ?? [];
    const srcProbs = pattern.probabilities[i] ?? [];
    const srcNudge = pattern.nudge?.[i] ?? [];
    return {
      ...t,
      steps: Array(totalSteps).fill(0).map((_, j) => srcSteps[j] ?? 0),
      notes: Array(totalSteps).fill("").map((_, j) => srcNotes[j] ?? ""),
      probabilities: Array(totalSteps).fill(1.0).map((_, j) => srcProbs[j] ?? 1.0),
      nudge: Array(totalSteps).fill(0).map((_, j) => srcNudge[j] ?? 0),
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

  chain: [],
  songMode: false,
  chainPosition: 0,
  trackClipboard: null,

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
              nudge: t.steps[step] > 0
                ? t.nudge.map((n, i) => (i === step ? 0 : n))
                : t.nudge,
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
              nudge: t.nudge.map(() => 0),
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
        nudge: t.nudge.map(() => 0),
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
        nudge: Array(totalSteps).fill(0).map((_, i) => t.nudge[i] ?? 0),
      })),
      patterns: state.patterns.map((p) => ({
        ...p,
        steps: p.steps.map((trackSteps) =>
          Array(totalSteps).fill(0).map((_, i) => trackSteps[i] ?? 0)
        ),
        notes: p.notes.map((trackNotes) =>
          Array(totalSteps).fill("").map((_, i) => trackNotes[i] ?? "")
        ),
        probabilities: p.probabilities.map((trackProbs) =>
          Array(totalSteps).fill(1.0).map((_, i) => trackProbs[i] ?? 1.0)
        ),
        nudge: p.nudge.map((trackNudge) =>
          Array(totalSteps).fill(0).map((_, i) => trackNudge[i] ?? 0)
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
            nudge: t.nudge.map((n, i) => (i === step ? 0 : n)),
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
          ? { ...p, steps: snapshot.steps, notes: snapshot.notes, probabilities: snapshot.probabilities, nudge: snapshot.nudge }
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
              notes: state.patterns[from].notes.map((n) => [...n]),
              probabilities: state.patterns[from].probabilities.map((probs) => [...probs]),
              nudge: state.patterns[from].nudge.map((n) => [...n]),
            };

      const updatedPatterns = state.patterns.map((p, i) =>
        i === to
          ? { ...p, steps: source.steps, notes: source.notes, probabilities: source.probabilities, nudge: source.nudge }
          : p
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
        notes: Array.from({ length: state.tracks.length }, () => Array(state.totalSteps).fill("")),
        probabilities: Array.from({ length: state.tracks.length }, () => Array(state.totalSteps).fill(1.0)),
        nudge: Array.from({ length: state.tracks.length }, () => Array(state.totalSteps).fill(0)),
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
            notes: t.notes.map(() => ""),
            probabilities: t.probabilities.map(() => 1.0),
            nudge: t.nudge.map(() => 0),
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
      const defaultNotes = Array.from({ length: trackCount }, () =>
        Array(totalSteps).fill("")
      );
      const defaultNudge = Array.from({ length: trackCount }, () =>
        Array(totalSteps).fill(0)
      );

      const updatedPatterns = state.patterns.map((p, i) =>
        i === state.currentPattern
          ? { ...p, steps: presetSteps, notes: defaultNotes, probabilities: defaultProbs, nudge: defaultNudge }
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
          notes: p.notes.map((trackNotes) =>
            Array(totalSteps).fill("").map((_, i) => trackNotes[i] ?? "")
          ),
          probabilities: p.probabilities.map((trackProbs) =>
            Array(totalSteps).fill(1.0).map((_, i) => trackProbs[i] ?? 1.0)
          ),
          nudge: p.nudge.map((trackNudge) =>
            Array(totalSteps).fill(0).map((_, i) => trackNudge[i] ?? 0)
          ),
        })),
        tracks: state.tracks.map((t, i) => ({
          ...t,
          steps: presetSteps[i] ?? Array(totalSteps).fill(0),
          notes: defaultNotes[i] ?? Array(totalSteps).fill(""),
          probabilities: defaultProbs[i] ?? Array(totalSteps).fill(1.0),
          nudge: defaultNudge[i] ?? Array(totalSteps).fill(0),
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

  // ── Song mode / chain ────────────────────────────────────────
  setSongMode: (on) => {
    pushHistory();
    set({ songMode: on, chainPosition: 0 });
  },

  addToChain: (patternIndex) => {
    if (patternIndex < 0 || patternIndex >= MAX_PATTERNS) return;
    pushHistory();
    set((state) => ({ chain: [...state.chain, patternIndex] }));
  },

  removeFromChain: (position) => {
    pushHistory();
    set((state) => ({
      chain: state.chain.filter((_, i) => i !== position),
      chainPosition: Math.max(0, Math.min(state.chainPosition, state.chain.length - 2)),
    }));
  },

  clearChain: () => {
    pushHistory();
    set({ chain: [], chainPosition: 0 });
  },

  setChainPosition: (pos) => set({ chainPosition: pos }),

  moveChainItem: (from, to) => {
    pushHistory();
    set((state) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= state.chain.length ||
        to >= state.chain.length
      ) {
        return state;
      }
      const next = [...state.chain];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { chain: next };
    });
  },

  renamePattern: (index, name) => {
    if (index < 0 || index >= MAX_PATTERNS) return;
    pushHistory();
    set((state) => ({
      patterns: state.patterns.map((p, i) =>
        i === index ? { ...p, name: name.slice(0, 16) } : p
      ),
    }));
  },

  euclideanFill: (trackId, hits, rotation) => {
    pushHistory();
    set((state) => {
      const total = state.totalSteps;
      const pattern = euclideanPattern(hits, total, rotation);
      return {
        tracks: state.tracks.map((t) => {
          if (t.id !== trackId) return t;
          return {
            ...t,
            steps: t.steps.map((existing, i) =>
              pattern[i] ? (existing > 0 ? existing : 1.0) : 0
            ),
            notes: t.notes.map((n, i) => (pattern[i] ? n : "")),
            probabilities: t.probabilities.map((p, i) => (pattern[i] ? p : 1.0)),
          };
        }),
      };
    });
  },

  applyGeneratedBeat: (beat) => {
    pushHistory();
    set((state) => {
      const total = beat.totalSteps;
      const clampVel = (v: unknown): number => {
        const n = typeof v === "number" ? v : 0;
        return Math.max(0, Math.min(1, n));
      };
      const padArr = <T,>(src: T[] | undefined, length: number, fill: T): T[] =>
        Array.from({ length }, (_, i) => (src && src[i] !== undefined ? src[i] : fill));

      const newTracks = state.tracks.map((t, i) => {
        const key = GENERATED_TRACK_KEYS[i];
        if (!key) return t;
        const stepsRaw = beat.tracks[key];
        const stepsPadded = padArr(stepsRaw, total, 0).map(clampVel);
        const isMelodic = key === "tom" || key === "perc" || key === "bass";
        const notesRaw = isMelodic
          ? beat.melodicNotes[key as "tom" | "perc" | "bass"]
          : undefined;
        const notesPadded = padArr<string>(notesRaw, total, "").map((n) =>
          typeof n === "string" ? n : ""
        );
        return {
          ...t,
          steps: stepsPadded,
          notes: notesPadded,
          probabilities: Array(total).fill(1.0),
          nudge: Array(total).fill(0),
        };
      });

      // Mirror the new pattern data into the current pattern slot so pattern
      // switching / song mode pick it up. Also resize the OTHER patterns to
      // the new totalSteps so they don't play half-empty after a switch.
      const snapshot = {
        steps: newTracks.map((t) => [...t.steps]),
        notes: newTracks.map((t) => [...t.notes]),
        probabilities: newTracks.map((t) => [...t.probabilities]),
        nudge: newTracks.map((t) => [...t.nudge]),
      };
      const updatedPatterns = state.patterns.map((p, i) => {
        if (i === state.currentPattern) {
          return {
            ...p,
            name: (beat.name || PATTERN_LABELS[state.currentPattern]).slice(0, 16),
            steps: snapshot.steps,
            notes: snapshot.notes,
            probabilities: snapshot.probabilities,
            nudge: snapshot.nudge,
          };
        }
        // Other patterns: pad/truncate their pattern arrays to total.
        return {
          ...p,
          steps: p.steps.map((row) =>
            Array(total).fill(0).map((_, j) => row[j] ?? 0)
          ),
          notes: p.notes.map((row) =>
            Array(total).fill("").map((_, j) => row[j] ?? "")
          ),
          probabilities: p.probabilities.map((row) =>
            Array(total).fill(1.0).map((_, j) => row[j] ?? 1.0)
          ),
          nudge: p.nudge.map((row) =>
            Array(total).fill(0).map((_, j) => row[j] ?? 0)
          ),
        };
      });

      return {
        bpm: Math.max(30, Math.min(300, Math.round(beat.bpm))),
        swing: Math.max(0, Math.min(1, beat.swing)),
        totalSteps: total,
        tracks: newTracks,
        patterns: updatedPatterns,
      };
    });
  },

  switchPatternSilent: (index) => {
    set((state) => {
      if (index === state.currentPattern || index < 0 || index >= MAX_PATTERNS) return state;
      const snapshot = snapshotPattern(state.tracks);
      const updatedPatterns = state.patterns.map((p, i) =>
        i === state.currentPattern
          ? { ...p, steps: snapshot.steps, notes: snapshot.notes, probabilities: snapshot.probabilities, nudge: snapshot.nudge }
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

  // ── Sample loading ───────────────────────────────────────────
  loadSample: (trackId, url, name) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, customSampleUrl: url, customSampleName: name } : t
      ),
    }));
  },

  clearSample: (trackId) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, customSampleUrl: null, customSampleName: null } : t
      ),
    }));
  },

  setNoteLength: (trackId, length) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, noteLength: Math.max(0.05, Math.min(1, length)) } : t
      ),
    }));
  },

  setStepNudge: (trackId, step, nudge) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, nudge: t.nudge.map((n, i) => (i === step ? Math.max(-0.5, Math.min(0.5, nudge)) : n)) }
          : t
      ),
    }));
  },

  // ── Track clipboard ──────────────────────────────────────────
  copyTrackSteps: (trackId) => {
    const track = get().tracks[trackId];
    if (!track) return;
    set({
      trackClipboard: {
        steps: [...track.steps],
        notes: [...track.notes],
        probabilities: [...track.probabilities],
        nudge: [...track.nudge],
      },
    });
  },

  pasteTrackSteps: (trackId) => {
    const clip = get().trackClipboard;
    if (!clip) return;
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const total = state.totalSteps;
        return {
          ...t,
          steps: Array(total).fill(0).map((_, i) => clip.steps[i] ?? 0),
          notes: Array(total).fill("").map((_, i) => clip.notes[i] ?? ""),
          probabilities: Array(total).fill(1.0).map((_, i) => clip.probabilities[i] ?? 1.0),
          nudge: Array(total).fill(0).map((_, i) => clip.nudge[i] ?? 0),
        };
      }),
    }));
  },

  // ── Humanize ─────────────────────────────────────────────────
  humanize: (trackId, amount) => {
    pushHistory();
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (trackId !== null && t.id !== trackId) return t;
        return {
          ...t,
          steps: t.steps.map((v) => {
            if (v <= 0) return 0;
            const variation = (Math.random() - 0.5) * 2 * amount;
            return Math.max(0.1, Math.min(1.0, v + variation));
          }),
        };
      }),
    }));
  },

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
          // Merge defaults onto saved effects so older sessions pick up new
          // fields (sidechain) without errors.
          effects: { ...DEFAULT_EFFECTS, ...(data.tracks[i]?.effects ?? {}) },
          customSampleUrl: data.tracks[i]?.customSampleUrl ?? null,
          customSampleName: data.tracks[i]?.customSampleName ?? null,
          noteLength: data.tracks[i]?.noteLength ?? 1.0,
          nudge: data.tracks[i]?.nudge ?? Array(data.totalSteps).fill(0),
        })),
        patterns: data.patterns
          ? data.patterns.map((p, i) => ({
              name: p.name,
              steps: Array.from({ length: state.tracks.length }, (_, trackIdx) =>
                Array(data.totalSteps).fill(0).map((_, stepIdx) => p.steps[trackIdx]?.[stepIdx] ?? 0)
              ),
              notes: Array.from({ length: state.tracks.length }, (_, trackIdx) =>
                Array(data.totalSteps).fill("").map((_, stepIdx) => p.notes?.[trackIdx]?.[stepIdx] ?? "")
              ),
              probabilities: Array.from({ length: state.tracks.length }, (_, trackIdx) =>
                Array(data.totalSteps).fill(1.0).map((_, stepIdx) =>
                  p.probabilities?.[trackIdx]?.[stepIdx] ??
                  state.patterns[i]?.probabilities[trackIdx]?.[stepIdx] ??
                  1.0
                )
              ),
              nudge: Array.from({ length: state.tracks.length }, (_, trackIdx) =>
                Array(data.totalSteps).fill(0).map((_, stepIdx) => p.nudge?.[trackIdx]?.[stepIdx] ?? 0)
              ),
            }))
          : state.patterns,
        chain: data.chain ?? [],
        songMode: data.songMode ?? false,
        chainPosition: 0,
        // Merge default master onto the saved bus so older sessions pick up
        // EQ fields without crashing.
        master: { ...DEFAULT_MASTER, ...data.master },
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
