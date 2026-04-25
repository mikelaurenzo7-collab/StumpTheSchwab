"use client";

import { useEngineStore, PATTERN_LABELS } from "@/store/engine";
import { useCallback, useState, type DragEvent } from "react";

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

  if (!songMode) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
              Arrangement lane
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Chain patterns A–H into a song.
            </p>
          </div>
          <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
            Off
          </span>
        </div>
        <button
          onClick={handleToggle}
          className="mt-4 w-full rounded-2xl bg-white text-background px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.01] hover:bg-accent-hover hover:text-white"
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
      <div className="rounded-2xl border border-accent/25 bg-accent/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleToggle}
            className="rounded-full bg-accent px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-accent-hover"
            title="Disable Song Mode"
          >
            Song Mode On
          </button>
          <span className="text-[10px] font-mono text-accent-hover">
            {chain.length} {chain.length === 1 ? "slot" : "slots"}
          </span>
        </div>

        <button
          onClick={handleAddCurrent}
          className="mt-3 w-full rounded-2xl bg-white/[0.08] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-white/[0.14]"
          title={`Append pattern ${PATTERN_LABELS[currentPattern]} to the chain`}
        >
          Add current pattern {PATTERN_LABELS[currentPattern]}
        </button>
      </div>

      {/* Direct add buttons */}
      <div className="rounded-2xl bg-white/[0.04] p-3">
        <div className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted">
          Pattern palette
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {PATTERN_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => addToChain(i)}
              className={`rounded-xl px-2 py-2 text-[10px] font-black transition-colors ${
                i === currentPattern
                  ? "bg-accent text-white shadow-sm shadow-accent/40"
                  : "bg-white/[0.08] text-muted/80 hover:bg-white/[0.14] hover:text-foreground"
              }`}
              title={`Append ${patterns[i]?.name ?? label}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chain visualization */}
      <div className="rounded-2xl bg-white/[0.04] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-muted">
            Timeline
          </div>
          {chain.length > 0 && (
            <button
              onClick={clearChain}
              className="rounded-full bg-white/[0.08] px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-danger/20 hover:text-danger"
              title="Clear the chain"
            >
              Clear
            </button>
          )}
        </div>

        {chain.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs leading-relaxed text-muted">
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
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all ${
                    isCurrent
                      ? "border-accent/50 bg-accent/20 shadow-sm shadow-accent/30"
                      : isDropTarget
                        ? "border-accent bg-accent/20"
                        : isDragging
                          ? "border-white/5 bg-surface-3/50 opacity-40"
                          : "border-white/[0.06] bg-white/[0.06] hover:border-danger/30 hover:bg-danger/10"
                  }`}
                  title={`${position + 1}. ${patternName}${customName ? ` (${PATTERN_LABELS[patternIdx]})` : ""} — drag to reorder · click to remove`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-black/25 text-[10px] font-black text-muted">
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
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted group-hover:hidden">
                    Drag
                  </span>
                  <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-danger group-hover:block">
                    Remove
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
