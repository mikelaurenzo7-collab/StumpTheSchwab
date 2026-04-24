"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useDAWStore } from "@/store/daw-store";
import TimelineRuler from "./TimelineRuler";
import TimelineTrackRow from "./TimelineTrackRow";
import Playhead from "./Playhead";

const TOTAL_BARS = 64;
const BEAT_WIDTH_BASE = 40;

export default function Timeline() {
  const { tracks, selectedTrackId, zoomLevel, addClip } = useDAWStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollLeft(scrollRef.current.scrollLeft);
    }
  }, []);

  const handleDoubleClick = useCallback(
    (trackId: string, e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft;
      const beatWidth = BEAT_WIDTH_BASE * zoomLevel;
      const beat = Math.floor(x / beatWidth / 4) * 4;
      addClip(trackId, beat, 4);
    },
    [scrollLeft, zoomLevel, addClip]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll);
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const totalWidth = TOTAL_BARS * 4 * BEAT_WIDTH_BASE * zoomLevel;

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Ruler */}
      <TimelineRuler
        totalBars={TOTAL_BARS}
        zoomLevel={zoomLevel}
        scrollLeft={scrollLeft}
      />

      {/* Grid + Tracks */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto relative"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="relative" style={{ width: totalWidth, minHeight: "100%" }}>
          {/* Grid lines */}
          <GridLines totalBars={TOTAL_BARS} zoomLevel={zoomLevel} />

          {/* Track rows */}
          {tracks.map((track) => (
            <div
              key={track.id}
              onDoubleClick={(e) => handleDoubleClick(track.id, e)}
            >
              <TimelineTrackRow
                track={track}
                zoomLevel={zoomLevel}
                isSelected={track.id === selectedTrackId}
              />
            </div>
          ))}

          {/* Empty state */}
          {tracks.length === 0 && (
            <div
              className="flex items-center justify-center h-full min-h-[200px]"
              style={{ color: "var(--text-muted)" }}
            >
              <span className="text-sm">Add tracks to start arranging</span>
            </div>
          )}

          {/* Playhead */}
          <div className="absolute inset-0 pointer-events-none">
            <Playhead zoomLevel={zoomLevel} scrollLeft={scrollLeft} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GridLines({
  totalBars,
  zoomLevel,
}: {
  totalBars: number;
  zoomLevel: number;
}) {
  const beatWidth = BEAT_WIDTH_BASE * zoomLevel;
  const lines = [];

  for (let bar = 0; bar <= totalBars; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      const x = (bar * 4 + beat) * beatWidth;
      const isBar = beat === 0;
      lines.push(
        <div
          key={`${bar}-${beat}`}
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: x,
            background: isBar
              ? "var(--timeline-bar)"
              : "var(--timeline-beat)",
          }}
        />
      );
    }
  }

  return <div className="absolute inset-0 pointer-events-none">{lines}</div>;
}
