"use client";

import { useEffect } from "react";
import { useEngineStore } from "@/store/engine";

export function useKeyboardShortcuts(initAudio: () => Promise<void>) {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.code) {
        case "Space": {
          e.preventDefault();
          await initAudio();
          const { playbackState, play, pause } = useEngineStore.getState();
          if (playbackState === "playing") pause();
          else play();
          break;
        }
        case "Escape": {
          const { pianoRollTrack, setPianoRollTrack, stop } = useEngineStore.getState();
          if (pianoRollTrack !== null) {
            setPianoRollTrack(null);
          } else {
            await initAudio();
            stop();
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [initAudio]);
}
