import { create } from "zustand";
import { useEngineStore, type Track } from "./engine";
import { DEFAULT_KIT } from "@/lib/sounds";

// ── Types ──────────────────────────────────────────────────────
export interface SavedPattern {
  id: string;
  name: string;
  bpm: number;
  swing: number;
  totalSteps: number;
  // Store only the step data + volume/mute/solo per track (sounds come from kit)
  trackData: {
    steps: boolean[];
    volume: number;
    muted: boolean;
    solo: boolean;
  }[];
  createdAt: number;
  updatedAt: number;
}

interface PatternState {
  patterns: SavedPattern[];
  activePatternId: string | null;

  savePattern: (name: string) => void;
  overwritePattern: (id: string) => void;
  loadPattern: (id: string) => void;
  deletePattern: (id: string) => void;
  renamePattern: (id: string, name: string) => void;
  _persist: () => void;
  _hydrate: () => void;
}

const STORAGE_KEY = "sts-patterns";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function captureFromEngine(): Omit<SavedPattern, "id" | "name" | "createdAt" | "updatedAt"> {
  const { tracks, bpm, swing, totalSteps } = useEngineStore.getState();
  return {
    bpm,
    swing,
    totalSteps,
    trackData: tracks.map((t) => ({
      steps: [...t.steps],
      volume: t.volume,
      muted: t.muted,
      solo: t.solo,
    })),
  };
}

function patternToTracks(pattern: SavedPattern): Track[] {
  return DEFAULT_KIT.map((sound, i) => ({
    id: i,
    sound,
    steps: pattern.trackData[i]?.steps ?? Array(pattern.totalSteps).fill(false),
    volume: pattern.trackData[i]?.volume ?? 0.75,
    muted: pattern.trackData[i]?.muted ?? false,
    solo: pattern.trackData[i]?.solo ?? false,
  }));
}

// ── Store ──────────────────────────────────────────────────────
export const usePatternStore = create<PatternState>()((set, get) => ({
  patterns: [],
  activePatternId: null,

  savePattern: (name) => {
    const now = Date.now();
    const pattern: SavedPattern = {
      id: generateId(),
      name,
      ...captureFromEngine(),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      patterns: [...state.patterns, pattern],
      activePatternId: pattern.id,
    }));
    get()._persist();
  },

  overwritePattern: (id) => {
    const now = Date.now();
    const captured = captureFromEngine();
    set((state) => ({
      patterns: state.patterns.map((p) =>
        p.id === id ? { ...p, ...captured, updatedAt: now } : p
      ),
    }));
    get()._persist();
  },

  loadPattern: (id) => {
    const pattern = get().patterns.find((p) => p.id === id);
    if (!pattern) return;
    const tracks = patternToTracks(pattern);
    useEngineStore.getState().loadPattern({
      tracks,
      bpm: pattern.bpm,
      swing: pattern.swing,
      totalSteps: pattern.totalSteps,
    });
    set({ activePatternId: id });
  },

  deletePattern: (id) => {
    set((state) => ({
      patterns: state.patterns.filter((p) => p.id !== id),
      activePatternId: state.activePatternId === id ? null : state.activePatternId,
    }));
    get()._persist();
  },

  renamePattern: (id, name) => {
    set((state) => ({
      patterns: state.patterns.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p
      ),
    }));
    get()._persist();
  },

  _persist: () => {
    try {
      const { patterns, activePatternId } = get();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ patterns, activePatternId })
      );
    } catch {
      // localStorage full or unavailable — silent fail
    }
  },

  _hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.patterns && Array.isArray(data.patterns)) {
        set({
          patterns: data.patterns,
          activePatternId: data.activePatternId ?? null,
        });
      }
    } catch {
      // corrupted data — start fresh
    }
  },
}));
