"use client";

import {
  useEngineStore,
  type TrackEffects,
  type FilterType,
  type LfoRate,
  type LfoShape,
  LFO_RATES,
  LFO_SHAPES,
} from "@/store/engine";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpectrumAnalyzer } from "./SpectrumAnalyzer";
import { SonicXRay } from "./SonicXRay";
import { LoudnessPanel } from "./LoudnessPanel";

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
    <div className="flex flex-col gap-2 p-2 bg-surface rounded border border-border">
      {/* Color bar */}
      <div className="h-0.5 w-full rounded" style={{ backgroundColor: color }} />

      {/* 3-Band EQ — fixed crossovers (250/1.5k/6kHz), ±18dB gain.
          Shown first so it's the first tool a beginner reaches for. The
          visual EQ curve in the Sonic X-Ray updates in real-time. */}
      <div className="flex flex-col gap-1">
        <FXToggle label="EQ" active={effects.trackEqOn} onClick={() => set("trackEqOn", !effects.trackEqOn)} />
        <div className="flex gap-1">
          <MiniSlider
            label="Low"
            value={effects.trackEqLow}
            min={-18}
            max={18}
            step={0.5}
            onChange={(v) => set("trackEqLow", v)}
            unit="dB"
            disabled={!effects.trackEqOn}
          />
          <MiniSlider
            label="Mid"
            value={effects.trackEqMid}
            min={-18}
            max={18}
            step={0.5}
            onChange={(v) => set("trackEqMid", v)}
            unit="dB"
            disabled={!effects.trackEqOn}
          />
          <MiniSlider
            label="High"
            value={effects.trackEqHigh}
            min={-18}
            max={18}
            step={0.5}
            onChange={(v) => set("trackEqHigh", v)}
            unit="dB"
            disabled={!effects.trackEqOn}
          />
        </div>
      </div>

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
            className="bg-surface-2 text-[9px] text-foreground rounded px-1 py-0.5 border-none outline-none disabled:opacity-40"
          >
            {LFO_SHAPES.map((s) => (
              <option key={s} value={s}>{s.slice(0, 3)}</option>
            ))}
          </select>
          <select
            value={effects.panLfoRate}
            onChange={(e) => set("panLfoRate", e.target.value as LfoRate)}
            disabled={!effects.panLfoOn}
            className="bg-surface-2 text-[9px] text-foreground rounded px-1 py-0.5 border-none outline-none disabled:opacity-40"
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
                  className={`px-1 py-0.5 rounded text-[8px] font-bold transition-colors ${
                    active
                      ? "text-white"
                      : "bg-surface-2 text-muted hover:bg-surface-3"
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
    <div className="relative w-2 h-20 bg-surface-2 rounded-sm overflow-hidden">
      <div
        ref={barRef}
        className="absolute bottom-0 left-0 w-full rounded-sm transition-[height] duration-75"
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
}) {
  const hasFX =
    effects.trackEqOn ||
    effects.driveOn ||
    effects.filterOn ||
    effects.delayOn ||
    effects.reverbOn ||
    effects.sidechainOn ||
    effects.panLfoOn;

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
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-col items-center gap-1.5 w-16">
        {/* Full-width track color header */}
        <div
          className="w-full h-[3px] rounded-full transition-all duration-100"
          style={{
            backgroundColor: color,
            boxShadow: flashing
              ? `0 0 12px 3px ${color}`
              : `0 0 5px ${color}60`,
          }}
        />
        <span
          className={`text-[10px] truncate w-full text-center transition-colors ${flashing ? "" : "text-muted"}`}
          style={flashing ? { color } : undefined}
        >
          {hasSample ? sampleName ?? "Sample" : name}
        </span>

        {/* Sample load / clear */}
        <div className="flex gap-0.5 w-full justify-center">
          <button
            onClick={() => onLoadSample(trackId)}
            className={`flex-1 h-4 rounded text-[8px] font-bold transition-colors ${
              hasSample
                ? "bg-success/30 text-success"
                : "bg-surface-2 text-muted hover:bg-surface-3"
            }`}
            title={hasSample ? `Loaded: ${sampleName}` : "Load audio sample (.wav, .mp3, .ogg)"}
          >
            {hasSample ? "SMP" : "SMP"}
          </button>
          {hasSample && (
            <button
              onClick={() => onClearSample(trackId)}
              className="w-4 h-4 rounded text-[8px] font-bold bg-surface-2 text-muted hover:bg-danger/20 hover:text-danger transition-colors"
              title="Clear sample — revert to built-in synth"
            >
              ✕
            </button>
          )}
        </div>

        {/* Note length — staccato / half / legato. Cycles with one click. */}
        <div className="flex gap-0.5 w-full justify-center" title={`Note length: ${noteLength.toFixed(2)}× step`}>
          {NOTE_LENGTH_PRESETS.map((p) => {
            const active = Math.abs(noteLength - p.value) < 0.05;
            return (
              <button
                key={p.value}
                onClick={() => onNoteLength(trackId, p.value)}
                className={`flex-1 h-3.5 rounded text-[10px] leading-none font-bold transition-colors ${
                  active
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-muted hover:bg-surface-3"
                }`}
                title={p.title}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Pan knob */}
        <div className="flex flex-col items-center gap-0.5 w-full">
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
        <div className="h-24 flex items-center gap-1">
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
          className={`w-full h-5 rounded text-[9px] font-bold transition-all ${
            fxOpen
              ? "bg-accent text-white"
              : hasFX
                ? "bg-accent-dim text-white"
                : "bg-surface-2 text-muted hover:bg-surface-3"
          }`}
          style={hasFX ? {
            boxShadow: fxOpen
              ? "0 0 10px var(--accent-glow)"
              : "0 0 5px rgba(109,40,217,0.35)",
          } : undefined}
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

// ── Vibe Macros — single-click mastering identities ──────────────────────────
// Each macro is a complete set of master bus settings that creates a specific
// sonic character. Beginners learn what "punchy" means by hearing what changes.
const VIBE_MACROS: {
  label: string;
  color: string;
  hint: string;
  settings: Partial<{
    eqOn: boolean; eqLow: number; eqMid: number; eqHigh: number;
    compressorOn: boolean; compressorThreshold: number; compressorRatio: number;
    compressorAttack: number; compressorRelease: number;
    limiterOn: boolean; limiterThreshold: number;
    warmthOn: boolean; warmth: number;
  }>;
}[] = [
  {
    label: "Punchy",
    color: "#ef4444",
    hint: "Hard transients, tight low-end. Fast comp attack, mid cut.",
    settings: {
      eqOn: true, eqLow: 2, eqMid: -2, eqHigh: 1,
      compressorOn: true, compressorThreshold: -16, compressorRatio: 6,
      compressorAttack: 0.001, compressorRelease: 0.1,
      limiterOn: true, limiterThreshold: -1,
      warmthOn: false, warmth: 0.1,
    },
  },
  {
    label: "Warm",
    color: "#f59e0b",
    hint: "Tape saturation, smooth top-end, gentle glue compression.",
    settings: {
      eqOn: true, eqLow: 1, eqMid: 0, eqHigh: -1.5,
      compressorOn: true, compressorThreshold: -20, compressorRatio: 3,
      compressorAttack: 0.01, compressorRelease: 0.3,
      limiterOn: true, limiterThreshold: -2,
      warmthOn: true, warmth: 0.55,
    },
  },
  {
    label: "Airy",
    color: "#06b6d4",
    hint: "High-shelf lift, light compression, room to breathe.",
    settings: {
      eqOn: true, eqLow: -1, eqMid: -1, eqHigh: 3,
      compressorOn: true, compressorThreshold: -24, compressorRatio: 2,
      compressorAttack: 0.02, compressorRelease: 0.5,
      limiterOn: true, limiterThreshold: -3,
      warmthOn: false, warmth: 0.1,
    },
  },
  {
    label: "Lo-fi",
    color: "#8b5cf6",
    hint: "Crushed top-end, heavy warmth, boxy mids. The dusty cassette feel.",
    settings: {
      eqOn: true, eqLow: 3, eqMid: 2, eqHigh: -6,
      compressorOn: true, compressorThreshold: -12, compressorRatio: 8,
      compressorAttack: 0.005, compressorRelease: 0.2,
      limiterOn: true, limiterThreshold: -2,
      warmthOn: true, warmth: 0.85,
    },
  },
  {
    label: "Club",
    color: "#22c55e",
    hint: "Loud, punchy, sub-heavy. Built for big speakers at high volume.",
    settings: {
      eqOn: true, eqLow: 4, eqMid: -1, eqHigh: 2,
      compressorOn: true, compressorThreshold: -14, compressorRatio: 5,
      compressorAttack: 0.002, compressorRelease: 0.15,
      limiterOn: true, limiterThreshold: -0.5,
      warmthOn: true, warmth: 0.3,
    },
  },
];

// ── Master Bus Strip ──────────────────────────────────────────
function MasterStrip({ getLevel }: { getLevel: () => number }) {
  const master = useEngineStore((s) => s.master);
  const setMaster = useEngineStore((s) => s.setMaster);

  const [expanded, setExpanded] = useState(false);
  const [activeVibe, setActiveVibe] = useState<string | null>(null);

  const applyVibe = useCallback((vibe: typeof VIBE_MACROS[0]) => {
    const s = vibe.settings;
    for (const [k, v] of Object.entries(s)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMaster(k as any, v as any);
    }
    setActiveVibe(vibe.label);
  }, [setMaster]);

  return (
    <div className="flex flex-col items-center gap-1 border-l border-border pl-3 ml-1">
      <div className="flex flex-col items-center gap-1.5 w-16">
        {/* Full-width master header */}
        <div
          className="w-full h-[3px] rounded-full"
          style={{
            backgroundColor: "var(--accent)",
            boxShadow: "0 0 8px var(--accent-glow)",
          }}
        />
        <span className="text-[10px] text-accent font-bold truncate w-full text-center">
          MASTER
        </span>

        {/* Spacer to align with pan knob area */}
        <div className="h-5" />

        {/* Master fader + Meter */}
        <div className="h-24 flex items-center gap-1">
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
          <LevelMeter getLevel={getLevel} color="var(--accent)" />
        </div>

        {/* dB readout */}
        <span className="text-[10px] font-mono text-accent">
          {master.volume === 0
            ? "-\u221E"
            : `${(20 * Math.log10(master.volume)).toFixed(1)}`}dB
        </span>

        {/* EQ / Comp / Limiter / Warmth toggles */}
        <div className="flex gap-1 flex-wrap justify-center">
          <button
            onClick={() => setMaster("eqOn", !master.eqOn)}
            className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${
              master.eqOn
                ? "bg-accent text-white"
                : "bg-surface-2 text-muted hover:bg-surface-3"
            }`}
            title="Master 3-band EQ"
          >
            EQ
          </button>
          <button
            onClick={() => setMaster("compressorOn", !master.compressorOn)}
            className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${
              master.compressorOn
                ? "bg-accent text-white"
                : "bg-surface-2 text-muted hover:bg-surface-3"
            }`}
            title="Master compressor"
          >
            C
          </button>
          <button
            onClick={() => setMaster("limiterOn", !master.limiterOn)}
            className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${
              master.limiterOn
                ? "bg-accent text-white"
                : "bg-surface-2 text-muted hover:bg-surface-3"
            }`}
            title="Brickwall limiter"
          >
            L
          </button>
          <button
            onClick={() => setMaster("warmthOn", !master.warmthOn)}
            className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${
              master.warmthOn
                ? "bg-warning text-black"
                : "bg-surface-2 text-muted hover:bg-surface-3"
            }`}
            title="Tape Warmth — single-knob analog character (saturation + air shelf)"
          >
            W
          </button>
        </div>

        {/* Vibe Macros — one-click mastering identity presets */}
        <div className="flex flex-col gap-0.5 w-full">
          <span className="text-[7px] uppercase tracking-wider text-muted text-center">Vibe</span>
          <div className="grid grid-cols-2 gap-0.5">
            {VIBE_MACROS.map((v) => (
              <button
                key={v.label}
                onClick={() => applyVibe(v)}
                title={v.hint}
                className={`h-4 rounded text-[7px] font-bold transition-all ${
                  activeVibe === v.label ? "text-white ring-1 ring-white/30" : "text-white/70 hover:text-white"
                }`}
                style={{
                  backgroundColor:
                    activeVibe === v.label ? v.color : `${v.color}55`,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
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

          {/* Warmth — one-knob tape character (subtle saturation + air shelf).
              The trick: low values smooth transients without coloring, high
              values give that "expensive analog" weight pros chase. */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-warning font-bold">TAPE WARMTH</span>
            <div className="flex gap-1 items-end">
              <MiniSlider
                label="Amount"
                value={master.warmth}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => setMaster("warmth", v)}
                disabled={!master.warmthOn}
              />
              <span className="text-[8px] text-muted leading-tight max-w-[80px]">
                soft saturation + a touch off the top — the analog glue trick
              </span>
            </div>
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
  getTrackSpectrum,
  getLoudness,
  getTruePeak,
  onConflictsChange,
  onOpenMixDoctor,
}: {
  getTrackMeter: (index: number) => number;
  getMasterMeter: () => number;
  getMasterSpectrum: () => Float32Array | null;
  getMasterWaveform: () => Float32Array | null;
  getTrackSpectrum: (index: number) => Float32Array | null;
  getLoudness: () => number;
  getTruePeak: () => number;
  onConflictsChange?: (c: Record<string, string[]>) => void;
  onOpenMixDoctor?: () => void;
}) {
  const tracks = useEngineStore((s) => s.tracks);
  const setTrackVolume = useEngineStore((s) => s.setTrackVolume);
  const setTrackPan = useEngineStore((s) => s.setTrackPan);
  const toggleMute = useEngineStore((s) => s.toggleMute);
  const toggleSolo = useEngineStore((s) => s.toggleSolo);
  const loadSample = useEngineStore((s) => s.loadSample);
  const clearSample = useEngineStore((s) => s.clearSample);
  const setNoteLength = useEngineStore((s) => s.setNoteLength);
  const setMaster = useEngineStore((s) => s.setMaster);

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

  const handleMatchEq = useCallback(
    (low: number, mid: number, high: number) => {
      setMaster("eqOn", true);
      setMaster("eqLow", low);
      setMaster("eqMid", mid);
      setMaster("eqHigh", high);
    },
    [setMaster]
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
    <div className="border-t border-border bg-surface">
      {/* ── Section header ─────────────────────────────────────── */}
      <div className="sec-head">
        <div className="dot" />
        <span>Mixer</span>
        <span className="tag">8 CH</span>
      </div>

      <div className="px-4 py-3">
      {/* ── Visual learning surface ────────────────────────────────────
          Two stacked teaching panels above the channel strips:
          1. Sonic X-Ray — per-track frequency overlay with zone labels and
             collision detection. Shows beginners *what* a mix is.
          2. Loudness panel — LUFS-S + dBTP with streaming targets. Shows
             beginners *when* a mix is ready to ship.
          The classic spectrum + scope sits below as the live overall view. */}
      <div className="mb-3 flex flex-col gap-3">
        <SonicXRay
          getTrackSpectrum={getTrackSpectrum}
          onConflictsChange={onConflictsChange}
          onOpenMixDoctor={onOpenMixDoctor}
          onMatchEq={handleMatchEq}
        />
        <LoudnessPanel getLoudness={getLoudness} getTruePeak={getTruePeak} />
        <SpectrumAnalyzer
          getSpectrum={getMasterSpectrum}
          getWaveform={getMasterWaveform}
        />
      </div>

      <div className="flex items-start gap-2 overflow-x-auto">
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
          />
        ))}

        {/* Master bus */}
        <MasterStrip getLevel={getMasterMeter} />
      </div>

      {/* Hidden file input for sample loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/wav,audio/mpeg,audio/ogg,audio/mp3,.wav,.mp3,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />
      </div>
    </div>
  );
}
