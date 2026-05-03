"use client";

import { useEffect } from "react";
import { useEngineStore, MAX_PATTERNS } from "@/store/engine";
import { useHistoryStore } from "@/store/history";
import { useUiStore } from "@/store/ui";

// Top-row keys map left-to-right onto the 8 tracks. Producers can jam over
// patterns the same way you'd play an MPC pad row.
const PERFORMANCE_KEYS: Record<string, number> = {
  KeyQ: 0,
  KeyW: 1,
  KeyE: 2,
  KeyR: 3,
  KeyT: 4,
  KeyY: 5,
  KeyU: 6,
  KeyI: 7,
};

export function useKeyboardShortcuts(
  onInit: () => Promise<void>,
  triggerTrack: (index: number, velocity?: number) => void,
) {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Command palette: Cmd/Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyK") {
        e.preventDefault();
        useUiStore.getState().togglePalette();
        return;
      }

      // Help overlay: ? toggles. Match by key not code so it works on
      // any layout (US: shift+/, intl layouts vary).
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        useUiStore.getState().toggleHelp();
        return;
      }

      // Undo: Cmd/Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
        return;
      }
      // Redo: Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y
      if ((e.metaKey || e.ctrlKey) && ((e.code === "KeyZ" && e.shiftKey) || e.code === "KeyY")) {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      const state = useEngineStore.getState();

      // Performance keys (Q W E R T Y U I) — fire tracks 1..8.
      // Block when a key is held so trills are explicit re-presses.
      if (
        !e.repeat &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.code in PERFORMANCE_KEYS
      ) {
        e.preventDefault();
        await onInit();
        triggerTrack(PERFORMANCE_KEYS[e.code], 1.0);
        return;
      }

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

        // H: Humanize all tracks (skip if a modifier is held)
        case "KeyH": {
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) break;
          e.preventDefault();
          state.humanize(null, 0.15);
          break;
        }

        // G: Open AI generator
        case "KeyG": {
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) break;
          e.preventDefault();
          useUiStore.getState().setGeneratorOpen(true);
          break;
        }

        // F: Toggle Fill Engine panel (focus sidebar fill tab via custom event)
        case "KeyF": {
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) break;
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("sts-focus-tab", { detail: "fill" }));
          break;
        }

        // Escape: Close help → close piano roll → stop
        case "Escape": {
          if (useUiStore.getState().helpOpen) {
            useUiStore.getState().setHelpOpen(false);
          } else if (state.pianoRollTrack !== null) {
            state.setPianoRollTrack(null);
          } else {
            state.stop();
          }
          break;
        }

        // 1-8: Switch patterns / Shift+1-8: Trigger scenes in performance mode
        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5":
        case "Digit6":
        case "Digit7":
        case "Digit8": {
          if (e.metaKey || e.ctrlKey || e.altKey) break;
          const digitIdx = parseInt(e.code.replace("Digit", "")) - 1;
          if (e.shiftKey && state.performanceMode) {
            // Shift+1-8: toggle scene by index in performance mode
            const scene = state.scenes[digitIdx];
            if (scene) {
              e.preventDefault();
              if (state.activeScenes.has(scene.id)) {
                state.stopScene(scene.id);
              } else {
                state.triggerScene(scene.id);
              }
            }
          } else if (!e.shiftKey) {
            // Plain 1-8: switch pattern
            if (digitIdx >= 0 && digitIdx < MAX_PATTERNS) {
              state.setCurrentPattern(digitIdx);
            }
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

        // L: Toggle scale lock
        case "KeyL": {
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) break;
          e.preventDefault();
          state.setScaleLock(!state.scaleLock);
          break;
        }

      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onInit, triggerTrack]);
}
