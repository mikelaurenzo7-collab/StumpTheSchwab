"use client";

import { useEngineStore, PATTERN_LABELS } from "@/store/engine";
import { useCallback, useState, type DragEvent, type KeyboardEvent } from "react";

export function SongChain() {
  const songMode = useEngineStore((s) => s.songMode);
  const chain = useEngineStore((s) => s.chain);
  const chainPosition = useEngineStore((s) => s.chainPosition);
  const playbackState = useEngineStore((s) => s.playbackState);
  const currentPattern = useEngineStore((s) => s.currentPattern);
  const patterns = useEngineStore((s) => s.patterns);
  const addToChain = useEngineStore((s) => s.addToChain);
  const removeFromChain = useEngineStore((s) => s.removeFromChain);
  const clearChain = useEngineStore((s) => s.clearChain);
  const setSongMode = useEngineStore((s) => s.setSongMode);
  const moveChainItem = useEngineStore((s) => s.moveChainItem);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleToggle = useCallback(() => setSongMode(!songMode), [songMode, setSongMode]);

  const handleAddCurrent = useCallback(() => {
    addToChain(currentPattern);
  }, [addToChain, currentPattern]);

  const handleDragStart = useCallback((e: DragEvent<HTMLButtonElement>, position: number) => {
    setDragFrom(position);
    e.dataTransfer.effectAllowed = "move";
    // Required for Firefox to actually start the drag
    e.dataTransfer.setData("text/plain", String(position));
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLButtonElement>, position: number) => {
    if (dragFrom === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== position) setDragOver(position);
  }, [dragFrom, dragOver]);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLButtonElement>, position: number) => {
      e.preventDefault();
      if (dragFrom !== null && dragFrom !== position) {
        moveChainItem(dragFrom, position);
      }
      setDragFrom(null);
      setDragOver(null);
    },
    [dragFrom, moveChainItem]
  );

  const handleDragEnd = useCallback(() => {
    setDragFrom(null);
    setDragOver(null);
  }, []);

  const handleChainKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, position: number) => {
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        if (position > 0) moveChainItem(position, position - 1);
      } else if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        if (position < chain.length - 1) moveChainItem(position, position + 1);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeFromChain(position);
      }
    },
    [chain.length, moveChainItem, removeFromChain]
  );

  if (!songMode) {
    return (
      <div className="rounded-[1.4rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015)),rgba(8,12,18,0.7)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              Arrangement lane
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Chain patterns A–H into a song.
            </p>
          </div>
          <span
            aria-label="Song Mode is currently disabled"
            className="pill-badge rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
          >
            Off
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/75">
          <span className="pill-badge rounded-full px-2.5 py-1">Loop-aware</span>
          <span className="pill-badge rounded-full px-2.5 py-1">Drag reorder</span>
          <span className="pill-badge rounded-full px-2.5 py-1">Pattern chain</span>
        </div>
        <button
          onClick={handleToggle}
          className="button-primary mt-4 w-full rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
          title="Enable Song Mode to chain patterns into an arrangement"
        >
          Enable Song Mode
        </button>
      </div>
    );
  }

  const isPlaying = playbackState === "playing";

  return (
    <div className="space-y-3">
      <div className="rounded-[1.35rem] border border-accent/25 bg-[linear-gradient(180deg,rgba(139,92,246,0.16),rgba(139,92,246,0.06)),rgba(13,17,26,0.78)] p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-accent-hover">
              Arrangement live
            </div>
            <div className="mt-1 text-sm font-black text-white">
              Song mode is driving the timeline
            </div>
          </div>
          <button
            onClick={handleToggle}
            className="button-primary rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em]"
            title="Disable Song Mode"
          >
            Song Mode On
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-accent-hover/90">
          <span className="pill-badge rounded-full px-2.5 py-1">{chain.length} {chain.length === 1 ? "pattern" : "patterns"}</span>
          <span className="pill-badge rounded-full px-2.5 py-1">Current {PATTERN_LABELS[currentPattern]}</span>
          <span className="pill-badge rounded-full px-2.5 py-1">{isPlaying ? `Playing slot ${chainPosition + 1}` : "Idle"}</span>
        </div>

        <button
          onClick={handleAddCurrent}
          className="button-secondary mt-3 w-full rounded-2xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground"
          title={`Append pattern ${PATTERN_LABELS[currentPattern]} to the chain`}
        >
          Add current pattern {PATTERN_LABELS[currentPattern]}
        </button>
      </div>

      {/* Direct add buttons */}
      <div className="rounded-[1.25rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015)),rgba(8,12,18,0.62)] p-3">
        <div className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted">
          Pattern palette
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {PATTERN_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => addToChain(i)}
              className={`rounded-xl border px-2 py-2 text-[10px] font-black transition-colors ${
                i === currentPattern
                  ? "border-accent/60 bg-accent text-white shadow-sm shadow-accent/40"
                  : "border-white/[0.06] bg-black/20 text-muted/80 hover:border-white/14"
               }`}
              title={`Append ${patterns[i]?.name ?? label}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chain visualization */}
      <div className="rounded-[1.25rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015)),rgba(8,12,18,0.62)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-muted">
            Timeline
          </div>
          {chain.length > 0 && (
            <button
              onClick={clearChain}
              className="button-secondary rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-wider hover:bg-danger/20 hover:text-danger"
              title="Clear the chain"
            >
              Clear
            </button>
          )}
        </div>
        <div id="song-chain-drag-status" aria-live="polite" className="sr-only">
          {dragFrom === null
            ? ""
            : dragOver === null
              ? `Moving pattern at position ${dragFrom + 1}.`
              : `Moving pattern from position ${dragFrom + 1} to position ${dragOver + 1}.`}
        </div>

        {chain.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-center text-xs leading-relaxed text-muted">
            Empty timeline. Add patterns above to build an arrangement that advances at each loop.
          </div>
        ) : (
          <div className="space-y-2" onDragLeave={() => setDragOver(null)}>
            {chain.map((patternIdx, position) => {
              const isCurrent = isPlaying && position === chainPosition;
              const isDragging = dragFrom === position;
              const isDropTarget = dragOver === position && dragFrom !== position;
              const patternName = patterns[patternIdx]?.name ?? PATTERN_LABELS[patternIdx];
              const customName = patternName !== PATTERN_LABELS[patternIdx];

              return (
                <button
                  key={position}
                  draggable
                  onDragStart={(e) => handleDragStart(e, position)}
                  onDragOver={(e) => handleDragOver(e, position)}
                  onDrop={(e) => handleDrop(e, position)}
                  onDragEnd={handleDragEnd}
                  onClick={() => removeFromChain(position)}
                  onKeyDown={(e) => handleChainKeyDown(e, position)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-describedby={dragFrom !== null ? "song-chain-drag-status" : undefined}
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Delete"
                  aria-label={`${position + 1}. ${patternName}${customName ? `, pattern ${PATTERN_LABELS[patternIdx]}` : ""}${isCurrent ? ", currently playing" : ""}. Click or press Enter to remove. Use Alt plus arrow keys to reorder.`}
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all ${
                    isCurrent
                      ? "border-accent/50 bg-[linear-gradient(180deg,rgba(139,92,246,0.2),rgba(139,92,246,0.08)),rgba(12,16,25,0.82)] shadow-sm shadow-accent/30"
                      : isDropTarget
                        ? "border-accent bg-accent/20"
                        : isDragging
                          ? "border-white/5 bg-surface-3/50 opacity-40"
                          : "border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015)),rgba(8,12,18,0.72)] hover:border-danger/30 hover:bg-danger/10"
                  }`}
                  title={`${position + 1}. ${patternName}${customName ? ` (${PATTERN_LABELS[patternIdx]})` : ""} — drag to reorder · click to remove`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/25 text-[10px] font-black text-muted">
                    {position + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {patternName}
                    </span>
                    <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted">
                      Pattern {PATTERN_LABELS[patternIdx]}
                      {isCurrent ? " · playing" : ""}
                    </span>
                  </span>
                  <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted transition-colors group-hover:border-danger/30 group-hover:text-danger group-focus-visible:text-danger">
                    Drag · Remove
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
