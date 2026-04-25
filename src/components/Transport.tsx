"use client";

import { useEngineStore, PATTERN_LABELS } from "@/store/engine";
import { useHistoryStore } from "@/store/history";
import { useUiStore } from "@/store/ui";
import { PRESETS } from "@/lib/presets";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const humanize = useEngineStore((s) => s.humanize);
  const totalSteps = useEngineStore((s) => s.totalSteps);
  const setTotalSteps = useEngineStore((s) => s.setTotalSteps);
  const currentPattern = useEngineStore((s) => s.currentPattern);
  const setCurrentPattern = useEngineStore((s) => s.setCurrentPattern);
  const copyPattern = useEngineStore((s) => s.copyPattern);
  const loadPreset = useEngineStore((s) => s.loadPreset);
  const renamePattern = useEngineStore((s) => s.renamePattern);
  const currentPatternName = useEngineStore(
    (s) => s.patterns[s.currentPattern]?.name ?? PATTERN_LABELS[s.currentPattern]
  );

  const [copySource, setCopySource] = useState<number | null>(null);
  // Track which pattern (if any) is being renamed. Deriving `renaming` from a
  // comparison with currentPattern means switching patterns auto-cancels the
  // rename without an effect.
  const [renamingPattern, setRenamingPattern] = useState<number | null>(null);
  const renaming = renamingPattern === currentPattern;
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const tapResetRef = useRef<number | null>(null);
  const [exportLoops, setExportLoops] = useState(2);
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
      setCopySource(null);
    } else {
      setCopySource(currentPattern);
    }
  }, [copySource, currentPattern]);

  const startRename = useCallback(() => {
    setRenameDraft(currentPatternName);
    setRenamingPattern(currentPattern);
  }, [currentPatternName, currentPattern]);

  const commitRename = useCallback(() => {
    const next = renameDraft.trim();
    // Empty name reverts to default letter
    renamePattern(currentPattern, next.length === 0 ? PATTERN_LABELS[currentPattern] : next);
    setRenamingPattern(null);
  }, [renameDraft, renamePattern, currentPattern]);

  const cancelRename = useCallback(() => setRenamingPattern(null), []);

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  // ── Tap tempo ────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    const now = performance.now();
    if (tapResetRef.current) clearTimeout(tapResetRef.current);
    tapResetRef.current = window.setTimeout(() => setTapTimes([]), 2000) as unknown as number;

    setTapTimes((prev) => {
      const recent = prev.length > 0 && now - prev[prev.length - 1] > 2000 ? [] : prev;
      const next = [...recent, now].slice(-6);
      if (next.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < next.length; i++) intervals.push(next[i] - next[i - 1]);
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const detected = Math.round(60000 / avg);
        if (detected >= 30 && detected <= 300) setBpm(detected);
      }
      return next;
    });
  }, [setBpm]);

  const tapHint = tapTimes.length === 0
    ? "Tap"
    : tapTimes.length === 1
      ? "Tap again"
      : `${tapTimes.length}/6`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-border flex-wrap">
      {/* Logo */}
      <div className="font-bold text-accent text-lg tracking-tight mr-1 select-none">
        STS
      </div>

      {/* AI Generate */}
      <button
        onClick={() => useUiStore.getState().setGeneratorOpen(true)}
        className="px-3 py-2 rounded-lg bg-gradient-to-br from-accent to-accent-dim hover:from-accent-hover hover:to-accent text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm shadow-accent/30 flex items-center gap-1.5"
        title="Generate a beat with Claude (G)"
      >
        <span className="text-sm leading-none">✦</span>
        Generate
      </button>

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
        <button
          onClick={handleTap}
          className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground transition-colors min-w-[3rem]"
          title="Tap to set BPM — tap repeatedly at the desired tempo"
        >
          {tapHint}
        </button>
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

        {/* Pattern name (rename on click) */}
        {renaming ? (
          <input
            ref={renameInputRef}
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelRename();
              }
            }}
            maxLength={16}
            placeholder={PATTERN_LABELS[currentPattern]}
            className="bg-surface-2 border border-accent rounded px-2 py-0.5 text-xs font-medium text-foreground w-24 focus:outline-none"
          />
        ) : (
          <button
            onClick={startRename}
            className="text-xs font-medium text-muted hover:text-foreground px-1 truncate max-w-[8rem]"
            title="Click to rename this pattern"
          >
            {currentPatternName}
          </button>
        )}
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
      <div className="flex items-center gap-1">
        <select
          value={exportLoops}
          onChange={(e) => setExportLoops(Number(e.target.value))}
          className="bg-surface-2 border border-border rounded px-1.5 py-1 text-[10px] font-mono text-muted focus:outline-none focus:border-accent w-14"
          title="Number of loops to export"
        >
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={8}>8x</option>
        </select>
        <button
          onClick={() => exportWAV(exportLoops)}
          disabled={exporting}
          className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors font-bold ${
            exporting
              ? "bg-accent/50 text-white/50 cursor-wait"
              : "bg-accent hover:bg-accent-hover text-white"
          }`}
          title="Export pattern as WAV"
        >
          {exporting ? "Bouncing..." : "Export"}
        </button>
      </div>

      {/* Sessions */}
      <SessionManager />

      {/* Humanize */}
      <button
        onClick={() => humanize(null, 0.15)}
        className="px-3 py-1.5 rounded bg-surface-2 hover:bg-accent-dim/30 text-muted hover:text-accent text-xs uppercase tracking-wider transition-colors"
        title="Humanize all tracks — randomize velocities slightly for a more natural feel (H)"
      >
        Humanize
      </button>

      {/* Clear */}
      <button
        onClick={clearAll}
        className="px-3 py-1.5 rounded bg-surface-2 hover:bg-danger/20 text-muted hover:text-danger text-xs uppercase tracking-wider transition-colors"
      >
        Clear All
      </button>

      {/* Help */}
      <button
        onClick={() => useUiStore.getState().toggleHelp()}
        className="w-8 h-8 rounded-full bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground text-sm transition-colors"
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>
    </div>
  );
}
