import { create } from "zustand";

export type AccentTheme = "violet" | "warm" | "cobalt" | "lime";

const THEME_LABELS: Record<AccentTheme, string> = {
  violet: "Violet",
  warm:   "Warm",
  cobalt: "Cobalt",
  lime:   "Lime",
};

export { THEME_LABELS };

interface UiState {
  helpOpen: boolean;
  setHelpOpen: (on: boolean) => void;
  toggleHelp: () => void;

  generatorOpen: boolean;
  setGeneratorOpen: (on: boolean) => void;
  toggleGenerator: () => void;

  accentTheme: AccentTheme;
  setAccentTheme: (t: AccentTheme) => void;
  cycleTheme: () => void;
}

const THEME_ORDER: AccentTheme[] = ["violet", "warm", "cobalt", "lime"];

export const useUiStore = create<UiState>((set) => ({
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

  generatorOpen: false,
  setGeneratorOpen: (generatorOpen) => set({ generatorOpen }),
  toggleGenerator: () => set((s) => ({ generatorOpen: !s.generatorOpen })),

  accentTheme: "violet",
  setAccentTheme: (accentTheme) => set({ accentTheme }),
  cycleTheme: () =>
    set((s) => {
      const idx = THEME_ORDER.indexOf(s.accentTheme);
      return { accentTheme: THEME_ORDER[(idx + 1) % THEME_ORDER.length] };
    }),
}));
