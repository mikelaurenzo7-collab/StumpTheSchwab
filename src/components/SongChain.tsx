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
      <div className="sec-head">
        <div className="dot" />
        <span>Song Chain</span>
        <button
          onClick={handleToggle}
          className="px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-border bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground hover:border-border-bright transition-colors ml-1"
          title="Enable Song Mode to chain patterns into an arrangement"
        >
          Enable
        </button>
        <span className="tag">OFF</span>
        <span className="text-[10px] text-muted/50 font-normal tracking-normal normal-case">
          chain patterns into an arrangement
        </span>
      </div>
    );
  }

  const isPlaying = playbackState === "playing";

  return (
    <div className="sec-head flex-wrap" style={{ paddingTop: "6px", paddingBottom: "6px" }}>
      <div className="dot" style={{ boxShadow: "0 0 10px var(--accent-glow)" }} />
      <button
        onClick={handleToggle}
        className="px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-hover transition-colors"
        style={{ boxShadow: "0 0 10px var(--accent-glow)" }}
        title="Disable Song Mode"
      >
        Song Mode
      </button>
      <span className="tag" style={{ color: "var(--accent)", borderColor: "rgba(139,92,246,0.3)", background: "var(--accent-subtle)" }}>ON</span>

      {/* Add current pattern */}
      <button
        onClick={handleAddCurrent}
        className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground transition-colors"
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
            className="w-5 h-5 rounded text-[9px] font-bold bg-surface-2 text-muted/70 hover:bg-surface-3 hover:text-foreground transition-colors"
            title={`Append ${patterns[i]?.name ?? label}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Chain visualization */}
      {chain.length === 0 ? (
        <span className="text-[10px] text-muted/60 italic">
          Empty — add patterns to build an arrangement
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
                style={isCurrent ? { boxShadow: "0 0 12px var(--success-glow)" } : undefined}
                className={`group relative h-6 rounded text-[10px] font-bold transition-all ${
                  customName ? "px-1.5 min-w-[1.75rem]" : "w-7"
                } ${
                  isCurrent
                    ? "bg-success text-white shadow-sm shadow-accent/40 scale-110"
                    : isDropTarget
                      ? "bg-accent/40 text-white ring-2 ring-accent"
                      : isDragging
                        ? "bg-surface-3 text-muted opacity-40"
                        : "bg-surface-2 text-foreground hover:bg-danger/30 hover:text-danger cursor-grab"
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
            className="ml-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-surface-2 text-muted hover:bg-danger/20 hover:text-danger transition-colors"
            title="Clear the chain"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}
