"use client";

import { useDAWStore } from "@/store/daw-store";
import TrackLane from "./TrackLane";

export default function TrackList() {
  const { tracks, addTrack } = useDAWStore();

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: 280,
        borderRight: "1px solid var(--border-primary)",
        background: "var(--bg-secondary)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 h-8 shrink-0"
        style={{
          borderBottom: "1px solid var(--border-primary)",
          background: "var(--bg-tertiary)",
        }}
      >
        <span className="text-[10px] font-semibold tracking-wider" style={{ color: "var(--text-muted)" }}>
          TRACKS
        </span>
        <button
          onClick={() => addTrack()}
          className="text-xs px-2 py-0.5 rounded transition-colors"
          style={{
            background: "var(--accent-dim)",
            color: "var(--accent)",
          }}
        >
          + Add
        </button>
      </div>

      {/* Track Lanes */}
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="text-2xl">+</span>
            <span className="text-xs">
              Add a track to get started
            </span>
          </div>
        ) : (
          tracks.map((track) => <TrackLane key={track.id} track={track} />)
        )}
      </div>
    </div>
  );
}
