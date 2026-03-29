"use client";

import { useEngineStore, type FilterType } from "@/store/engine";
import { memo, useCallback } from "react";

// ── Knob (compact rotary-style range input) ───────────────────
const Knob = memo(function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  displayValue?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] text-muted uppercase tracking-wider">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="knob-input"
      />
      {displayValue && (
        <span className="text-[8px] font-mono text-muted">{displayValue}</span>
      )}
    </div>
  );
});

// ── Channel Strip ──────────────────────────────────────────────
const ChannelStrip = memo(function ChannelStrip({
  trackId,
  name,
  color,
  volume,
  muted,
  solo,
  filterFreq,
  filterType,
  reverbSend,
  delaySend,
  onVolume,
  onMute,
  onSolo,
  onFilterFreq,
  onFilterType,
  onReverbSend,
  onDelaySend,
}: {
  trackId: number;
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  filterFreq: number;
  filterType: FilterType;
  reverbSend: number;
  delaySend: number;
  onVolume: (id: number, vol: number) => void;
  onMute: (id: number) => void;
  onSolo: (id: number) => void;
  onFilterFreq: (id: number, freq: number) => void;
  onFilterType: (id: number, type: FilterType) => void;
  onReverbSend: (id: number, level: number) => void;
  onDelaySend: (id: number, level: number) => void;
}) {
  const filterTypes: FilterType[] = ["lowpass", "highpass", "bandpass"];
  const filterLabel = filterType === "lowpass" ? "LP" : filterType === "highpass" ? "HP" : "BP";

  // Log scale for filter frequency display
  const freqDisplay =
    filterFreq >= 1000
      ? `${(filterFreq / 1000).toFixed(1)}k`
      : `${Math.round(filterFreq)}`;

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[68px]">
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
        {volume === 0 ? "-\u221E" : `${(20 * Math.log10(volume)).toFixed(1)}`}dB
      </span>

      {/* Filter */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={() => {
            const nextIdx = (filterTypes.indexOf(filterType) + 1) % filterTypes.length;
            onFilterType(trackId, filterTypes[nextIdx]);
          }}
          className="w-8 h-4 rounded text-[8px] font-bold bg-surface-2 text-muted hover:bg-surface-3 transition-colors"
        >
          {filterLabel}
        </button>
        <Knob
          label="freq"
          value={Math.log2(filterFreq / 20) / Math.log2(20000 / 20)}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => onFilterFreq(trackId, 20 * Math.pow(20000 / 20, v))}
          displayValue={freqDisplay}
        />
      </div>

      {/* Send knobs */}
      <Knob
        label="rev"
        value={reverbSend}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onReverbSend(trackId, v)}
        displayValue={`${Math.round(reverbSend * 100)}%`}
      />
      <Knob
        label="dly"
        value={delaySend}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onDelaySend(trackId, v)}
        displayValue={`${Math.round(delaySend * 100)}%`}
      />

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

// ── Master Effects Panel ──────────────────────────────────────
const DELAY_TIMES = [
  { label: "1/16", value: "16n" },
  { label: "1/8t", value: "8t" },
  { label: "1/8", value: "8n" },
  { label: "1/4", value: "4n" },
];

function MasterEffects() {
  const reverbDecay = useEngineStore((s) => s.reverbDecay);
  const delayTime = useEngineStore((s) => s.delayTime);
  const delayFeedback = useEngineStore((s) => s.delayFeedback);
  const setReverbDecay = useEngineStore((s) => s.setReverbDecay);
  const setDelayTime = useEngineStore((s) => s.setDelayTime);
  const setDelayFeedback = useEngineStore((s) => s.setDelayFeedback);

  return (
    <div className="flex items-center gap-4 px-3 py-2 border-b border-border bg-surface">
      <span className="text-[10px] text-muted uppercase tracking-wider font-bold">FX Bus</span>

      {/* Reverb controls */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-accent font-bold">REV</span>
        <Knob
          label="decay"
          value={reverbDecay}
          min={0.1}
          max={10}
          step={0.1}
          onChange={setReverbDecay}
          displayValue={`${reverbDecay.toFixed(1)}s`}
        />
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Delay controls */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-accent font-bold">DLY</span>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] text-muted uppercase tracking-wider">time</span>
          <div className="flex gap-0.5">
            {DELAY_TIMES.map((dt) => (
              <button
                key={dt.value}
                onClick={() => setDelayTime(dt.value)}
                className={`px-1.5 h-4 rounded text-[8px] font-bold transition-colors ${
                  delayTime === dt.value
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-muted hover:bg-surface-3"
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>
        </div>
        <Knob
          label="fdbk"
          value={delayFeedback}
          min={0}
          max={0.95}
          step={0.01}
          onChange={setDelayFeedback}
          displayValue={`${Math.round(delayFeedback * 100)}%`}
        />
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
  const setFilterFreq = useEngineStore((s) => s.setFilterFreq);
  const setFilterType = useEngineStore((s) => s.setFilterType);
  const setReverbSend = useEngineStore((s) => s.setReverbSend);
  const setDelaySend = useEngineStore((s) => s.setDelaySend);

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
  const handleFilterFreq = useCallback(
    (id: number, freq: number) => setFilterFreq(id, freq),
    [setFilterFreq]
  );
  const handleFilterType = useCallback(
    (id: number, type: FilterType) => setFilterType(id, type),
    [setFilterType]
  );
  const handleReverbSend = useCallback(
    (id: number, level: number) => setReverbSend(id, level),
    [setReverbSend]
  );
  const handleDelaySend = useCallback(
    (id: number, level: number) => setDelaySend(id, level),
    [setDelaySend]
  );

  return (
    <div className="border-t border-border bg-surface">
      <MasterEffects />
      <div className="flex items-start gap-2 overflow-x-auto px-4 py-3">
        {tracks.map((track) => (
          <ChannelStrip
            key={track.id}
            trackId={track.id}
            name={track.sound.name}
            color={track.sound.color}
            volume={track.volume}
            muted={track.muted}
            solo={track.solo}
            filterFreq={track.filterFreq}
            filterType={track.filterType}
            reverbSend={track.reverbSend}
            delaySend={track.delaySend}
            onVolume={handleVolume}
            onMute={handleMute}
            onSolo={handleSolo}
            onFilterFreq={handleFilterFreq}
            onFilterType={handleFilterType}
            onReverbSend={handleReverbSend}
            onDelaySend={handleDelaySend}
          />
        ))}
      </div>
    </div>
  );
}
