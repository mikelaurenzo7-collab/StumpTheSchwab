import { create } from "zustand";

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
}

export const useUiStore = create<UiState>((set) => ({
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

  generatorOpen: false,
  setGeneratorOpen: (generatorOpen) => set({ generatorOpen }),
  toggleGenerator: () => set((s) => ({ generatorOpen: !s.generatorOpen })),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
}));
