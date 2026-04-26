"use client";

import {
  useEngineStore,
  type TrackEffects,
  type FilterType,
  type LfoRate,
  type LfoShape,
  type ModLfoTarget,
  LFO_RATES,
  LFO_SHAPES,
  MOD_LFO_TARGETS,
} from "@/store/engine";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpectrumAnalyzer } from "./SpectrumAnalyzer";
import { Spectrum3D } from "./Spectrum3D";
import { SoundEditor } from "./SoundEditor";

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
interface FXPanelTrackInfo {
  id: number;
  name: string;
  color: string;
}

const TrackFXPanel = memo(function TrackFXPanel({
  trackId,
  effects,
  color,
  allTracks,
}: {
  trackId: number;
  effects: TrackEffects;
  color: string;
  allTracks: FXPanelTrackInfo[];
}) {
  const setTrackEffect = useEngineStore((s) => s.setTrackEffect);

  const set = useCallback(
    <K extends keyof TrackEffects>(key: K, value: TrackEffects[K]) => {
      setTrackEffect(trackId, key, value);
    },
    [trackId, setTrackEffect]
  );

  return (
    <div className="panel-soft flex flex-col gap-2 rounded-md p-2">
      {/* Color bar */}
      <div className="h-0.5 w-full rounded" style={{ backgroundColor: color }} />

      {/* Drive — analog-style saturation. Pre-filter so EQ can tame the harmonics. */}
      <div className="flex flex-col gap-1">
        <FXToggle label="DRV" active={effects.driveOn} onClick={() => set("driveOn", !effects.driveOn)} />
        <div className="flex gap-1">
          <MiniSlider
            label="Amount"
            value={effects.driveAmount}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => set("driveAmount", v)}
            disabled={!effects.driveOn}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <FXToggle label="FLT" active={effects.filterOn} onClick={() => set("filterOn", !effects.filterOn)} />
          <select
            value={effects.filterType}
            onChange={(e) => set("filterType", e.target.value as FilterType)}
            className="control-select rounded px-1 py-0.5 text-[9px]"
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

      {/* Auto-pan LFO — tempo-synced. Oscillates around the manual pan
          center, so users can park a track left and have it wobble around
          there. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <FXToggle label="LFO" active={effects.panLfoOn} onClick={() => set("panLfoOn", !effects.panLfoOn)} />
          <select
            value={effects.panLfoShape}
            onChange={(e) => set("panLfoShape", e.target.value as LfoShape)}
            disabled={!effects.panLfoOn}
            className="control-select rounded px-1 py-0.5 text-[9px] disabled:opacity-40"
          >
            {LFO_SHAPES.map((s) => (
              <option key={s} value={s}>{s.slice(0, 3)}</option>
            ))}
          </select>
          <select
            value={effects.panLfoRate}
            onChange={(e) => set("panLfoRate", e.target.value as LfoRate)}
            disabled={!effects.panLfoOn}
            className="control-select rounded px-1 py-0.5 text-[9px] disabled:opacity-40"
          >
            {LFO_RATES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          <MiniSlider
            label="Width"
            value={effects.panLfoDepth}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => set("panLfoDepth", v)}
            disabled={!effects.panLfoOn}
          />
        </div>
      </div>

      {/* Parametric Mod LFO — routable to filter / drive / delay / reverb /
          volume. Adds an evolving, modular feel to any patch. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <FXToggle label="MOD" active={effects.modLfoOn} onClick={() => set("modLfoOn", !effects.modLfoOn)} />
          <select
            value={effects.modLfoTarget}
            onChange={(e) => set("modLfoTarget", e.target.value as ModLfoTarget)}
            disabled={!effects.modLfoOn}
            className="control-select rounded px-1 py-0.5 text-[9px] disabled:opacity-40"
            title="Modulation destination"
          >
            {MOD_LFO_TARGETS.map((t) => (
              <option key={t} value={t}>
                {t === "filterFreq" ? "Filter" : t === "delayFeedback" ? "Dly Fb" : t === "reverbWet" ? "Verb" : t === "drive" ? "Drive" : "Vol"}
              </option>
            ))}
          </select>
          <select
            value={effects.modLfoShape}
            onChange={(e) => set("modLfoShape", e.target.value as LfoShape)}
            disabled={!effects.modLfoOn}
            className="control-select rounded px-1 py-0.5 text-[9px] disabled:opacity-40"
          >
            {LFO_SHAPES.map((s) => (
              <option key={s} value={s}>{s.slice(0, 3)}</option>
            ))}
          </select>
          <select
            value={effects.modLfoRate}
            onChange={(e) => set("modLfoRate", e.target.value as LfoRate)}
            disabled={!effects.modLfoOn}
            className="control-select rounded px-1 py-0.5 text-[9px] disabled:opacity-40"
          >
            {LFO_RATES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          <MiniSlider
            label="Depth"
            value={effects.modLfoDepth}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => set("modLfoDepth", v)}
            disabled={!effects.modLfoOn}
          />
        </div>
      </div>

      {/* Sidechain — kick→bass pump. Pick a source track; this track ducks
          when the source fires. Classic house/EDM gluing trick. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <FXToggle label="SC" active={effects.sidechainOn} onClick={() => set("sidechainOn", !effects.sidechainOn)} />
          <span className="text-[8px] uppercase tracking-wider text-muted">Source</span>
        </div>
        <div className="flex flex-wrap gap-0.5">
          {allTracks
            .filter((t) => t.id !== trackId)
            .map((t) => {
              const active = effects.sidechainSource === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() =>
                    set("sidechainSource", active ? null : t.id)
                  }
                  disabled={!effects.sidechainOn}
                  className={`rounded px-1 py-0.5 text-[8px] font-bold transition-colors ${
                    active
                      ? "text-white"
                      : "button-secondary"
                   } ${!effects.sidechainOn ? "opacity-30 cursor-not-allowed" : ""}`}
                  style={active ? { backgroundColor: t.color } : undefined}
                  title={`Duck when ${t.name} fires`}
                >
                  {t.name.slice(0, 4)}
                </button>
              );
            })}
        </div>
        <div className="flex gap-1">
          <MiniSlider
            label="Depth"
            value={effects.sidechainDepth}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => set("sidechainDepth", v)}
            disabled={!effects.sidechainOn || effects.sidechainSource === null}
          />
          <MiniSlider
            label="Rel"
            value={effects.sidechainRelease}
            min={0.02}
            max={0.5}
            step={0.01}
            onChange={(v) => set("sidechainRelease", v)}
            unit="s"
            disabled={!effects.sidechainOn || effects.sidechainSource === null}
          />
        </div>
      </div>
    </div>
  );
});

// ── Level Meter ──────────────────────────────────────────────
function LevelMeter({ getLevel, color }: { getLevel: () => number; color: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  const peakRef = useRef<HTMLDivElement>(null);
  const peakVal = useRef(-Infinity);
  const peakHold = useRef(0);

  useEffect(() => {
    let raf: number;
    const update = () => {
      const db = getLevel();
      // Map dB to percentage: -60dB = 0%, 0dB = 100%
      const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));

      if (barRef.current) {
        barRef.current.style.height = `${pct}%`;
        if (db > -6) {
          barRef.current.style.backgroundColor = "var(--danger)";
        } else if (db > -12) {
          barRef.current.style.backgroundColor = "var(--warning)";
        } else {
          barRef.current.style.backgroundColor = color;
        }
      }

      // Peak hold
      if (db > peakVal.current) {
        peakVal.current = db;
        peakHold.current = 30;
      } else {
        peakHold.current--;
        if (peakHold.current <= 0) {
          peakVal.current -= 1.5;
        }
      }

      if (peakRef.current) {
        const peakPct = Math.max(0, Math.min(100, ((peakVal.current + 60) / 60) * 100));
        peakRef.current.style.bottom = `${peakPct}%`;
        peakRef.current.style.opacity = peakPct > 0 ? "1" : "0";
      }

      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [getLevel, color]);

  return (
    <div className="relative h-24 w-2.5 overflow-hidden rounded-full border border-border bg-surface-2/80">
      <div
        ref={barRef}
        className="absolute bottom-0 left-0 w-full rounded-full transition-[height] duration-75"
        style={{ height: "0%", backgroundColor: color }}
      />
      <div
        ref={peakRef}
        className="absolute left-0 w-full h-px bg-foreground opacity-0"
        style={{ bottom: "0%" }}
      />
    </div>
  );
}

// ── Pan display helper ────────────────────────────────────────
function panDisplay(pan: number): string {
  if (Math.abs(pan) < 0.01) return "C";
  const pct = Math.round(Math.abs(pan) * 100);
  return pan < 0 ? `L${pct}` : `R${pct}`;
}

// ── Channel Strip ──────────────────────────────────────────────
const NOTE_LENGTH_PRESETS: { label: string; value: number; title: string }[] = [
  { label: "·", value: 0.1, title: "Staccato (0.1× step)" },
  { label: "‒", value: 0.5, title: "Half (0.5× step)" },
  { label: "—", value: 1.0, title: "Legato / full step" },
];

const ChannelStrip = memo(function ChannelStrip({
  trackId,
  name,
  color,
  volume,
  pan,
  muted,
  solo,
  effects,
  fxOpen,
  hasSample,
  sampleName,
  noteLength,
  allTracks,
  getLevel,
  onVolume,
  onPan,
  onMute,
  onSolo,
  onToggleFX,
  onLoadSample,
  onClearSample,
  onNoteLength,
  onEditSound,
}: {
  trackId: number;
  name: string;
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  effects: TrackEffects;
  fxOpen: boolean;
  hasSample: boolean;
  sampleName: string | null;
  noteLength: number;
  allTracks: FXPanelTrackInfo[];
  getLevel: () => number;
  onVolume: (id: number, vol: number) => void;
  onPan: (id: number, pan: number) => void;
  onMute: (id: number) => void;
  onSolo: (id: number) => void;
  onToggleFX: (id: number) => void;
  onLoadSample: (id: number) => void;
  onClearSample: (id: number) => void;
  onNoteLength: (id: number, length: number) => void;
  onEditSound: (id: number) => void;
}) {
  const hasFX =
    effects.driveOn ||
    effects.filterOn ||
    effects.delayOn ||
    effects.reverbOn ||
    effects.sidechainOn ||
    effects.panLfoOn ||
    effects.modLfoOn;

  // Brief flash on the track dot when this track is performance-triggered
  // (Q-I keys). The audio engine dispatches "sts-track-trigger" with the
  // track index; flash fades via CSS transition.
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    const onTrigger = (e: Event) => {
      const ev = e as CustomEvent<{ index: number }>;
      if (ev.detail?.index !== trackId) return;
      setFlashing(true);
      window.setTimeout(() => setFlashing(false), 120);
    };
    window.addEventListener("sts-track-trigger", onTrigger);
    return () => window.removeEventListener("sts-track-trigger", onTrigger);
  }, [trackId]);

  return (
    <div className="flex snap-start flex-col items-center gap-1.5">
      <div className="panel-soft flex w-[4.9rem] flex-col items-center gap-2.5 rounded-lg px-2.5 py-3">
        {/* Track color dot + name */}
        <div className="flex w-full flex-col items-center gap-1 rounded-md border border-border bg-background-2 px-2 py-2">
          <div
            className="rounded-full transition-all duration-100"
            style={{
              width: flashing ? "10px" : "8px",
              height: flashing ? "10px" : "8px",
              backgroundColor: color,
              boxShadow: flashing ? `0 0 12px 2px ${color}` : "none",
            }}
          />
          <span className="w-full truncate text-center text-[10px] font-semibold text-soft">
            {hasSample ? sampleName ?? "Sample" : name}
          </span>
        </div>

        {/* Sample load / clear */}
        <div className="flex w-full gap-0.5 justify-center">
          <button
            onClick={() => onLoadSample(trackId)}
            className={`flex-1 h-5 rounded-lg text-[8px] font-bold transition-colors ${
              hasSample
                ? "bg-success/30 text-success"
                : "button-secondary"
             }`}
            title={hasSample ? `Loaded: ${sampleName}` : "Load audio sample (.wav, .mp3, .ogg)"}
          >
            {hasSample ? "SMP" : "SMP"}
          </button>
          {hasSample && (
            <button
              onClick={() => onClearSample(trackId)}
              className="button-secondary h-5 w-5 rounded-lg text-[8px] font-bold hover:bg-danger/20 hover:text-danger"
              title="Clear sample — revert to built-in synth"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sound editor — tweak synth params, swap voice */}
        <button
          onClick={() => onEditSound(trackId)}
          className="button-secondary h-5 w-full rounded-lg text-[8px] font-bold tracking-wider"
          title="Edit synth parameters (oscillator, envelope, filter, …)"
          disabled={hasSample}
        >
          {hasSample ? "SMP MODE" : "EDIT SOUND"}
        </button>

        {/* Note length — staccato / half / legato. Cycles with one click. */}
        <div className="flex w-full gap-0.5 justify-center" title={`Note length: ${noteLength.toFixed(2)}× step`}>
          {NOTE_LENGTH_PRESETS.map((p) => {
            const active = Math.abs(noteLength - p.value) < 0.05;
            return (
              <button
                key={p.value}
                onClick={() => onNoteLength(trackId, p.value)}
                className={`flex-1 h-4 rounded-lg text-[10px] leading-none font-bold transition-colors ${
                  active
                    ? "bg-accent text-white"
                    : "button-secondary"
                 }`}
                title={p.title}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Pan knob */}
        <div className="flex w-full flex-col items-center gap-0.5 rounded-md border border-border bg-background-2 px-1.5 py-2">
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={pan}
            onChange={(e) => onPan(trackId, Number(e.target.value))}
            onDoubleClick={() => onPan(trackId, 0)}
            className="w-12 h-2"
            title={`Pan: ${panDisplay(pan)} (double-click to center)`}
          />
          <span className="text-[8px] font-mono text-muted">
            {panDisplay(pan)}
          </span>
        </div>

        {/* Fader + Meter */}
        <div className="flex h-28 items-center gap-1 rounded-md border border-border bg-background-2 px-1.5 py-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolume(trackId, Number(e.target.value))}
            className="h-24 -rotate-90 origin-center"
            style={{ width: "92px" }}
          />
          <LevelMeter getLevel={getLevel} color={color} />
        </div>

        {/* dB readout */}
        <span className="text-[10px] font-mono text-muted">
          {volume === 0 ? "-\u221E" : `${(20 * Math.log10(volume)).toFixed(1)}`}dB
        </span>

        {/* Mute / Solo / FX */}
        <div className="flex gap-1">
          <button
            onClick={() => onMute(trackId)}
            className={`h-6 w-7 rounded-lg text-[10px] font-bold transition-colors ${
              muted
                ? "bg-danger text-white"
                : "button-secondary"
             }`}
          >
            M
          </button>
          <button
            onClick={() => onSolo(trackId)}
            className={`h-6 w-7 rounded-lg text-[10px] font-bold transition-colors ${
              solo
                ? "bg-warning text-black"
                : "button-secondary"
             }`}
          >
            S
          </button>
        </div>

        {/* FX toggle button */}
        <button
          onClick={() => onToggleFX(trackId)}
          className={`h-6 w-full rounded-lg text-[9px] font-bold transition-colors ${
            fxOpen
              ? "bg-accent text-white"
              : hasFX
                ? "bg-accent-dim text-white"
                : "button-secondary"
             }`}
        >
          FX{hasFX ? " \u2022" : ""}
        </button>
      </div>

      {/* Expandable FX panel */}
      {fxOpen && (
        <TrackFXPanel
          trackId={trackId}
          effects={effects}
          color={color}
          allTracks={allTracks}
        />
      )}
    </div>
  );
});

// ── Master Bus Strip ──────────────────────────────────────────
function MasterStrip({ getLevel, getLoudness, getTruePeak }: { getLevel: () => number; getLoudness?: () => number; getTruePeak?: () => number }) {
  const master = useEngineStore((s) => s.master);
  const setMaster = useEngineStore((s) => s.setMaster);
  const autoMix = useEngineStore((s) => s.autoMix);

  const [expanded, setExpanded] = useState(false);

  // LUFS + TruePeak live readout
  const [lufs, setLufs] = useState(-Infinity);
  const [truePeak, setTruePeak] = useState(-Infinity);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 200) return; // 5fps for text readouts
      last = t;
      if (getLoudness) setLufs(getLoudness());
      if (getTruePeak) setTruePeak(getTruePeak());
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getLoudness, getTruePeak]);

  const lufsColor = lufs > -8 ? "text-red-400" : lufs > -14 ? "text-amber-300" : "text-emerald-400";
  const tpColor = truePeak > -1 ? "text-red-400" : truePeak > -3 ? "text-amber-300" : "text-emerald-400";

  return (
    <div className="ml-1 flex flex-col items-center gap-1.5 border-l border-border pl-3">
      <div className="panel-soft flex w-[5rem] flex-col items-center gap-2.5 rounded-lg px-2.5 py-3">
        {/* Master label and Auto-Mix */}
        <div className="flex w-full flex-col items-center gap-1 rounded-md border border-border bg-background-2 px-2 py-2">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span className="w-full truncate text-center text-[10px] font-bold text-accent">
            MASTER
          </span>
        </div>
        
        <button
          onClick={autoMix}
          className="button-primary w-full rounded-lg px-1 py-1.5 text-[9px] font-bold uppercase tracking-wider"
          title="AI Auto-Mix: Intelligently balance levels, panning, and master FX"
        >
          ✨ Auto-Mix
        </button>

        {/* Master fader + Meter */}
        <div className="flex h-28 items-center gap-1 rounded-md border border-border bg-background-2 px-1.5 py-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={master.volume}
            onChange={(e) => setMaster("volume", Number(e.target.value))}
            className="h-24 -rotate-90 origin-center"
            style={{ width: "92px" }}
          />
          <LevelMeter getLevel={getLevel} color="var(--accent)" />
        </div>

        {/* dB readout */}
        <span className="text-[10px] font-mono text-accent">
          {master.volume === 0
            ? "-\u221E"
            : `${(20 * Math.log10(master.volume)).toFixed(1)}`}dB
        </span>

        {/* LUFS + TruePeak readout — pro mastering meters */}
        <div className="flex w-full flex-col items-center gap-0.5 rounded-md border border-border bg-background-2 px-1.5 py-1.5">
          <div className="flex w-full items-center justify-between">
            <span className="text-[7px] uppercase tracking-wider text-muted">LUFS</span>
            <span className={`text-[9px] font-mono font-bold ${lufsColor}`}>
              {!Number.isFinite(lufs) ? "—∞" : `${lufs.toFixed(1)}`}
            </span>
          </div>
          <div className="flex w-full items-center justify-between">
            <span className="text-[7px] uppercase tracking-wider text-muted">TP</span>
            <span className={`text-[9px] font-mono font-bold ${tpColor}`}>
              {!Number.isFinite(truePeak) ? "—∞" : `${truePeak.toFixed(1)}`}dB
            </span>
          </div>
        </div>

        {/* EQ / Comp / Limiter toggles */}
        <div className="flex gap-1">
          <button
            onClick={() => setMaster("eqOn", !master.eqOn)}
            className={`h-6 w-6 rounded-lg text-[9px] font-bold transition-colors ${
              master.eqOn
                ? "bg-accent text-white"
                : "button-secondary"
              }`}
            title="Master 3-band EQ"
          >
            EQ
          </button>
          <button
            onClick={() => setMaster("compressorOn", !master.compressorOn)}
            className={`h-6 w-6 rounded-lg text-[9px] font-bold transition-colors ${
              master.compressorOn
                ? "bg-accent text-white"
                : "button-secondary"
              }`}
            title="Master compressor"
          >
            C
          </button>
          <button
            onClick={() => setMaster("limiterOn", !master.limiterOn)}
            className={`h-6 w-6 rounded-lg text-[9px] font-bold transition-colors ${
              master.limiterOn
                ? "bg-accent text-white"
                : "button-secondary"
              }`}
            title="Brickwall limiter"
          >
            L
          </button>
        </div>

        {/* Expand controls */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`h-6 w-full rounded-lg text-[9px] font-bold transition-colors ${
            expanded
              ? "bg-accent text-white"
              : "button-secondary"
            }`}
        >
          {expanded ? "HIDE" : "CTRL"}
        </button>
      </div>

      {/* Expanded master controls */}
      {expanded && (
        <div className="panel-soft flex flex-col gap-2 rounded-md p-2">
          <div className="h-0.5 w-full rounded bg-accent" />

          {/* EQ */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-accent font-bold">EQ (3-BAND)</span>
            <div className="flex gap-1">
              <MiniSlider
                label="Low"
                value={master.eqLow}
                min={-24}
                max={24}
                step={0.5}
                onChange={(v) => setMaster("eqLow", v)}
                unit="dB"
                disabled={!master.eqOn}
              />
              <MiniSlider
                label="Mid"
                value={master.eqMid}
                min={-24}
                max={24}
                step={0.5}
                onChange={(v) => setMaster("eqMid", v)}
                unit="dB"
                disabled={!master.eqOn}
              />
              <MiniSlider
                label="High"
                value={master.eqHigh}
                min={-24}
                max={24}
                step={0.5}
                onChange={(v) => setMaster("eqHigh", v)}
                unit="dB"
                disabled={!master.eqOn}
              />
            </div>
          </div>

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
export function Mixer({
  getTrackMeter,
  getMasterMeter,
  getMasterSpectrum,
  getMasterWaveform,
  getLoudness,
  getTruePeak,
}: {
  getTrackMeter: (index: number) => number;
  getMasterMeter: () => number;
  getMasterSpectrum: () => Float32Array | null;
  getMasterWaveform: () => Float32Array | null;
  getLoudness?: () => number;
  getTruePeak?: () => number;
}) {
  const tracks = useEngineStore((s) => s.tracks);
  const setTrackVolume = useEngineStore((s) => s.setTrackVolume);
  const setTrackPan = useEngineStore((s) => s.setTrackPan);
  const toggleMute = useEngineStore((s) => s.toggleMute);
  const toggleSolo = useEngineStore((s) => s.toggleSolo);
  const loadSample = useEngineStore((s) => s.loadSample);
  const clearSample = useEngineStore((s) => s.clearSample);
  const setNoteLength = useEngineStore((s) => s.setNoteLength);

  // Compact track info for the sidechain source picker — built once per track
  // change (not per render of every channel strip).
  const allTracksInfo = useMemo<FXPanelTrackInfo[]>(
    () =>
      tracks.map((t) => ({
        id: t.id,
        name: t.customSampleName ?? t.sound.name,
        color: t.sound.color,
      })),
    [tracks]
  );

  const [openFX, setOpenFX] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTrackRef = useRef<number>(0);

  const trackMeterGetters = useMemo(
    () => tracks.map((_, i) => () => getTrackMeter(i)),
    [tracks, getTrackMeter]
  );

  const handleVolume = useCallback(
    (id: number, vol: number) => setTrackVolume(id, vol),
    [setTrackVolume]
  );
  const handlePan = useCallback(
    (id: number, pan: number) => setTrackPan(id, pan),
    [setTrackPan]
  );
  const handleMute = useCallback(
    (id: number) => toggleMute(id),
    [toggleMute]
  );
  const handleSolo = useCallback(
    (id: number) => toggleSolo(id),
    [toggleSolo]
  );
  const handleLoadSample = useCallback(
    (id: number) => {
      pendingTrackRef.current = id;
      fileInputRef.current?.click();
    },
    []
  );

  const handleClearSample = useCallback(
    (id: number) => clearSample(id),
    [clearSample]
  );

  const handleNoteLength = useCallback(
    (id: number, length: number) => setNoteLength(id, length),
    [setNoteLength]
  );

  const [editingSoundId, setEditingSoundId] = useState<number | null>(null);
  const handleEditSound = useCallback((id: number) => setEditingSoundId(id), []);

  const [visualizerMode, setVisualizerMode] = useState<"2d" | "3d">("2d");

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset so the same file can be re-selected
      e.target.value = "";
      const maxSize = 512 * 1024;
      if (file.size > maxSize) {
        alert(`Sample too large (${Math.round(file.size / 1024)}KB). Max is 512KB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const name = file.name.replace(/\.[^.]+$/, "").slice(0, 12);
        loadSample(pendingTrackRef.current, dataUrl, name);
      };
      reader.readAsDataURL(file);
    },
    [loadSample]
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
    <div className="px-3 py-3">
      {/* Master visualizer header — spectrum + oscilloscope + 3D */}
      <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[13px] font-bold tracking-tight text-foreground">Master</h2>
            <span className="text-[10px] font-mono text-muted">
              {tracks.length} ch · {openFX.size} FX
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setVisualizerMode("2d")}
              className={`rounded px-2 py-0.5 text-[9px] font-bold transition-colors ${visualizerMode === "2d" ? "bg-accent text-[#1a1408]" : "bg-surface-3 text-muted"}`}
            >
              2D
            </button>
            <button
              onClick={() => setVisualizerMode("3d")}
              className={`rounded px-2 py-0.5 text-[9px] font-bold transition-colors ${visualizerMode === "3d" ? "bg-accent text-[#1a1408]" : "bg-surface-3 text-muted"}`}
            >
              3D
            </button>
          </div>
        </div>
        <div className="min-w-0 flex-1" style={{ height: visualizerMode === "3d" ? "140px" : "60px" }}>
          {visualizerMode === "2d" ? (
            <SpectrumAnalyzer
              getSpectrum={getMasterSpectrum}
              getWaveform={getMasterWaveform}
            />
          ) : (
            <Spectrum3D getSpectrum={getMasterSpectrum} />
          )}
        </div>
      </div>

      <div className="panel-soft rounded-xl p-3">
        <div className="flex items-start gap-3 overflow-x-auto pb-1 [scroll-snap-type:x_mandatory]">
        {tracks.map((track, i) => (
          <ChannelStrip
            key={track.id}
            trackId={track.id}
            name={track.sound.name}
            color={track.sound.color}
            volume={track.volume}
            pan={track.pan}
            muted={track.muted}
            solo={track.solo}
            effects={track.effects}
            fxOpen={openFX.has(track.id)}
            hasSample={track.customSampleUrl !== null}
            sampleName={track.customSampleName}
            noteLength={track.noteLength}
            allTracks={allTracksInfo}
            getLevel={trackMeterGetters[i]}
            onVolume={handleVolume}
            onPan={handlePan}
            onMute={handleMute}
            onSolo={handleSolo}
            onToggleFX={handleToggleFX}
            onLoadSample={handleLoadSample}
            onClearSample={handleClearSample}
            onNoteLength={handleNoteLength}
            onEditSound={handleEditSound}
          />
        ))}

        {/* Master bus */}
          <MasterStrip getLevel={getMasterMeter} getLoudness={getLoudness} getTruePeak={getTruePeak} />
        </div>
      </div>

      {/* Hidden file input for sample loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/wav,audio/mpeg,audio/ogg,audio/mp3,.wav,.mp3,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Sound Editor modal — per-track synth params + voice swap */}
      {editingSoundId !== null && (
        <SoundEditor trackId={editingSoundId} onClose={() => setEditingSoundId(null)} />
      )}
    </div>
  );
}
