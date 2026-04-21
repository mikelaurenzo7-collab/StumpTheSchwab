"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEngineStore, PATTERN_LABELS, MAX_PATTERNS } from "@/store/engine";

const PATTERN_COLORS = [
  "#7c3aed", "#2563eb", "#059669", "#d97706",
  "#dc2626", "#db2777", "#0891b2", "#ea580c",
];

export function ArrangementView() {
  const arrangement = useEngineStore((s) => s.arrangement);
  const arrangementMode = useEngineStore((s) => s.arrangementMode);
  const arrangementPosition = useEngineStore((s) => s.arrangementPosition);
  const playbackState = useEngineStore((s) => s.playbackState);
  const addArrangementSlot = useEngineStore((s) => s.addArrangementSlot);
  const removeArrangementSlot = useEngineStore((s) => s.removeArrangementSlot);
  const setArrangementSlotPattern = useEngineStore((s) => s.setArrangementSlotPattern);
  const clearArrangement = useEngineStore((s) => s.clearArrangement);

  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSlotClick = useCallback(
    (index: number) => {
      const nextPatternId = (arrangement[index].patternId + 1) % MAX_PATTERNS;
      setArrangementSlotPattern(index, nextPatternId);
    },
    [arrangement, setArrangementSlotPattern]
  );

  const handleSlotRightClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      if (arrangement.length > 1) {
        removeArrangementSlot(index);
      }
    },
    [arrangement.length, removeArrangementSlot]
  );

  const handleAdd = useCallback(() => {
    const lastPatternId =
      arrangement.length > 0
        ? arrangement[arrangement.length - 1].patternId
        : 0;
    addArrangementSlot(lastPatternId);
  }, [arrangement, addArrangementSlot]);

  useEffect(() => {
    if (playbackState === "playing" && scrollRef.current) {
      const active = scrollRef.current.children[arrangementPosition] as HTMLElement;
      if (active) {
        active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [arrangementPosition, playbackState]);

  if (!arrangementMode) return null;

  const isPlaying = playbackState === "playing";

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#0e0e14] border-b border-border min-h-[48px]">
      <span className="text-[10px] text-muted uppercase tracking-widest shrink-0 font-bold select-none">
        Song
      </span>

      <div ref={scrollRef} className="flex gap-1 overflow-x-auto py-1 flex-1 scrollbar-thin">
        {arrangement.map((slot, i) => {
          const isActive = isPlaying && i === arrangementPosition;
          const color = PATTERN_COLORS[slot.patternId];
          return (
            <button
              key={i}
              onClick={() => handleSlotClick(i)}
              onContextMenu={(e) => handleSlotRightClick(e, i)}
              className={`
                shrink-0 w-11 h-9 rounded-md text-[11px] font-bold transition-all
                flex flex-col items-center justify-center leading-none border
                ${isActive
                  ? "ring-2 ring-white shadow-lg shadow-white/10 scale-105 border-white/30"
                  : "border-white/10 hover:border-white/25 hover:scale-[1.02]"
                }
              `}
              style={{
                backgroundColor: isActive ? color : `${color}66`,
                opacity: isActive ? 1 : 0.85,
              }}
              title={`Bar ${i + 1}: Pattern ${PATTERN_LABELS[slot.patternId]} — Click to cycle, right-click to remove`}
            >
              <span className="text-white font-bold drop-shadow-sm">
                {PATTERN_LABELS[slot.patternId]}
              </span>
              <span className="text-white/40 text-[8px] font-mono">{i + 1}</span>
            </button>
          );
        })}

        <button
          onClick={handleAdd}
          className="shrink-0 w-9 h-9 rounded-md bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground text-lg transition-all flex items-center justify-center border border-dashed border-border hover:border-muted"
          title="Add bar"
        >
          +
        </button>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted font-mono tabular-nums">
          {arrangement.length} bar{arrangement.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={clearArrangement}
          className="text-[10px] text-muted hover:text-danger uppercase tracking-wider transition-colors font-bold"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
