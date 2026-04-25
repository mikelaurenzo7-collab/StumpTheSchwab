"use client";

import { useEngineStore, PATTERN_LABELS } from "@/store/engine";
import { useHistoryStore } from "@/store/history";
import { useUiStore, THEME_LABELS, type AccentTheme } from "@/store/ui";
import { PRESETS } from "@/lib/presets";
import { useCallback, useEffect, useRef, useState } from "react";
import { SessionManager } from "@/components/SessionManager";
import { useExport } from "@/lib/useExport";
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
  const [exportFormat, setExportFormat] = useState<"wav" | "midi" | "stems">("wav");
  const { exportMidi, exporting: exportingMidi } = useMidiExport();
  const [exportLoops, setExportLoops] = useState(2);
  const { exportWAV, exportStems, exporting } = useExport();
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const accentTheme = useUiStore((s) => s.accentTheme);
  const setAccentTheme = useUiStore((s) => s.setAccentTheme);
  const currentStep = useEngineStore((s) => s.currentStep);

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

  // Derive bar:beat from currentStep for the beat counter
  const bar  = currentStep >= 0 ? Math.floor(currentStep / 4) + 1 : 1;
  const beat = currentStep >= 0 ? (currentStep % 4) + 1 : 1;
  const playing = playbackState === "playing";

  return (
    <div
      className="transport-glow flex items-center gap-2.5 px-4 py-2.5 border-b border-border flex-wrap"
      style={{ background: "linear-gradient(180deg, var(--surface), var(--surface-2))" }}
    >
      {/* ── Logo ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pr-3 mr-0.5 border-r border-border h-[30px] select-none">
        <div
          className="w-7 h-7 rounded-[7px] grid place-items-center text-white font-extrabold font-mono text-[12px] shrink-0"
          style={{
            background: "radial-gradient(circle at 30% 25%, var(--accent-hover), var(--accent) 55%, var(--accent-dim))",
            boxShadow: "0 0 0 1px rgba(255,255,255,.08) inset, 0 4px 12px -4px var(--accent-glow)",
          }}
        >
          S
        </div>
        <div className="flex flex-col leading-none">
          <b className="text-[12px] font-extrabold tracking-tight">StumpTheSchwab</b>
          <span className="text-[8px] font-mono text-muted tracking-[0.22em] mt-0.5">STUDIO</span>
        </div>
      </div>

      {/* ── AI Generate ──────────────────────────────────────── */}
      <button
        onClick={() => useUiStore.getState().setGeneratorOpen(true)}
        className="px-3 py-2 rounded-lg text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-accent/60"
        style={{
          background: "linear-gradient(180deg, var(--accent-hover), var(--accent-dim))",
          boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, 0 6px 16px -8px var(--accent-glow)",
        }}
        title="Generate a beat with Claude (G)"
      >
        <span className="text-sm leading-none">✦</span>
        Generate
      </button>

      {/* ── Play / Pause ─────────────────────────────────────── */}
      <button
        onClick={handlePlay}
        className="w-[38px] h-[38px] rounded-[9px] text-white flex items-center justify-center transition-all font-mono text-base border"
        style={playing ? {
          background: "var(--success)",
          borderColor: "var(--success)",
          boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, 0 0 20px var(--success-glow)",
          animation: "play-pulse 2s ease-in-out infinite",
        } : {
          background: "linear-gradient(180deg, var(--accent-hover), var(--accent-dim))",
          borderColor: "var(--accent)",
          boxShadow: "0 1px 0 rgba(255,255,255,.18) inset, 0 8px 22px -10px var(--accent-glow)",
        }}
        title={playing ? "Pause (Space)" : "Play (Space)"}
      >
        {playing ? "⏸" : "▶"}
      </button>

      {/* ── Stop ─────────────────────────────────────────────── */}
      <button
        onClick={handleStop}
        className="w-[34px] h-[34px] rounded-lg bg-surface-3 hover:bg-surface-raised border border-border text-muted hover:text-foreground flex items-center justify-center transition-colors font-mono text-sm"
        title="Stop (.)"
      >
        ⏹
      </button>

      {/* ── BPM cluster ──────────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5 px-2.5 h-[34px] border border-border rounded-[7px]"
        style={{ background: "var(--surface-deep)", boxShadow: "0 2px 0 rgba(255,255,255,.02) inset" }}
      >
        <span className="text-[8.5px] font-bold font-mono tracking-[0.18em] text-muted">BPM</span>
        <input
          type="number"
          min={30}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="tempo-input"
          title="Beats per minute"
        />
        <button
          onClick={handleTap}
          className="text-[9px] font-bold font-mono tracking-wider text-muted hover:text-foreground transition-colors min-w-[2.5rem]"
          title="Tap to set BPM"
        >
          {tapHint}
        </button>
      </div>

      {/* ── Beat counter ─────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 h-[34px] border border-border rounded-[7px]"
        style={{ background: "var(--surface-deep)" }}
      >
        <div className="text-[16px] font-bold font-mono leading-none" style={{ letterSpacing: "0.02em" }}>
          <span style={{ color: playing ? "var(--foreground)" : "var(--muted)" }}>{bar}</span>
          <span style={{ color: "var(--muted)", fontWeight: 400, margin: "0 1px" }}>.</span>
          <span style={{
            color: playing ? "var(--cyan)" : "var(--muted)",
            textShadow: playing ? "0 0 10px var(--cyan-glow)" : "none",
          }}>
            {beat}
          </span>
        </div>
        <span className="text-[8px] font-bold font-mono tracking-[0.18em] text-muted leading-none">BAR<br/>BEAT</span>
      </div>

      {/* ── Swing ────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-2.5 h-[34px] border border-border rounded-[7px]"
        style={{ background: "var(--surface-deep)" }}
      >
        <span className="text-[8.5px] font-bold font-mono tracking-[0.18em] text-muted">SWING</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={swing}
          onChange={(e) => setSwing(Number(e.target.value))}
          className="w-16"
        />
        <span className="text-[10px] font-mono text-muted w-7 text-right">
          {Math.round(swing * 100)}%
        </span>
      </div>

      {/* ── Steps ────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-2.5 h-[34px] border border-border rounded-[7px]"
        style={{ background: "var(--surface-deep)" }}
      >
        <span className="text-[8.5px] font-bold font-mono tracking-[0.18em] text-muted">STEPS</span>
        <select
          value={totalSteps}
          onChange={(e) => setTotalSteps(Number(e.target.value))}
          className="bg-transparent border-none outline-none text-[12px] font-mono font-semibold text-foreground cursor-pointer"
        >
          <option value={8}>8</option>
          <option value={16}>16</option>
          <option value={32}>32</option>
          <option value={64}>64</option>
        </select>
      </div>

      {/* ── Divider ──────────────────────────────────────────── */}
      <div className="w-px h-5 bg-border mx-0.5" />

      {/* ── Pattern Selector ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <span className="text-[8.5px] font-bold font-mono tracking-[0.18em] text-muted">PATTERN</span>
        <div className="flex gap-0.5">
          {PATTERN_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => handlePatternClick(i)}
              className={`w-7 h-7 rounded text-[11px] font-bold font-mono transition-all grid place-items-center border ${
                i === currentPattern
                  ? "text-white border-accent"
                  : copySource === i
                    ? "border-warning text-warning animate-blink"
                    : "bg-surface-3 border-border text-muted hover:text-foreground hover:border-border/80"
              }`}
              style={i === currentPattern ? {
                background: "linear-gradient(180deg, var(--accent-hover), var(--accent-dim))",
                boxShadow: "0 0 0 1px rgba(255,255,255,.15) inset, 0 4px 14px -6px var(--accent-glow)",
              } : copySource === i ? {
                background: "rgba(245,158,11,0.12)",
              } : undefined}
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
          className={`px-2 py-1 rounded text-[10px] font-bold font-mono uppercase tracking-wider transition-colors border ${
            copySource !== null
              ? "bg-warning/20 border-warning text-warning"
              : "bg-surface-3 border-border text-muted hover:text-foreground"
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

      {/* ── Divider ──────────────────────────────────────────── */}
      <div className="w-px h-5 bg-border mx-0.5" />

      {/* ── Preset Loader ────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-2.5 h-[34px] border border-border rounded-[7px]"
        style={{ background: "var(--surface-deep)" }}
      >
        <span className="text-[8.5px] font-bold font-mono tracking-[0.18em] text-muted">PRESET</span>
        <select
          value=""
          onChange={(e) => {
            const idx = Number(e.target.value);
            if (!isNaN(idx) && PRESETS[idx]) loadPreset(PRESETS[idx]);
          }}
          className="bg-transparent border-none outline-none text-[11px] font-mono text-foreground cursor-pointer"
        >
          <option value="" disabled>Load…</option>
          {PRESETS.map((p, i) => (
            <option key={p.name} value={i}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* ── Spacer ───────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Undo / Redo ──────────────────────────────────────── */}
      <div className="flex gap-0.5">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="w-8 h-8 rounded text-sm transition-colors disabled:opacity-25 bg-surface-2 border border-border text-muted hover:bg-surface-3 hover:text-foreground"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="w-8 h-8 rounded text-sm transition-colors disabled:opacity-25 bg-surface-2 border border-border text-muted hover:bg-surface-3 hover:text-foreground"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>

      {/* ── Export ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as "wav" | "midi")}
          className="bg-surface-2 border border-border rounded px-1.5 py-1 text-[10px] font-mono text-muted focus:outline-none focus:border-accent"
          title="Export format"
        >
          <option value="wav">WAV</option>
          <option value="midi">MIDI</option>
          <option value="stems">Stems</option>
        </select>
        {(exportFormat === "wav" || exportFormat === "stems") && (
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
        )}
        <button
          onClick={() => {
            if (exportFormat === "midi") exportMidi();
            else if (exportFormat === "stems") exportStems(exportLoops);
            else exportWAV(exportLoops);
          }}
          disabled={exporting || exportingMidi}
          className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors font-bold border ${
            exporting || exportingMidi
              ? "bg-accent/30 border-accent/30 text-white/50 cursor-wait"
              : "bg-accent hover:bg-accent-hover border-accent text-white"
          }`}
          title={
            exportFormat === "midi"
              ? "Export pattern as a Standard MIDI File (.mid)"
              : exportFormat === "stems"
                ? "Export each track as a separate WAV file"
                : "Export pattern as 16-bit PCM WAV"
          }
        >
          {exporting ? "Bouncing…" : exportingMidi ? "Writing…" : "Export"}
        </button>
      </div>

      {/* ── Sessions ─────────────────────────────────────────── */}
      <SessionManager />

      {/* ── Humanize ─────────────────────────────────────────── */}
      <button
        onClick={() => humanize(null, 0.15)}
        className="px-2.5 py-1.5 rounded bg-surface-2 border border-border hover:border-accent/40 text-muted hover:text-accent text-[10px] font-bold uppercase tracking-wider transition-colors"
        title="Humanize all tracks (H)"
      >
        Humanize
      </button>

      {/* ── Clear ────────────────────────────────────────────── */}
      <button
        onClick={clearAll}
        className="px-2.5 py-1.5 rounded bg-surface-2 border border-border hover:border-danger/40 text-muted hover:text-danger text-[10px] font-bold uppercase tracking-wider transition-colors"
      >
        Clear
      </button>

      {/* ── Theme Switcher ───────────────────────────────────── */}
      <select
        value={accentTheme}
        onChange={(e) => setAccentTheme(e.target.value as AccentTheme)}
        className="bg-surface-2 border border-border rounded px-1.5 py-1 text-[10px] font-mono text-muted focus:outline-none focus:border-accent"
        title="Accent theme"
      >
        {(Object.keys(THEME_LABELS) as AccentTheme[]).map((t) => (
          <option key={t} value={t}>{THEME_LABELS[t]}</option>
        ))}
      </select>

      {/* ── Help ─────────────────────────────────────────────── */}
      <button
        onClick={() => useUiStore.getState().toggleHelp()}
        className="w-8 h-8 rounded-full bg-surface-2 border border-border hover:bg-surface-3 text-muted hover:text-foreground text-sm transition-colors"
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>

      {lastSaved && (
        <span className="text-[9px] text-muted/50 font-mono" title="Auto-saved">
          saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}
