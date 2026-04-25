"use client";

import { useEngineStore, PATTERN_LABELS } from "@/store/engine";
import { useHistoryStore } from "@/store/history";
import { useUiStore } from "@/store/ui";
import { PRESETS } from "@/lib/presets";
import { useCallback, useEffect, useRef, useState } from "react";
import { SessionManager } from "@/components/SessionManager";
import { STEM_RENDER_MODE_OPTIONS, useExport, type StemRenderMode } from "@/lib/useExport";
import { useMidiExport } from "@/lib/useMidiExport";

export function Transport({ onInit, lastSaved }: { onInit: () => Promise<void>; lastSaved?: Date | null }) {
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
  const [exportFormat, setExportFormat] = useState<"wav" | "stems" | "midi">("wav");
  const [stemRenderMode, setStemRenderMode] = useState<StemRenderMode>("fx-post-fader");
  const [includeMasterPrint, setIncludeMasterPrint] = useState(true);
  const { exportMidi, exporting: exportingMidi } = useMidiExport();
  const [exportLoops, setExportLoops] = useState(2);
  const { exportWAV, exportStems, exporting, exportMode } = useExport();
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
    <div className="glass-control relative flex flex-wrap items-center gap-2.5 rounded-lg px-2.5 py-2.5">
      {/* AI Generate */}
      <button
        onClick={() => useUiStore.getState().setGeneratorOpen(true)}
        className="button-primary group flex items-center gap-2 rounded-md px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em]"
        title="Generate or mutate a groove (G)"
      >
        <span className="text-base leading-none transition-transform group-hover:rotate-12">✦</span>
        Generate
      </button>

      {/* Play/Pause */}
      <button
        onClick={handlePlay}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-white/20 bg-white text-lg font-mono text-background shadow-lg shadow-white/10 hover:scale-105"
        title={playbackState === "playing" ? "Pause (Space)" : "Play (Space)"}
      >
        {playbackState === "playing" ? "⏸" : "▶"}
      </button>

      {/* Stop */}
      <button
        onClick={handleStop}
        className="button-secondary flex h-11 w-11 items-center justify-center rounded-md font-mono text-lg text-foreground"
        title="Stop"
      >
        ⏹
      </button>

      {/* BPM */}
      <div className="rounded-md border border-border bg-background-2 px-2.5 py-2">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted">BPM</div>
        <div className="flex items-center gap-2">
        <input
          type="number"
          min={30}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="control-input w-16 rounded-xl px-2 py-1.5 text-center text-sm font-mono"
        />
        <button
          onClick={handleTap}
          className="button-secondary min-w-[3rem] rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          title="Tap to set BPM — tap repeatedly at the desired tempo"
        >
          {tapHint}
        </button>
        </div>
      </div>

      {/* Swing */}
      <div className="rounded-md border border-border bg-background-2 px-2.5 py-2">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Swing</div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Steps */}
      <div className="rounded-md border border-border bg-background-2 px-2.5 py-2">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Steps</div>
        <div className="flex items-center gap-2">
        <select
          value={totalSteps}
          onChange={(e) => setTotalSteps(Number(e.target.value))}
          className="control-select rounded-xl px-2 py-1.5 text-sm font-mono"
        >
          <option value={8}>8</option>
          <option value={16}>16</option>
          <option value={32}>32</option>
          <option value={64}>64</option>
        </select>
        </div>
      </div>

      {/* Separator */}
      <div className="mx-1 h-7 w-px bg-white/10" />

      {/* Pattern Selector */}
      <div className="rounded-md border border-border bg-background-2 px-2.5 py-2">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Pattern bank</div>
        <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {PATTERN_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => handlePatternClick(i)}
              className={`w-7 h-7 rounded-xl text-xs font-bold transition-all ${
                i === currentPattern
                  ? "bg-accent text-white shadow-sm shadow-accent/40"
                : copySource === i
                  ? "bg-warning text-black animate-pulse"
                    : "bg-surface-3 text-muted hover:bg-surface-3 hover:text-foreground"
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
            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
               copySource !== null
                ? "bg-warning text-black"
                : "button-secondary"
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
             className="control-input w-24 rounded-xl border-accent px-2 py-1 text-xs font-medium"
           />
         ) : (
           <button
             onClick={startRename}
              className="button-ghost max-w-[8rem] truncate rounded-xl px-2 py-1 text-xs font-medium"
             title="Click to rename this pattern"
           >
             {currentPatternName}
           </button>
         )}
        </div>
      </div>

      {/* Separator */}
      <div className="mx-1 h-7 w-px bg-white/10" />

      {/* Preset Loader */}
      <div className="rounded-md border border-border bg-background-2 px-2.5 py-2">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Preset</div>
        <div className="flex items-center gap-2">
        <select
          value=""
          onChange={(e) => {
            const idx = Number(e.target.value);
            if (!isNaN(idx) && PRESETS[idx]) {
              loadPreset(PRESETS[idx]);
            }
          }}
          className="control-select rounded-xl px-2 py-1.5 text-sm font-mono"
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
      </div>

      {/* Spacer */}
      <div className="hidden min-w-4 flex-1 xl:block" />

      {/* Undo / Redo */}
      <div className="flex gap-0.5">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="button-secondary h-9 w-9 rounded-xl text-sm disabled:opacity-25"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="button-secondary h-9 w-9 rounded-xl text-sm disabled:opacity-25"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      {/* Export */}
      <div className="flex items-center gap-1">
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as "wav" | "stems" | "midi")}
          className="control-select rounded-xl px-2 py-1.5 text-[10px] font-mono text-muted"
          title="Export format"
        >
          <option value="wav">WAV Mix</option>
          <option value="stems">WAV Stems</option>
          <option value="midi">MIDI</option>
        </select>
        {exportFormat !== "midi" && (
          <select
            value={exportLoops}
            onChange={(e) => setExportLoops(Number(e.target.value))}
              className="control-select w-14 rounded-xl px-2 py-1.5 text-[10px] font-mono text-muted"
            title="Number of loops to export"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
            <option value={8}>8x</option>
          </select>
        )}
        {exportFormat === "stems" && (
          <>
            <select
              value={stemRenderMode}
              onChange={(e) => setStemRenderMode(e.target.value as StemRenderMode)}
              className="control-select rounded-xl px-2 py-1.5 text-[10px] font-mono text-muted"
              title={
                STEM_RENDER_MODE_OPTIONS.find((option) => option.value === stemRenderMode)?.hint ??
                "Choose how stems are rendered"
              }
            >
              {STEM_RENDER_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIncludeMasterPrint((value) => !value)}
              aria-pressed={includeMasterPrint}
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                includeMasterPrint
                  ? "bg-accent text-white shadow-sm shadow-accent/30"
                  : "button-secondary"
              }`}
              title="Include a mastered full-mix print alongside the premaster reference and stems"
            >
              Master Print
            </button>
          </>
        )}
        <button
          onClick={() => {
            if (exportFormat === "midi") {
              exportMidi();
            } else if (exportFormat === "stems") {
              exportStems({
                loops: exportLoops,
                renderMode: stemRenderMode,
                includeMasterPrint,
              });
            } else {
              exportWAV(exportLoops);
            }
          }}
          disabled={exporting || exportingMidi}
            className={`rounded-xl px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
             exporting || exportingMidi
               ? "bg-accent/50 text-white/50 cursor-wait"
               : "button-secondary bg-white text-background hover:bg-accent-hover hover:text-white"
            }`}
          title={
            exportFormat === "midi"
              ? "Export pattern as a Standard MIDI File (.mid) — drag into any DAW"
              : exportFormat === "stems"
                ? `${STEM_RENDER_MODE_OPTIONS.find((option) => option.value === stemRenderMode)?.hint ?? "Export stems"}${includeMasterPrint ? " Includes a mastered print." : " Includes only the premaster reference."}`
                : "Export pattern as a 16-bit PCM WAV mixdown"
          }
        >
          {exporting
            ? exportMode === "stems"
              ? "Packing..."
              : "Bouncing..."
            : exportingMidi
              ? "Writing..."
              : exportFormat === "stems"
                ? "Stems"
                : "Export"}
        </button>
      </div>

      {/* Sessions */}
      <SessionManager />

      {/* Humanize */}
      <button
        onClick={() => humanize(null, 0.15)}
        className="button-secondary rounded-xl px-3 py-2 text-[10px] uppercase tracking-[0.18em] hover:text-accent"
        title="Humanize all tracks — randomize velocities slightly for a more natural feel (H)"
      >
        Humanize
      </button>

      {/* Clear */}
      <button
        onClick={clearAll}
        className="button-secondary rounded-xl px-3 py-2 text-[10px] uppercase tracking-[0.18em] hover:bg-danger/20 hover:text-danger"
      >
        Clear All
      </button>

      {/* Help */}
      <button
        onClick={() => useUiStore.getState().toggleHelp()}
        className="button-secondary h-9 w-9 rounded-full text-sm"
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>

      {lastSaved && (
        <span className="text-[10px] text-muted/60 font-mono" title="Auto-saved">
          saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}
