"use client";

import { useEngineStore, type TrackEffects, type FilterType } from "@/store/engine";
import { memo, useCallback, useState } from "react";

// ── Knob-style mini slider ────────────────────────────────────
function MiniSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "",
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
  disabled?: boolean;
}) {
  const displayValue =
    unit === "Hz"
      ? value >= 1000
        ? `${(value / 1000).toFixed(1)}k`
        : `${Math.round(value)}`
      : unit === "s"
        ? `${value.toFixed(2)}`
        : unit === "dB"
          ? `${value.toFixed(0)}`
          : `${Math.round(value * 100)}%`;

  return (
    <div className={`flex flex-col items-center gap-0.5 ${disabled ? "opacity-30" : ""}`}>
      <span className="text-[8px] text-muted uppercase tracking-wider">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-12 h-3"
      />
      <span className="text-[8px] font-mono text-muted">
        {displayValue}
        {unit === "Hz" ? "Hz" : unit === "s" ? "s" : unit === "dB" ? "dB" : ""}
      </span>
    </div>
  );
}

// ── FX Toggle Button ──────────────────────────────────────────
function FXToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
        active
          ? "bg-accent text-white"
          : "bg-surface-2 text-muted hover:bg-surface-3"
      }`}
    >
      {label}
    </button>
  );
}

// ── Track FX Panel ────────────────────────────────────────────
const TrackFXPanel = memo(function TrackFXPanel({
  trackId,
  effects,
  color,
}: {
  trackId: number;
  effects: TrackEffects;
  color: string;
}) {
  const setTrackEffect = useEngineStore((s) => s.setTrackEffect);

  const set = useCallback(
    <K extends keyof TrackEffects>(key: K, value: TrackEffects[K]) => {
      setTrackEffect(trackId, key, value);
    },
    [trackId, setTrackEffect]
  );

  return (
    <div className="flex flex-col gap-2 p-2 bg-surface rounded border border-border">
      {/* Color bar */}
      <div className="h-0.5 w-full rounded" style={{ backgroundColor: color }} />

      {/* Filter */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <FXToggle label="FLT" active={effects.filterOn} onClick={() => set("filterOn", !effects.filterOn)} />
          <select
            value={effects.filterType}
            onChange={(e) => set("filterType", e.target.value as FilterType)}
            className="bg-surface-2 text-[9px] text-foreground rounded px-1 py-0.5 border-none outline-none"
          >
            <option value="lowpass">LP</option>
            <option value="highpass">HP</option>
          </select>
        </div>
        <div className="flex gap-1">
          <MiniSlider
            label="Freq"
            value={effects.filterFreq}
            min={20}
            max={20000}
            step={1}
            onChange={(v) => set("filterFreq", v)}
            unit="Hz"
            disabled={!effects.filterOn}
          />
          <MiniSlider
            label="Q"
            value={effects.filterQ}
            min={0.1}
            max={20}
            step={0.1}
            onChange={(v) => set("filterQ", v)}
            disabled={!effects.filterOn}
          />
        </div>
      </div>

      {/* Delay */}
      <div className="flex flex-col gap-1">
        <FXToggle label="DLY" active={effects.delayOn} onClick={() => set("delayOn", !effects.delayOn)} />
        <div className="flex gap-1">
          <MiniSlider
            label="Time"
            value={effects.delayTime}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => set("delayTime", v)}
            unit="s"
            disabled={!effects.delayOn}
          />
          <MiniSlider
            label="FB"
            value={effects.delayFeedback}
            min={0}
            max={0.9}
            step={0.01}
            onChange={(v) => set("delayFeedback", v)}
            disabled={!effects.delayOn}
          />
          <MiniSlider
            label="Wet"
            value={effects.delayWet}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => set("delayWet", v)}
            disabled={!effects.delayOn}
          />
        </div>
      </div>

      {/* Reverb */}
      <div className="flex flex-col gap-1">
        <FXToggle label="REV" active={effects.reverbOn} onClick={() => set("reverbOn", !effects.reverbOn)} />
        <div className="flex gap-1">
          <MiniSlider
            label="Decay"
            value={effects.reverbDecay}
            min={0.1}
            max={10}
            step={0.1}
            onChange={(v) => set("reverbDecay", v)}
            unit="s"
            disabled={!effects.reverbOn}
          />
          <MiniSlider
            label="Wet"
            value={effects.reverbWet}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => set("reverbWet", v)}
            disabled={!effects.reverbOn}
          />
        </div>
      </div>
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
  effects,
  fxOpen,
  onVolume,
  onMute,
  onSolo,
  onToggleFX,
}: {
  trackId: number;
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  effects: TrackEffects;
  fxOpen: boolean;
  onVolume: (id: number, vol: number) => void;
  onMute: (id: number) => void;
  onSolo: (id: number) => void;
  onToggleFX: (id: number) => void;
}) {
  const hasFX = effects.filterOn || effects.delayOn || effects.reverbOn;

  return (
    <div className="flex flex-col items-center gap-1">
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
          {volume === 0 ? "-\u221E" : `${(20 * Math.log10(volume)).toFixed(1)}`}dB
        </span>

        {/* Mute / Solo / FX */}
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

        {/* FX toggle button */}
        <button
          onClick={() => onToggleFX(trackId)}
          className={`w-full h-5 rounded text-[9px] font-bold transition-colors ${
            fxOpen
              ? "bg-accent text-white"
              : hasFX
                ? "bg-accent-dim text-white"
                : "bg-surface-2 text-muted hover:bg-surface-3"
          }`}
        >
          FX{hasFX ? " \u2022" : ""}
        </button>
      </div>

      {/* Expandable FX panel */}
      {fxOpen && (
        <TrackFXPanel trackId={trackId} effects={effects} color={color} />
      )}
    </div>
  );
});

// ── Master Bus Strip ──────────────────────────────────────────
function MasterStrip() {
  const master = useEngineStore((s) => s.master);
  const setMaster = useEngineStore((s) => s.setMaster);

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1 border-l border-border pl-3 ml-1">
      <div className="flex flex-col items-center gap-2 w-16">
        {/* Master label */}
        <div className="w-2 h-2 rounded-full bg-accent" />
        <span className="text-[10px] text-accent font-bold truncate w-full text-center">
          MASTER
        </span>

        {/* Master fader */}
        <div className="h-24 flex items-center">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={master.volume}
            onChange={(e) => setMaster("volume", Number(e.target.value))}
            className="h-20 -rotate-90 origin-center"
            style={{ width: "80px" }}
          />
        </div>

        {/* dB readout */}
        <span className="text-[10px] font-mono text-accent">
          {master.volume === 0
            ? "-\u221E"
            : `${(20 * Math.log10(master.volume)).toFixed(1)}`}dB
        </span>

        {/* Comp / Limiter toggles */}
        <div className="flex gap-1">
          <button
            onClick={() => setMaster("compressorOn", !master.compressorOn)}
            className={`w-6 h-5 rounded text-[9px] font-bold transition-colors ${
              master.compressorOn
                ? "bg-accent text-white"
                : "bg-surface-2 text-muted hover:bg-surface-3"
            }`}
          >
            C
          </button>
          <button
            onClick={() => setMaster("limiterOn", !master.limiterOn)}
            className={`w-6 h-5 rounded text-[9px] font-bold transition-colors ${
              master.limiterOn
                ? "bg-accent text-white"
                : "bg-surface-2 text-muted hover:bg-surface-3"
            }`}
          >
            L
          </button>
        </div>

        {/* Expand controls */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full h-5 rounded text-[9px] font-bold transition-colors ${
            expanded
              ? "bg-accent text-white"
              : "bg-surface-2 text-muted hover:bg-surface-3"
          }`}
        >
          {expanded ? "HIDE" : "CTRL"}
        </button>
      </div>

      {/* Expanded master controls */}
      {expanded && (
        <div className="flex flex-col gap-2 p-2 bg-surface rounded border border-border">
          <div className="h-0.5 w-full rounded bg-accent" />

          {/* Compressor */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-accent font-bold">COMPRESSOR</span>
            <div className="flex gap-1 flex-wrap">
              <MiniSlider
                label="Thresh"
                value={master.compressorThreshold}
                min={-60}
                max={0}
                step={1}
                onChange={(v) => setMaster("compressorThreshold", v)}
                unit="dB"
                disabled={!master.compressorOn}
              />
              <MiniSlider
                label="Ratio"
                value={master.compressorRatio}
                min={1}
                max={20}
                step={0.5}
                onChange={(v) => setMaster("compressorRatio", v)}
                disabled={!master.compressorOn}
              />
              <MiniSlider
                label="Atk"
                value={master.compressorAttack}
                min={0}
                max={1}
                step={0.001}
                onChange={(v) => setMaster("compressorAttack", v)}
                unit="s"
                disabled={!master.compressorOn}
              />
              <MiniSlider
                label="Rel"
                value={master.compressorRelease}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setMaster("compressorRelease", v)}
                unit="s"
                disabled={!master.compressorOn}
              />
            </div>
          </div>

          {/* Limiter */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-accent font-bold">LIMITER</span>
            <MiniSlider
              label="Ceiling"
              value={master.limiterThreshold}
              min={-30}
              max={0}
              step={1}
              onChange={(v) => setMaster("limiterThreshold", v)}
              unit="dB"
              disabled={!master.limiterOn}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mixer Panel ────────────────────────────────────────────────
export function Mixer() {
  const tracks = useEngineStore((s) => s.tracks);
  const setTrackVolume = useEngineStore((s) => s.setTrackVolume);
  const toggleMute = useEngineStore((s) => s.toggleMute);
  const toggleSolo = useEngineStore((s) => s.toggleSolo);

  const [openFX, setOpenFX] = useState<Set<number>>(new Set());

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
  const handleToggleFX = useCallback((id: number) => {
    setOpenFX((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
            effects={track.effects}
            fxOpen={openFX.has(track.id)}
            onVolume={handleVolume}
            onMute={handleMute}
            onSolo={handleSolo}
            onToggleFX={handleToggleFX}
          />
        ))}

        {/* Master bus */}
        <MasterStrip />
      </div>
    </div>
  );
}
