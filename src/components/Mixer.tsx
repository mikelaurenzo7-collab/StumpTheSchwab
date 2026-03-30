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

// ── Effects Rack ──────────────────────────────────────────────
function EffectsRack() {
  const reverbWet = useEngineStore((s) => s.reverbWet);
  const delayWet = useEngineStore((s) => s.delayWet);
  const delayFeedback = useEngineStore((s) => s.delayFeedback);
  const delayTime = useEngineStore((s) => s.delayTime);
  const setReverbWet = useEngineStore((s) => s.setReverbWet);
  const setDelayWet = useEngineStore((s) => s.setDelayWet);
  const setDelayFeedback = useEngineStore((s) => s.setDelayFeedback);
  const setDelayTime = useEngineStore((s) => s.setDelayTime);

  return (
    <div className="flex items-start gap-6 pl-4 border-l border-border">
      {/* Reverb */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] text-accent uppercase tracking-wider font-bold">
          Reverb
        </span>
        <div className="h-24 flex items-center">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={reverbWet}
            onChange={(e) => setReverbWet(Number(e.target.value))}
            className="h-20 -rotate-90 origin-center"
            style={{ width: "80px" }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted">
          {Math.round(reverbWet * 100)}%
        </span>
      </div>

      {/* Delay */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] text-accent uppercase tracking-wider font-bold">
          Delay
        </span>
        <div className="h-24 flex items-center">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={delayWet}
            onChange={(e) => setDelayWet(Number(e.target.value))}
            className="h-20 -rotate-90 origin-center"
            style={{ width: "80px" }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted">
          {Math.round(delayWet * 100)}%
        </span>
      </div>

      {/* Delay Feedback */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] text-muted uppercase tracking-wider">
          Fdbk
        </span>
        <div className="h-24 flex items-center">
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.01}
            value={delayFeedback}
            onChange={(e) => setDelayFeedback(Number(e.target.value))}
            className="h-20 -rotate-90 origin-center"
            style={{ width: "80px" }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted">
          {Math.round(delayFeedback * 100)}%
        </span>
      </div>

      {/* Delay Time */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] text-muted uppercase tracking-wider">
          Time
        </span>
        <select
          value={delayTime}
          onChange={(e) => setDelayTime(e.target.value)}
          className="bg-surface-2 border border-border rounded px-1.5 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-accent mt-1"
        >
          <option value="16n">1/16</option>
          <option value="8n">1/8</option>
          <option value="8n.">1/8d</option>
          <option value="4n">1/4</option>
          <option value="4n.">1/4d</option>
        </select>
      </div>
    </div>
  );
}

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

        {/* Effects Rack */}
        <EffectsRack />
      </div>
    </div>
  );
}
