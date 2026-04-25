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
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
        <button
          onClick={handleToggle}
          className="rounded-full bg-white/[0.08] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted transition-colors hover:bg-accent hover:text-white"
          title="Enable Song Mode to chain patterns into an arrangement"
        >
          Song Mode
        </button>
        <span className="text-xs leading-relaxed text-muted">
          Chain patterns A–H into a visible arrangement.
        </span>
      </div>
    );
  }

  const isPlaying = playbackState === "playing";

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-3 flex-wrap">
      <button
        onClick={handleToggle}
        className="rounded-full bg-accent px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-accent-hover"
        title="Disable Song Mode"
      >
        Song Mode
      </button>

      {/* Add current pattern */}
      <button
        onClick={handleAddCurrent}
        className="rounded-full bg-white/[0.08] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-white/[0.14] hover:text-foreground"
        title={`Append pattern ${PATTERN_LABELS[currentPattern]} to the chain`}
      >
        + {PATTERN_LABELS[currentPattern]}
      </button>

      {/* Direct add buttons */}
      <div className="flex gap-0.5">
        {PATTERN_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => addToChain(i)}
              className="h-7 w-7 rounded-xl bg-white/[0.08] text-[9px] font-bold text-muted/80 transition-colors hover:bg-white/[0.14] hover:text-foreground"
              title={`Append ${patterns[i]?.name ?? label}`}
            >
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-white/10 mx-1" />

      {/* Chain visualization */}
      {chain.length === 0 ? (
        <span className="text-xs text-muted/70 italic">
          Empty — add patterns to build an arrangement.
        </span>
      ) : (
        <div className="flex items-center gap-0.5 flex-wrap" onDragLeave={() => setDragOver(null)}>
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
                 className={`group relative h-8 rounded-xl text-[10px] font-bold transition-all ${
                   customName ? "px-2 min-w-[2rem]" : "w-8"
                 } ${
                   isCurrent
                     ? "bg-accent text-white shadow-sm shadow-accent/40 scale-105"
                   : isDropTarget
                     ? "bg-accent/40 text-white ring-2 ring-accent"
                   : isDragging
                       ? "bg-surface-3 text-muted opacity-40"
                       : "bg-white/[0.08] text-foreground hover:bg-danger/30 hover:text-danger cursor-grab"
                 }`}
                title={`${position + 1}. ${patternName}${customName ? ` (${PATTERN_LABELS[patternIdx]})` : ""} — drag to reorder · click to remove`}
              >
                {customName ? (
                  <span className="text-[9px] truncate max-w-[5rem] block">
                    {patternName}
                  </span>
                ) : (
                  PATTERN_LABELS[patternIdx]
                )}
                <span className="absolute -top-1 -right-1 text-[7px] opacity-0 group-hover:opacity-100 text-danger pointer-events-none">
                  ✕
                </span>
              </button>
            );
          })}
        </div>
      )}

      {chain.length > 0 && (
        <>
          <span className="text-[9px] text-muted font-mono ml-1">
            {chain.length} {chain.length === 1 ? "pattern" : "patterns"}
          </span>
          <button
            onClick={clearChain}
             className="ml-1 rounded-full bg-white/[0.08] px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-danger/20 hover:text-danger"
            title="Clear the chain"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
