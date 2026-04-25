"use client";

import { useEngineStore, PATTERN_LABELS } from "@/store/engine";
import { useCallback } from "react";

export function SongChain() {
  const songMode = useEngineStore((s) => s.songMode);
  const chain = useEngineStore((s) => s.chain);
  const chainPosition = useEngineStore((s) => s.chainPosition);
  const playbackState = useEngineStore((s) => s.playbackState);
  const currentPattern = useEngineStore((s) => s.currentPattern);
  const addToChain = useEngineStore((s) => s.addToChain);
  const removeFromChain = useEngineStore((s) => s.removeFromChain);
  const clearChain = useEngineStore((s) => s.clearChain);
  const setSongMode = useEngineStore((s) => s.setSongMode);

  const handleToggle = useCallback(() => setSongMode(!songMode), [songMode, setSongMode]);

  const handleAddCurrent = useCallback(() => {
    addToChain(currentPattern);
  }, [addToChain, currentPattern]);

  if (!songMode) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 bg-surface/60 border-b border-border">
        <button
          onClick={handleToggle}
          className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground transition-colors"
          title="Enable Song Mode to chain patterns into an arrangement"
        >
          Song Mode
        </button>
        <span className="text-[10px] text-muted/60">
          Chain patterns A–H into an arrangement
        </span>
      </div>
    );
  }

  const isPlaying = playbackState === "playing";

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-surface/60 border-b border-border flex-wrap">
      <button
        onClick={handleToggle}
        className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent-hover transition-colors"
        title="Disable Song Mode"
      >
        Song Mode
      </button>

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
            title={`Append pattern ${label}`}
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
        <div className="flex items-center gap-0.5 flex-wrap">
          {chain.map((patternIdx, position) => {
            const isCurrent = isPlaying && position === chainPosition;
            return (
              <button
                key={position}
                onClick={() => removeFromChain(position)}
                className={`group relative w-7 h-6 rounded text-[10px] font-bold transition-all ${
                  isCurrent
                    ? "bg-accent text-white shadow-sm shadow-accent/40 scale-110"
                    : "bg-surface-2 text-foreground hover:bg-danger/30 hover:text-danger"
                }`}
                title={`Position ${position + 1}: Pattern ${PATTERN_LABELS[patternIdx]} — click to remove`}
              >
                {PATTERN_LABELS[patternIdx]}
                <span className="absolute -top-1 -right-1 text-[7px] opacity-0 group-hover:opacity-100 text-danger">
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
