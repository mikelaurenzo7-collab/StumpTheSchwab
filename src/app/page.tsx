"use client";

import { useEffect, useCallback } from "react";
import { useAudioEngine } from "../lib/useAudioEngine";
import { useEngine } from "../store/engine";
import Transport from "../components/Transport";
import StepSequencer from "../components/StepSequencer";
import MacroPanel from "../components/MacroPanel";

export default function Home() {
  const { play, stop, exportWav } = useAudioEngine();

  const handleKeyboard = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          play();
          break;
        case "Escape":
          stop();
          break;
        case "r":
          useEngine.getState().regenerate();
          break;
        case "m":
          useEngine.getState().mutate();
          break;
        case "e":
          exportWav();
          break;
        case "g": {
          const prompt = useEngine.getState().generatePrompt.trim();
          if (prompt && !useEngine.getState().generating) {
            document.querySelector<HTMLButtonElement>(".generate-btn")?.click();
          }
          break;
        }
        case "z":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (e.shiftKey) useEngine.getState().redo();
            else useEngine.getState().undo();
          }
          break;
      }
    },
    [play, stop, exportWav],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [handleKeyboard]);

  return (
    <main className="studio-shell">
      <Transport onPlay={play} onStop={stop} onExport={exportWav} />
      <section className="studio-grid">
        <StepSequencer />
        <MacroPanel />
      </section>
    </main>
  );
}
