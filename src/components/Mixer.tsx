"use client";

import { useEngineStore } from "@/store/engine";
import { memo, useCallback } from "react";

// ── Channel Strip ──────────────────────────────────────────────
const ChannelStrip = memo(function ChannelStrip({
  trackId,
  name,
  color,
  volume,
  muted,
  solo,
  onVolume,
  onMute,
  onSolo,
}: {
  trackId: number;
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  onVolume: (id: number, vol: number) => void;
  onMute: (id: number) => void;
  onSolo: (id: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 w-16">
      {/* Track color dot + name */}
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] text-muted truncate w-full text-center">
        {name}
      </span>

      {/* Fader */}
      <div className="h-24 flex items-center">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolume(trackId, Number(e.target.value))}
          className="h-20 -rotate-90 origin-center"
          style={{ width: "80px" }}
        />
      </div>

      {/* dB readout */}
      <span className="text-[10px] font-mono text-muted">
        {volume === 0 ? "-∞" : `${(20 * Math.log10(volume)).toFixed(1)}`}dB
      </span>

      {/* Mute / Solo */}
      <div className="flex gap-1">
        <button
          onClick={() => onMute(trackId)}
          className={`w-6 h-5 rounded text-[10px] font-bold transition-colors ${
            muted
              ? "bg-danger text-white"
              : "bg-surface-2 text-muted hover:bg-surface-3"
          }`}
        >
          M
        </button>
        <button
          onClick={() => onSolo(trackId)}
          className={`w-6 h-5 rounded text-[10px] font-bold transition-colors ${
            solo
              ? "bg-warning text-black"
              : "bg-surface-2 text-muted hover:bg-surface-3"
          }`}
        >
          S
        </button>
      </div>
    </div>
  );
});

// ── Mixer Panel ────────────────────────────────────────────────
export function Mixer() {
  const tracks = useEngineStore((s) => s.tracks);
  const setTrackVolume = useEngineStore((s) => s.setTrackVolume);
  const toggleMute = useEngineStore((s) => s.toggleMute);
  const toggleSolo = useEngineStore((s) => s.toggleSolo);

  const handleVolume = useCallback(
    (id: number, vol: number) => setTrackVolume(id, vol),
    [setTrackVolume]
  );
  const handleMute = useCallback(
    (id: number) => toggleMute(id),
    [toggleMute]
  );
  const handleSolo = useCallback(
    (id: number) => toggleSolo(id),
    [toggleSolo]
  );

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="flex items-start gap-2 overflow-x-auto">
        {tracks.map((track) => (
          <ChannelStrip
            key={track.id}
            trackId={track.id}
            name={track.sound.name}
            color={track.sound.color}
            volume={track.volume}
            muted={track.muted}
            solo={track.solo}
            onVolume={handleVolume}
            onMute={handleMute}
            onSolo={handleSolo}
          />
        ))}
      </div>
    </div>
  );
}
