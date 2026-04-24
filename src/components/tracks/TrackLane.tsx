"use client";

import { useCallback } from "react";
import { useDAWStore } from "@/store/daw-store";
import { audioEngine } from "@/engine/audio-engine";
import type { Track } from "@/types";

interface TrackLaneProps {
  track: Track;
}

export default function TrackLane({ track }: TrackLaneProps) {
  const {
    selectedTrackId,
    selectTrack,
    setTrackVolume,
    toggleMute,
    toggleSolo,
    toggleArm,
  } = useDAWStore();

  const isSelected = selectedTrackId === track.id;

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setTrackVolume(track.id, vol);
      audioEngine.syncTrack({ ...track, volume: vol });
    },
    [track, setTrackVolume]
  );

  const handleMute = useCallback(() => {
    toggleMute(track.id);
  }, [track.id, toggleMute]);

  const handleSolo = useCallback(() => {
    toggleSolo(track.id);
  }, [track.id, toggleSolo]);

  const handleArm = useCallback(() => {
    toggleArm(track.id);
  }, [track.id, toggleArm]);

  return (
    <div
      className="flex items-center h-16 shrink-0 cursor-pointer transition-colors"
      style={{
        background: isSelected ? "var(--bg-tertiary)" : "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
      onClick={() => selectTrack(track.id)}
    >
      {/* Color strip */}
      <div className="w-1 h-full shrink-0" style={{ background: track.color }} />

      {/* Track info */}
      <div className="flex flex-col justify-center px-3 min-w-[120px]">
        <span className="text-xs font-medium truncate max-w-[100px]">
          {track.name}
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {track.instrumentType.toUpperCase()}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 px-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMute();
          }}
          className="w-6 h-6 rounded text-[10px] font-bold transition-colors"
          style={{
            background: track.muted ? "var(--mute)" : "var(--bg-hover)",
            color: track.muted ? "#000" : "var(--text-secondary)",
          }}
          title="Mute"
        >
          M
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSolo();
          }}
          className="w-6 h-6 rounded text-[10px] font-bold transition-colors"
          style={{
            background: track.soloed ? "var(--solo)" : "var(--bg-hover)",
            color: track.soloed ? "#000" : "var(--text-secondary)",
          }}
          title="Solo"
        >
          S
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleArm();
          }}
          className="w-6 h-6 rounded text-[10px] font-bold transition-colors"
          style={{
            background: track.armed
              ? "var(--recording-dim)"
              : "var(--bg-hover)",
            color: track.armed ? "var(--recording)" : "var(--text-secondary)",
          }}
          title="Record Arm"
        >
          R
        </button>
      </div>

      {/* Volume slider */}
      <div className="flex items-center gap-2 px-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.volume}
          onChange={handleVolumeChange}
          onClick={(e) => e.stopPropagation()}
          className="w-20"
        />
        <span
          className="text-[10px] font-mono w-8 text-right tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {Math.round(track.volume * 100)}
        </span>
      </div>
    </div>
  );
}
