"use client";

import { useEngineStore } from "@/store/engine";
import { useCallback } from "react";

export function Transport({ onInit }: { onInit: () => Promise<void> }) {
  const bpm = useEngineStore((s) => s.bpm);
  const swing = useEngineStore((s) => s.swing);
  const playbackState = useEngineStore((s) => s.playbackState);
  const setBpm = useEngineStore((s) => s.setBpm);
  const setSwing = useEngineStore((s) => s.setSwing);
  const play = useEngineStore((s) => s.play);
  const pause = useEngineStore((s) => s.pause);
  const stop = useEngineStore((s) => s.stop);
  const clearAll = useEngineStore((s) => s.clearAll);
  const totalSteps = useEngineStore((s) => s.totalSteps);
  const setTotalSteps = useEngineStore((s) => s.setTotalSteps);
  const undo = useEngineStore((s) => s.undo);
  const redo = useEngineStore((s) => s.redo);
  const canUndo = useEngineStore((s) => s.canUndo);
  const canRedo = useEngineStore((s) => s.canRedo);

  const handlePlay = useCallback(async () => {
    await onInit();
    if (playbackState === "playing") {
      pause();
    } else {
      play();
    }
  }, [onInit, playbackState, pause, play]);

  const handleStop = useCallback(async () => {
    await onInit();
    stop();
  }, [onInit, stop]);

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-surface border-b border-border flex-wrap">
      {/* Logo */}
      <div className="font-bold text-accent text-lg tracking-tight mr-2 select-none">
        STS
      </div>

      {/* Play/Pause */}
      <button
        onClick={handlePlay}
        className="w-10 h-10 rounded-lg bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors font-mono text-lg"
        title={playbackState === "playing" ? "Pause" : "Play"}
      >
        {playbackState === "playing" ? "⏸" : "▶"}
      </button>

      {/* Stop */}
      <button
        onClick={handleStop}
        className="w-10 h-10 rounded-lg bg-surface-2 hover:bg-surface-3 text-foreground flex items-center justify-center transition-colors font-mono text-lg"
        title="Stop"
      >
        ⏹
      </button>

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 ml-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="w-8 h-8 rounded bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground flex items-center justify-center transition-colors text-sm disabled:opacity-25 disabled:cursor-default disabled:hover:bg-surface-2 disabled:hover:text-muted"
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="w-8 h-8 rounded bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground flex items-center justify-center transition-colors text-sm disabled:opacity-25 disabled:cursor-default disabled:hover:bg-surface-2 disabled:hover:text-muted"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </button>
      </div>

      {/* BPM */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted uppercase tracking-wider">BPM</label>
        <input
          type="number"
          min={30}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-16 bg-surface-2 border border-border rounded px-2 py-1 text-center text-sm font-mono text-foreground focus:outline-none focus:border-accent"
        />
      </div>

      {/* Swing */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted uppercase tracking-wider">Swing</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={swing}
          onChange={(e) => setSwing(Number(e.target.value))}
          className="w-20"
        />
        <span className="text-xs font-mono text-muted w-8">
          {Math.round(swing * 100)}%
        </span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted uppercase tracking-wider">Steps</label>
        <select
          value={totalSteps}
          onChange={(e) => setTotalSteps(Number(e.target.value))}
          className="bg-surface-2 border border-border rounded px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:border-accent"
        >
          <option value={8}>8</option>
          <option value={16}>16</option>
          <option value={32}>32</option>
          <option value={64}>64</option>
        </select>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear */}
      <button
        onClick={clearAll}
        className="px-3 py-1.5 rounded bg-surface-2 hover:bg-danger/20 text-muted hover:text-danger text-xs uppercase tracking-wider transition-colors"
      >
        Clear All
      </button>
    </div>
  );
}
