"use client";

import { useCallback, useMemo, useState } from "react";
import { useEngineStore, PATTERN_LABELS, MAX_PATTERNS } from "@/store/engine";
import { DEFAULT_KIT } from "@/lib/sounds";

/**
 * Pattern Matrix — Ableton-style clip launcher
 *
 * An 8×8 grid where each row is a track and each column is a pattern.
 * Click any cell to launch that pattern on that track (pattern switching
 * with per-track awareness). The matrix gives a bird's-eye view of the
 * entire song and allows live jamming across patterns.
 */

export function PatternMatrix() {
  const tracks = useEngineStore((s) => s.tracks);
  const patterns = useEngineStore((s) => s.patterns);
  const currentPattern = useEngineStore((s) => s.currentPattern);
  const setCurrentPattern = useEngineStore((s) => s.setCurrentPattern);
  const copyPattern = useEngineStore((s) => s.copyPattern);
  const playbackState = useEngineStore((s) => s.playbackState);
  const chain = useEngineStore((s) => s.chain);

  const [copySource, setCopySource] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Build density heatmap for each track×pattern cell
  const densityMap = useMemo(() => {
    const map: number[][] = [];
    for (let t = 0; t < tracks.length; t++) {
      const row: number[] = [];
      for (let p = 0; p < MAX_PATTERNS; p++) {
        const patternData = patterns[p];
        const steps = patternData?.steps[t] ?? [];
        const hits = steps.filter((v) => v > 0).length;
        row.push(hits / (steps.length || 1));
      }
      map.push(row);
    }
    return map;
  }, [patterns, tracks.length]);

  // Chain presence map
  const chainMap = useMemo(() => {
    const map = new Set<number>();
    chain.forEach((idx) => map.add(idx));
    return map;
  }, [chain]);

  const handleCellClick = useCallback(
    (trackIdx: number, patternIdx: number) => {
      if (copySource !== null) {
        copyPattern(copySource, patternIdx);
        setCopySource(null);
        return;
      }
      setCurrentPattern(patternIdx);
    },
    [copySource, copyPattern, setCurrentPattern]
  );

  const handleCopy = useCallback(() => {
    setCopySource((prev) => (prev === currentPattern ? null : currentPattern));
  }, [currentPattern]);

  return (
    <div className="flex flex-col gap-2">
      {/* Header row: pattern labels */}
      <div className="flex items-center gap-1">
        <div className="w-20 text-[9px] font-bold uppercase tracking-[0.18em] text-muted" />
        <div className="flex flex-1 gap-1">
          {PATTERN_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setCurrentPattern(i)}
              className={`flex-1 rounded-md py-1 text-[10px] font-bold transition-colors ${
                i === currentPattern
                  ? "bg-accent text-[#1a1408]"
                  : chainMap.has(i)
                    ? "bg-accent/15 text-accent"
                    : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className={`ml-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
            copySource !== null
              ? "bg-accent text-[#1a1408]"
              : "bg-surface-2 text-muted hover:bg-surface-3"
          }`}
          title="Copy pattern"
        >
          {copySource !== null ? "Cancel" : "Copy"}
        </button>
      </div>

      {/* Grid rows */}
      <div className="flex flex-col gap-1">
        {tracks.map((track, tIdx) => {
          const trackName = track.customSampleName || DEFAULT_KIT[tIdx]?.name || `T${tIdx + 1}`;
          const trackColor = DEFAULT_KIT[tIdx]?.color || "#8b5cf6";

          return (
            <div key={tIdx} className="flex items-center gap-1">
              {/* Track label */}
              <div
                className="flex w-20 items-center gap-1.5 rounded-md bg-surface-2 px-1.5 py-1"
                style={{ borderLeft: `2px solid ${trackColor}` }}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: trackColor }}
                />
                <span className="truncate text-[10px] font-semibold text-foreground">
                  {trackName}
                </span>
              </div>

              {/* Pattern cells */}
              <div className="flex flex-1 gap-1">
                {PATTERN_LABELS.map((_, pIdx) => {
                  const density = densityMap[tIdx]?.[pIdx] ?? 0;
                  const isCurrent = pIdx === currentPattern;
                  const isActive = density > 0;
                  const isInChain = chainMap.has(pIdx);

                  return (
                    <button
                      key={pIdx}
                      onClick={() => handleCellClick(tIdx, pIdx)}
                      onMouseEnter={() => setHoveredCell({ row: tIdx, col: pIdx })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`relative flex-1 overflow-hidden rounded-md transition-all ${
                        isCurrent
                          ? "ring-1 ring-accent ring-offset-1 ring-offset-background"
                          : ""
                      } ${
                        isInChain && !isCurrent
                          ? "border border-accent/20"
                          : "border border-transparent"
                      }`}
                      style={{
                        height: "28px",
                        backgroundColor: isActive
                          ? `${trackColor}${Math.round(density * 160 + 40).toString(16).padStart(2, "0")}`
                          : "var(--surface-2)",
                      }}
                      title={`${trackName} · Pattern ${PATTERN_LABELS[pIdx]} · ${Math.round(density * 100)}% density`}
                    >
                      {/* Mini step dots */}
                      <div className="absolute inset-0 flex items-center justify-center gap-[1px] px-0.5">
                        {patterns[pIdx]?.steps[tIdx]?.slice(0, 16).map((v, sIdx) => (
                          <div
                            key={sIdx}
                            className="rounded-full"
                            style={{
                              width: "2px",
                              height: v > 0 ? `${Math.max(2, v * 10)}px` : "2px",
                              backgroundColor: v > 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.08)",
                              opacity: isCurrent ? 1 : 0.6,
                            }}
                          />
                        ))}
                      </div>

                      {/* Playing indicator */}
                      {isCurrent && playbackState === "playing" && (
                        <div className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      )}

                      {/* Hover overlay */}
                      {hoveredCell?.row === tIdx && hoveredCell?.col === pIdx && (
                        <div className="absolute inset-0 bg-white/10" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-muted">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-sm bg-accent" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-sm border border-accent/30" />
          <span>In chain</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-sm bg-surface-2" />
          <span>Empty</span>
        </div>
      </div>
    </div>
  );
}
