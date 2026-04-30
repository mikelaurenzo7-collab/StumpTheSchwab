"use client";

import { useCallback, useEffect } from "react";
import { useEngine } from "@/store/engine";
import { useAudioEngine } from "@/lib/useAudioEngine";
import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { Mixer } from "@/components/Mixer";
import { MacroPanel } from "@/components/MacroPanel";
import { AIGenerator } from "@/components/AIGenerator";
import { Visualizer } from "@/components/Visualizer";

export default function Home() {
  const togglePlay = useEngine((s) => s.togglePlay);
  const stopEngine = useEngine((s) => s.stop);
  const undo = useEngine((s) => s.undo);
  const redo = useEngine((s) => s.redo);
  const { play, pause, stop, exportWav } = useAudioEngine();

  const handlePlay = useCallback(async () => {
    togglePlay();
    await play();
  }, [togglePlay, play]);

  const handlePause = useCallback(() => {
    togglePlay();
    pause();
  }, [togglePlay, pause]);

  const handleStop = useCallback(() => {
    stopEngine();
    stop();
  }, [stopEngine, stop]);

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportWav();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stumptheschwab-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [exportWav]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        const playing = useEngine.getState().playing;
        if (playing) {
          handlePause();
        } else {
          handlePlay();
        }
        return;
      }

      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if ((e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === "y" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === "e" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleExport();
        return;
      }

      if (e.key === "Escape") {
        handleStop();
        return;
      }

      if (e.key >= "1" && e.key <= "4" && !e.metaKey && !e.ctrlKey) {
        useEngine.getState().selectPattern(Number(e.key) - 1);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlay, handlePause, handleStop, handleExport, undo, redo]);

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="brand">
          <div className="orbital-mark" aria-hidden="true"><span /></div>
          <div className="brand-text">
            <h1>StumpTheSchwab</h1>
            <p className="tagline">Future studio for beats, sound design & impossible textures</p>
          </div>
        </div>
      </header>

      <Transport onPlay={handlePlay} onPause={handlePause} onStop={handleStop} onExport={handleExport} />

      <div className="studio-grid">
        <div className="studio-main">
          <StepSequencer />
          <Mixer />
        </div>
        <aside className="studio-sidebar">
          <MacroPanel />
          <Visualizer />
          <AIGenerator />
        </aside>
      </div>

      <footer className="studio-footer">
        <span className="shortcut-hint">Space Play &middot; 1-4 Patterns &middot; Ctrl+Z Undo &middot; Ctrl+E Export &middot; Esc Stop</span>
      </footer>
    </main>
  );
}
