"use client";

import { useEffect, useCallback } from "react";
import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { Mixer } from "@/components/Mixer";
import { useAudioEngine } from "@/lib/useAudioEngine";
import { useEngineStore } from "@/store/engine";

export default function DAW() {
  const { initAudio } = useAudioEngine();

  // Load saved pattern on mount
  useEffect(() => {
    useEngineStore.getState().loadPattern();
  }, []);

  // Auto-save on every state change (debounced by nature of subscribe)
  useEffect(() => {
    const unsub = useEngineStore.subscribe(() => {
      useEngineStore.getState().savePattern();
    });
    return unsub;
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const state = useEngineStore.getState();

      switch (e.code) {
        case "Space": {
          e.preventDefault();
          await initAudio();
          if (state.playbackState === "playing") {
            state.pause();
          } else {
            state.play();
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          state.stop();
          break;
        }
        // 1-8 toggle mute on tracks
        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5":
        case "Digit6":
        case "Digit7":
        case "Digit8": {
          const trackIdx = parseInt(e.code.replace("Digit", "")) - 1;
          state.toggleMute(trackIdx);
          break;
        }
      }
    },
    [initAudio]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top: Transport Bar */}
      <Transport onInit={initAudio} />

      {/* Middle: Step Sequencer */}
      <StepSequencer />

      {/* Bottom: Mixer */}
      <Mixer />
    </div>
  );
}
