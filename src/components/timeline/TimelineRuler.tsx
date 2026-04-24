"use client";

import { useMemo } from "react";

interface TimelineRulerProps {
  totalBars: number;
  zoomLevel: number;
  scrollLeft: number;
}

const BEAT_WIDTH_BASE = 40;

export default function TimelineRuler({
  totalBars,
  zoomLevel,
  scrollLeft,
}: TimelineRulerProps) {
  const beatWidth = BEAT_WIDTH_BASE * zoomLevel;

  const markers = useMemo(() => {
    const result = [];
    for (let bar = 1; bar <= totalBars; bar++) {
      for (let beat = 0; beat < 4; beat++) {
        const x = ((bar - 1) * 4 + beat) * beatWidth;
        const isBar = beat === 0;
        result.push(
          <div
            key={`${bar}-${beat}`}
            className="absolute top-0 h-full flex flex-col justify-end"
            style={{ left: x }}
          >
            <div
              className="w-px"
              style={{
                height: isBar ? "100%" : "40%",
                background: isBar
                  ? "var(--timeline-bar)"
                  : "var(--timeline-beat)",
              }}
            />
            {isBar && (
              <span
                className="absolute top-0.5 left-1 text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {bar}
              </span>
            )}
          </div>
        );
      }
    }
    return result;
  }, [totalBars, beatWidth]);

  return (
    <div
      className="relative h-6 shrink-0 overflow-hidden"
      style={{
        background: "var(--bg-tertiary)",
        borderBottom: "1px solid var(--border-primary)",
      }}
    >
      <div
        className="relative h-full"
        style={{
          width: totalBars * 4 * beatWidth,
          transform: `translateX(-${scrollLeft}px)`,
        }}
      >
        {markers}
      </div>
    </div>
  );
}
