"use client";

import { useCallback, useEffect } from "react";
import { useEngineStore } from "../store/engine";
import { useAudioEngine } from "../lib/useAudioEngine";
import { Transport } from "../components/Transport";
import { StepSequencer } from "../components/StepSequencer";
import { SynthPanel } from "../components/SynthPanel";

export default function Home() {
  const { play, pause, stop, exportWav } = useAudioEngine();

  const playing = useEngineStore((s) => s.playing);
  const setPlaying = useEngineStore((s) => s.setPlaying);
  const randomizePattern = useEngineStore((s) => s.randomizePattern);
  const mutatePattern = useEngineStore((s) => s.mutatePattern);
  const clearPattern = useEngineStore((s) => s.clearPattern);
  const undo = useEngineStore((s) => s.undo);
  const redo = useEngineStore((s) => s.redo);

  const togglePlayback = useCallback(async () => {
    if (playing) {
      pause();
      setPlaying(false);
    } else {
      await play();
      setPlaying(true);
    }
  }, [playing, play, pause, setPlaying]);

  const handleStop = useCallback(() => {
    stop();
    setPlaying(false);
  }, [stop, setPlaying]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const meta = e.metaKey || e.ctrlKey;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlayback();
          break;
        case "KeyR":
          if (!meta) { e.preventDefault(); randomizePattern(); }
          break;
        case "KeyF":
          if (!meta) { e.preventDefault(); mutatePattern(); }
          break;
        case "KeyC":
          if (!meta) { e.preventDefault(); clearPattern(); }
          break;
        case "KeyE":
          if (!meta) { e.preventDefault(); exportWav(); }
          break;
        case "KeyZ":
          if (meta) {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
          }
          break;
        case "Escape":
          handleStop();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlayback, handleStop, randomizePattern, mutatePattern, clearPattern, exportWav, undo, redo]);

  return (
    <main className="studio-shell">
      <Transport onPlay={play} onPause={pause} onExport={exportWav} />
      <section className="studio-grid">
        <StepSequencer />
        <SynthPanel />
      </section>
    </main>
  );
}
