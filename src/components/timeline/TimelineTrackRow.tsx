"use client";

import type { Track } from "@/types";

interface TimelineTrackRowProps {
  track: Track;
  zoomLevel: number;
  isSelected: boolean;
}

const BEAT_WIDTH_BASE = 40;

export default function TimelineTrackRow({
  track,
  zoomLevel,
  isSelected,
}: TimelineTrackRowProps) {
  const beatWidth = BEAT_WIDTH_BASE * zoomLevel;

  return (
    <div
      className="relative h-16 shrink-0"
      style={{
        background: isSelected
          ? "rgba(108, 92, 231, 0.05)"
          : "transparent",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Clips */}
      {track.clips.map((clip) => (
        <div
          key={clip.id}
          className="absolute top-1 bottom-1 rounded-sm overflow-hidden cursor-pointer"
          style={{
            left: clip.startBeat * beatWidth,
            width: clip.durationBeats * beatWidth,
            background: `${track.color}33`,
            border: `1px solid ${track.color}66`,
          }}
        >
          <div
            className="h-1 w-full"
            style={{ background: track.color }}
          />
          <span
            className="text-[9px] px-1 truncate block"
            style={{ color: track.color }}
          >
            {clip.name}
          </span>
        </div>
      ))}
    </div>
  );
}
