import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type { Track, TransportState, TimeSignature, Clip } from "@/types";

const TRACK_COLORS = [
  "#6c5ce7", "#00b894", "#e17055", "#0984e3",
  "#fdcb6e", "#e84393", "#00cec9", "#d63031",
  "#a29bfe", "#55efc4", "#fab1a0", "#74b9ff",
];

interface DAWState {
  // Transport
  transportState: TransportState;
  bpm: number;
  currentBeat: number;
  timeSignature: TimeSignature;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;

  // Tracks
  tracks: Track[];
  selectedTrackId: string | null;

  // View
  zoomLevel: number;
  scrollPosition: number;
  viewMode: "arrange" | "mixer";

  // Transport actions
  play: () => void;
  stop: () => void;
  record: () => void;
  setBpm: (bpm: number) => void;
  setCurrentBeat: (beat: number) => void;
  toggleLoop: () => void;
  setLoopRegion: (start: number, end: number) => void;

  // Track actions
  addTrack: (name?: string) => void;
  removeTrack: (id: string) => void;
  selectTrack: (id: string | null) => void;
  setTrackVolume: (id: string, volume: number) => void;
  setTrackPan: (id: string, pan: number) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  toggleArm: (id: string) => void;
  renameTrack: (id: string, name: string) => void;

  // Clip actions
  addClip: (trackId: string, startBeat: number, durationBeats: number) => void;
  removeClip: (trackId: string, clipId: string) => void;

  // View actions
  setZoomLevel: (zoom: number) => void;
  setScrollPosition: (pos: number) => void;
  setViewMode: (mode: "arrange" | "mixer") => void;
}

export const useDAWStore = create<DAWState>((set, get) => ({
  transportState: "stopped",
  bpm: 120,
  currentBeat: 0,
  timeSignature: { numerator: 4, denominator: 4 },
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 16,
  tracks: [],
  selectedTrackId: null,
  zoomLevel: 1,
  scrollPosition: 0,
  viewMode: "arrange",

  play: () => set({ transportState: "playing" }),
  stop: () => set({ transportState: "stopped", currentBeat: 0 }),
  record: () => set({ transportState: "recording" }),
  setBpm: (bpm) => set({ bpm: Math.max(20, Math.min(300, bpm)) }),
  setCurrentBeat: (beat) => set({ currentBeat: beat }),
  toggleLoop: () => set((s) => ({ loopEnabled: !s.loopEnabled })),
  setLoopRegion: (start, end) => set({ loopStart: start, loopEnd: end }),

  addTrack: (name?: string) => {
    const tracks = get().tracks;
    const color = TRACK_COLORS[tracks.length % TRACK_COLORS.length];
    const newTrack: Track = {
      id: uuid(),
      name: name || `Track ${tracks.length + 1}`,
      color,
      volume: 0.75,
      pan: 0,
      muted: false,
      soloed: false,
      armed: false,
      clips: [],
      instrumentType: "synth",
    };
    set({ tracks: [...tracks, newTrack], selectedTrackId: newTrack.id });
  },

  removeTrack: (id) =>
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      selectedTrackId: s.selectedTrackId === id ? null : s.selectedTrackId,
    })),

  selectTrack: (id) => set({ selectedTrackId: id }),

  setTrackVolume: (id, volume) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, volume: Math.max(0, Math.min(1, volume)) } : t
      ),
    })),

  setTrackPan: (id, pan) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, pan: Math.max(-1, Math.min(1, pan)) } : t
      ),
    })),

  toggleMute: (id) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, muted: !t.muted } : t
      ),
    })),

  toggleSolo: (id) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, soloed: !t.soloed } : t
      ),
    })),

  toggleArm: (id) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, armed: !t.armed } : t
      ),
    })),

  renameTrack: (id, name) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, name } : t)),
    })),

  addClip: (trackId, startBeat, durationBeats) => {
    const clip: Clip = {
      id: uuid(),
      trackId,
      startBeat,
      durationBeats,
      color: get().tracks.find((t) => t.id === trackId)?.color || "#6c5ce7",
      name: "New Clip",
      notes: [],
    };
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
      ),
    }));
  },

  removeClip: (trackId, clipId) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
          : t
      ),
    })),

  setZoomLevel: (zoom) =>
    set({ zoomLevel: Math.max(0.25, Math.min(4, zoom)) }),
  setScrollPosition: (pos) => set({ scrollPosition: Math.max(0, pos) }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
