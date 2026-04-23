"use client";

import { useEngineStore, PATTERN_LABELS } from "@/store/engine";
import { useHistoryStore } from "@/store/history";
import { PRESETS } from "@/lib/presets";
import { useCallback, useState } from "react";
import { SessionManager } from "@/components/SessionManager";
import { useExport } from "@/lib/useExport";

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
  const currentPattern = useEngineStore((s) => s.currentPattern);
  const setCurrentPattern = useEngineStore((s) => s.setCurrentPattern);
  const copyPattern = useEngineStore((s) => s.copyPattern);
  const loadPreset = useEngineStore((s) => s.loadPreset);

  const arrangementMode = useEngineStore((s) => s.arrangementMode);
  const [copySource, setCopySource] = useState<number | null>(null);
  const { exportWAV, exporting } = useExport();
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

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

  const handlePatternClick = useCallback(
    (index: number) => {
      if (copySource !== null) {
        // Paste mode: copy from source to clicked target
        copyPattern(copySource, index);
        setCopySource(null);
      } else {
        setCurrentPattern(index);
      }
    },
    [copySource, copyPattern, setCurrentPattern]
  );

  const handleCopy = useCallback(() => {
    if (copySource !== null) {
      setCopySource(null); // Cancel copy
    } else {
      setCopySource(currentPattern);
    }
  }, [copySource, currentPattern]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-border flex-wrap">
      {/* Logo */}
      <div className="font-bold text-accent text-lg tracking-tight mr-1 select-none">
        STS
      </div>

      {/* Play/Pause */}
      <button
        onClick={handlePlay}
        className="w-10 h-10 rounded-lg bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors font-mono text-lg"
        title={playbackState === "playing" ? "Pause (Space)" : "Play (Space)"}
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

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Pattern Selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted uppercase tracking-wider">Pattern</span>
        <div className="flex gap-0.5">
          {PATTERN_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => handlePatternClick(i)}
              className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                i === currentPattern
                  ? "bg-accent text-white shadow-sm shadow-accent/30"
                  : copySource === i
                    ? "bg-warning text-black animate-pulse"
                    : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground"
              }`}
              title={
                copySource !== null
                  ? `Paste pattern ${PATTERN_LABELS[copySource]} here`
                  : `Pattern ${label} (${i + 1})`
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
            copySource !== null
              ? "bg-warning text-black"
              : "bg-surface-2 text-muted hover:bg-surface-3"
          }`}
          title={copySource !== null ? "Cancel copy" : "Copy current pattern"}
        >
          {copySource !== null ? "ESC" : "CPY"}
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Preset Loader */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted uppercase tracking-wider">Preset</label>
        <select
          value=""
          onChange={(e) => {
            const idx = Number(e.target.value);
            if (!isNaN(idx) && PRESETS[idx]) {
              loadPreset(PRESETS[idx]);
            }
          }}
          className="bg-surface-2 border border-border rounded px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:border-accent"
        >
          <option value="" disabled>
            Load...
          </option>
          {PRESETS.map((p, i) => (
            <option key={p.name} value={i}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Undo / Redo */}
      <div className="flex gap-0.5">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="w-8 h-8 rounded text-sm transition-colors disabled:opacity-25 bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="w-8 h-8 rounded text-sm transition-colors disabled:opacity-25 bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      {/* Export */}
      <button
        onClick={() => exportWAV(2)}
        disabled={exporting}
        className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${
          exporting
            ? "bg-accent/50 text-white/50 cursor-wait"
            : "bg-accent hover:bg-accent-hover text-white"
        }`}
        title={arrangementMode ? "Export arrangement WAV" : "Export WAV (2 loops)"}
      >
        {exporting ? "Bouncing..." : "Export"}
      </button>

      {/* Sessions */}
      <SessionManager />

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
