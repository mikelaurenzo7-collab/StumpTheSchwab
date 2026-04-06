"use client";

import { useEngineStore, PATTERN_LABELS, MAX_PATTERNS } from "@/store/engine";
import { memo, useCallback, useState } from "react";

// ── Single arrangement block ─────────────────────────────────
const ArrangementBlock = memo(function ArrangementBlock({
  position,
  patternIndex,
  isCurrent,
  isPlaying,
  onRemove,
  onChangePattern,
}: {
  position: number;
  patternIndex: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onRemove: (pos: number) => void;
  onChangePattern: (pos: number, patternIndex: number) => void;
}) {
  return (
    <div
      className={`
        relative flex flex-col items-center gap-0.5 px-1 py-1 rounded-md border transition-all min-w-[48px]
        ${isCurrent && isPlaying
          ? "border-accent bg-accent/15 shadow-sm shadow-accent/20"
          : isCurrent
            ? "border-accent/50 bg-accent/5"
            : "border-border bg-surface-2 hover:bg-surface-3"
        }
      `}
    >
      {/* Position number */}
      <span className="text-[8px] font-mono text-muted">{position + 1}</span>

      {/* Pattern selector */}
      <select
        value={patternIndex}
        onChange={(e) => onChangePattern(position, Number(e.target.value))}
        className="w-9 h-7 bg-transparent text-center text-sm font-bold text-foreground border-none outline-none cursor-pointer appearance-none"
        style={{ textAlignLast: "center" }}
      >
        {PATTERN_LABELS.map((label, i) => (
          <option key={label} value={i} className="bg-surface text-foreground">
            {label}
          </option>
        ))}
      </select>

      {/* Remove button */}
      <button
        onClick={() => onRemove(position)}
        className="text-[8px] text-muted/0 hover:text-danger group-hover:text-muted transition-colors leading-none"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
});

// ── Arranger Panel ────────────────────────────────────────────
export function Arranger() {
  const songMode = useEngineStore((s) => s.songMode);
  const songArrangement = useEngineStore((s) => s.songArrangement);
  const songPosition = useEngineStore((s) => s.songPosition);
  const playbackState = useEngineStore((s) => s.playbackState);
  const setSongMode = useEngineStore((s) => s.setSongMode);
  const addToArrangement = useEngineStore((s) => s.addToArrangement);
  const removeFromArrangement = useEngineStore((s) => s.removeFromArrangement);
  const clearArrangement = useEngineStore((s) => s.clearArrangement);

  const [collapsed, setCollapsed] = useState(false);

  const handleChangePattern = useCallback(
    (position: number, patternIndex: number) => {
      useEngineStore.setState((state) => ({
        songArrangement: state.songArrangement.map((p, i) =>
          i === position ? patternIndex : p
        ),
      }));
    },
    []
  );

  const handleRemove = useCallback(
    (position: number) => removeFromArrangement(position),
    [removeFromArrangement]
  );

  const isPlaying = playbackState === "playing";

  return (
    <div className="border-b border-border bg-surface">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        {/* Mode toggle */}
        <button
          onClick={() => setSongMode(!songMode)}
          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
            songMode
              ? "bg-accent text-white shadow-sm shadow-accent/30"
              : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground"
          }`}
          title={songMode ? "Song mode: plays through arrangement" : "Pattern mode: loops current pattern"}
        >
          {songMode ? "SONG" : "PATTERN"}
        </button>

        {/* Collapse toggle */}
        {songMode && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[10px] text-muted hover:text-foreground transition-colors"
          >
            {collapsed ? "▸ Show" : "▾ Arrangement"}
          </button>
        )}

        {songMode && !collapsed && (
          <>
            {/* Song length indicator */}
            <span className="text-[10px] font-mono text-muted ml-auto">
              {songArrangement.length} blocks
              {isPlaying && ` — ${songPosition + 1}/${songArrangement.length}`}
            </span>
          </>
        )}
      </div>

      {/* Arrangement timeline */}
      {songMode && !collapsed && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 group">
            {songArrangement.map((patternIndex, pos) => (
              <ArrangementBlock
                key={pos}
                position={pos}
                patternIndex={patternIndex}
                isCurrent={pos === songPosition}
                isPlaying={isPlaying}
                onRemove={handleRemove}
                onChangePattern={handleChangePattern}
              />
            ))}

            {/* Add button */}
            <button
              onClick={() => addToArrangement(0)}
              className="w-9 h-12 rounded-md border border-dashed border-border hover:border-accent/50 text-muted hover:text-accent flex items-center justify-center transition-colors text-lg"
              title="Add pattern block"
            >
              +
            </button>

            {/* Quick-add pattern buttons */}
            <div className="flex flex-col gap-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[7px] text-muted uppercase">Quick add</span>
              <div className="flex gap-0.5">
                {PATTERN_LABELS.slice(0, MAX_PATTERNS).map((label, i) => (
                  <button
                    key={label}
                    onClick={() => addToArrangement(i)}
                    className="w-5 h-5 rounded text-[8px] font-bold bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground transition-colors"
                    title={`Add pattern ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear arrangement */}
            {songArrangement.length > 1 && (
              <button
                onClick={clearArrangement}
                className="ml-2 text-[9px] text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
