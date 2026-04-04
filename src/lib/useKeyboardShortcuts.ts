"use client";

import { useEffect } from "react";
import { useEngineStore, MAX_PATTERNS } from "@/store/engine";

export function useKeyboardShortcuts(onInit: () => Promise<void>) {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const state = useEngineStore.getState();

      switch (e.code) {
        // Space: Play/Pause
        case "Space": {
          e.preventDefault();
          await onInit();
          if (state.playbackState === "playing") {
            state.pause();
          } else {
            state.play();
          }
          break;
        }

        // Escape: Close piano roll first, then stop
        case "Escape": {
          if (state.pianoRollTrack !== null) {
            state.setPianoRollTrack(null);
          } else {
            state.stop();
          }
          break;
        }

        // 1-8: Switch patterns
        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5":
        case "Digit6":
        case "Digit7":
        case "Digit8": {
          if (e.metaKey || e.ctrlKey || e.altKey) break;
          const idx = parseInt(e.code.replace("Digit", "")) - 1;
          if (idx >= 0 && idx < MAX_PATTERNS) {
            state.setCurrentPattern(idx);
          }
          break;
        }

        // Left/Right arrows: Navigate patterns
        case "ArrowLeft": {
          if (e.metaKey || e.ctrlKey) break;
          e.preventDefault();
          const prev = Math.max(0, state.currentPattern - 1);
          state.setCurrentPattern(prev);
          break;
        }
        case "ArrowRight": {
          if (e.metaKey || e.ctrlKey) break;
          e.preventDefault();
          const next = Math.min(MAX_PATTERNS - 1, state.currentPattern + 1);
          state.setCurrentPattern(next);
          break;
        }

        // Up/Down arrows: BPM ±1 (shift: ±10)
        case "ArrowUp": {
          e.preventDefault();
          state.setBpm(state.bpm + (e.shiftKey ? 10 : 1));
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          state.setBpm(state.bpm - (e.shiftKey ? 10 : 1));
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onInit]);
}
