"use client";

import { memo, useCallback } from "react";
import { useEngineStore, PATTERN_LABELS, type ArrangementBlock } from "@/store/engine";

const PATTERN_COLORS = [
  "#ef4444", "#f59e0b", "#22c55e", "#06b6d4",
  "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1",
];

const ArrangementBlockItem = memo(function ArrangementBlockItem({
  block,
  index,
  isActive,
  isFirst,
  isLast,
  onRemove,
  onMove,
  onRepeats,
}: {
  block: ArrangementBlock;
  index: number;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onRepeats: (i: number, r: number) => void;
}) {
  const color = PATTERN_COLORS[block.patternIndex] ?? "#8b5cf6";
  const label = PATTERN_LABELS[block.patternIndex];

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 min-w-[56px] border transition-all ${
        isActive
          ? "border-white bg-white/10 shadow-lg shadow-white/5"
          : "border-border bg-surface-2 hover:bg-surface-3"
      }`}
    >
      <div
        className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onRepeats(index, block.repeats - 1)}
          className="w-4 h-4 text-[9px] rounded bg-surface-3 text-muted hover:text-foreground flex items-center justify-center"
        >
          -
        </button>
        <span className="text-[10px] font-mono text-muted w-4 text-center">
          {block.repeats}x
        </span>
        <button
          onClick={() => onRepeats(index, block.repeats + 1)}
          className="w-4 h-4 text-[9px] rounded bg-surface-3 text-muted hover:text-foreground flex items-center justify-center"
        >
          +
        </button>
      </div>

      <div className="flex gap-0.5">
        <button
          onClick={() => onMove(index, -1)}
          disabled={isFirst}
          className="w-4 h-4 text-[9px] rounded bg-surface-3 text-muted hover:text-foreground disabled:opacity-20 flex items-center justify-center"
        >
          ‹
        </button>
        <button
          onClick={() => onRemove(index)}
          className="w-4 h-4 text-[9px] rounded bg-surface-3 text-danger/60 hover:text-danger hover:bg-danger/10 flex items-center justify-center"
        >
          ×
        </button>
        <button
          onClick={() => onMove(index, 1)}
          disabled={isLast}
          className="w-4 h-4 text-[9px] rounded bg-surface-3 text-muted hover:text-foreground disabled:opacity-20 flex items-center justify-center"
        >
          ›
        </button>
      </div>
    </div>
  );
});

export function Arrangement() {
  const arrangement = useEngineStore((s) => s.arrangement);
  const arrangementMode = useEngineStore((s) => s.arrangementMode);
  const arrangementPosition = useEngineStore((s) => s.arrangementPosition);
  const setArrangementMode = useEngineStore((s) => s.setArrangementMode);
  const addArrangementBlock = useEngineStore((s) => s.addArrangementBlock);
  const removeArrangementBlock = useEngineStore((s) => s.removeArrangementBlock);
  const moveArrangementBlock = useEngineStore((s) => s.moveArrangementBlock);
  const setBlockRepeats = useEngineStore((s) => s.setBlockRepeats);
  const clearArrangement = useEngineStore((s) => s.clearArrangement);
  const patterns = useEngineStore((s) => s.patterns);

  const handleRemove = useCallback((i: number) => removeArrangementBlock(i), [removeArrangementBlock]);
  const handleMove = useCallback((i: number, d: -1 | 1) => moveArrangementBlock(i, d), [moveArrangementBlock]);
  const handleRepeats = useCallback((i: number, r: number) => setBlockRepeats(i, r), [setBlockRepeats]);

  const totalBars = arrangement.reduce((sum, b) => sum + b.repeats, 0);

  // Check which patterns have content
  const patternHasContent = patterns.map((p) =>
    p.steps.some((trackSteps) => trackSteps.some((v) => v > 0))
  );

  return (
    <div className="border-b border-border bg-surface">
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Toggle */}
        <button
          onClick={() => setArrangementMode(!arrangementMode)}
          className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
            arrangementMode
              ? "bg-accent text-white"
              : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground"
          }`}
          title="Toggle arrangement mode (Tab)"
        >
          Arrange
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-border" />

        {/* Add pattern buttons */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted uppercase tracking-wider mr-1">Add</span>
          {PATTERN_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => addArrangementBlock(i)}
              className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${
                patternHasContent[i]
                  ? "text-white hover:brightness-110"
                  : "bg-surface-3 text-muted/40 hover:text-muted"
              }`}
              style={patternHasContent[i] ? { backgroundColor: PATTERN_COLORS[i] } : undefined}
              title={`Add pattern ${label}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border" />

        {/* Stats */}
        <span className="text-[10px] text-muted font-mono">
          {arrangement.length} blocks / {totalBars} bars
        </span>

        {/* Clear */}
        {arrangement.length > 0 && (
          <button
            onClick={clearArrangement}
            className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-surface-2 text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Timeline */}
      {arrangement.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
          {arrangement.map((block, i) => (
            <ArrangementBlockItem
              key={i}
              block={block}
              index={i}
              isActive={arrangementPosition?.blockIndex === i}
              isFirst={i === 0}
              isLast={i === arrangement.length - 1}
              onRemove={handleRemove}
              onMove={handleMove}
              onRepeats={handleRepeats}
            />
          ))}

          {/* End marker */}
          <div className="flex items-center justify-center px-2 text-muted/30 text-lg select-none">
            ‖
          </div>
        </div>
      )}

      {arrangement.length === 0 && arrangementMode && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted/50 italic">
            Click pattern buttons above to build your song structure
          </p>
        </div>
      )}
    </div>
  );
}
