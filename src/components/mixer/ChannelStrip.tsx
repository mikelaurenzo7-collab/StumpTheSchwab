"use client";

import { useCallback } from "react";
import { useDAWStore } from "@/store/daw-store";
import { audioEngine } from "@/engine/audio-engine";
import type { Track } from "@/types";

interface ChannelStripProps {
  track: Track;
}

export default function ChannelStrip({ track }: ChannelStripProps) {
  const {
    selectedTrackId,
    selectTrack,
    setTrackVolume,
    setTrackPan,
    toggleMute,
    toggleSolo,
  } = useDAWStore();

  const isSelected = selectedTrackId === track.id;
  const volumeDb = track.volume === 0 ? "-inf" : `${Math.round(20 * Math.log10(track.volume))}`;

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setTrackVolume(track.id, vol);
      audioEngine.syncTrack({ ...track, volume: vol });
    },
    [track, setTrackVolume]
  );

  const handlePanChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const pan = parseFloat(e.target.value);
      setTrackPan(track.id, pan);
      audioEngine.syncTrack({ ...track, pan });
    },
    [track, setTrackPan]
  );

  return (
    <div
      className="flex flex-col items-center gap-2 px-3 py-3 rounded-lg shrink-0 cursor-pointer transition-colors"
      style={{
        width: 80,
        background: isSelected ? "var(--bg-tertiary)" : "var(--bg-secondary)",
        border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-primary)"}`,
      }}
      onClick={() => selectTrack(track.id)}
    >
      {/* Track color + name */}
      <div className="flex flex-col items-center gap-1 w-full">
        <div
          className="w-full h-1 rounded-full"
          style={{ background: track.color }}
        />
        <span className="text-[10px] font-medium truncate w-full text-center">
          {track.name}
        </span>
      </div>

      {/* Pan knob */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
          PAN
        </span>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={track.pan}
          onChange={handlePanChange}
          onClick={(e) => e.stopPropagation()}
          className="w-14"
        />
        <span
          className="text-[9px] font-mono tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {track.pan === 0
            ? "C"
            : track.pan < 0
              ? `L${Math.abs(Math.round(track.pan * 100))}`
              : `R${Math.round(track.pan * 100)}`}
        </span>
      </div>

      {/* Fader */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        <div className="relative h-28 flex items-center justify-center">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            onChange={handleVolumeChange}
            onClick={(e) => e.stopPropagation()}
            className="h-24"
            style={{
              writingMode: "vertical-lr",
              direction: "rtl",
              WebkitAppearance: "slider-vertical",
            }}
          />
        </div>
        <span
          className="text-[9px] font-mono tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {volumeDb} dB
        </span>
      </div>

      {/* Mute / Solo */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMute(track.id);
          }}
          className="w-7 h-6 rounded text-[10px] font-bold transition-colors"
          style={{
            background: track.muted ? "var(--mute)" : "var(--bg-hover)",
            color: track.muted ? "#000" : "var(--text-secondary)",
          }}
        >
          M
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleSolo(track.id);
          }}
          className="w-7 h-6 rounded text-[10px] font-bold transition-colors"
          style={{
            background: track.soloed ? "var(--solo)" : "var(--bg-hover)",
            color: track.soloed ? "#000" : "var(--text-secondary)",
          }}
        >
          S
        </button>
      </div>
    </div>
  );
}
