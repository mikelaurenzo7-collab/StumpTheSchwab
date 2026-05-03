import { create } from "zustand";

// ── MIDI CC learn types ──────────────────────────────────────────────────────
// A single CC→parameter binding. The value (0..127) is mapped linearly onto
// [min..max] and applied to the target via the same path strings used by
// the automation engine (e.g. "track.0.volume", "master.volume", "bpm").
export interface MidiCCBinding {
  cc: number;      // 0..127 MIDI CC number
  target: string;  // parameter path
  label: string;   // human-readable name shown in the table
  min: number;
  max: number;
}

interface UiState {
  helpOpen: boolean;
  setHelpOpen: (on: boolean) => void;
  toggleHelp: () => void;

  generatorOpen: boolean;
  setGeneratorOpen: (on: boolean) => void;
  toggleGenerator: () => void;

  paletteOpen: boolean;
  setPaletteOpen: (on: boolean) => void;
  togglePalette: () => void;

  midiOpen: boolean;
  setMidiOpen: (on: boolean) => void;
  toggleMidi: () => void;

  // MIDI CC learn
  midiCCMap: Record<number, MidiCCBinding>;
  midiLearnTarget: { target: string; label: string; min: number; max: number } | null;
  startMidiLearn: (target: string, label: string, min: number, max: number) => void;
  cancelMidiLearn: () => void;
  commitMidiLearn: (cc: number) => void;
  removeMidiBinding: (cc: number) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

  generatorOpen: false,
  setGeneratorOpen: (generatorOpen) => set({ generatorOpen }),
  toggleGenerator: () => set((s) => ({ generatorOpen: !s.generatorOpen })),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  midiOpen: false,
  setMidiOpen: (midiOpen) => set({ midiOpen }),
  toggleMidi: () => set((s) => ({ midiOpen: !s.midiOpen })),

  // MIDI CC learn
  midiCCMap: {},
  midiLearnTarget: null,

  startMidiLearn: (target, label, min, max) =>
    set({ midiLearnTarget: { target, label, min, max } }),

  cancelMidiLearn: () => set({ midiLearnTarget: null }),

  commitMidiLearn: (cc) => {
    const lt = get().midiLearnTarget;
    if (!lt) return;
    set((s) => ({
      midiCCMap: {
        ...s.midiCCMap,
        [cc]: { cc, target: lt.target, label: lt.label, min: lt.min, max: lt.max },
      },
      midiLearnTarget: null,
    }));
  },

  removeMidiBinding: (cc) =>
    set((s) => {
      const next = { ...s.midiCCMap };
      delete next[cc];
      return { midiCCMap: next };
    }),
}));
