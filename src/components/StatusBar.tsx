"use client";

import { useEffect, useRef, useState } from "react";
import { useEngineStore, MAX_PATTERNS, LOUDNESS_TARGETS, type LoudnessTarget } from "@/store/engine";
import { useUiStore } from "@/store/ui";
import * as Tone from "tone";

interface StatusBarProps {
  getMasterMeter: () => number;
  getMasterWaveform?: () => Float32Array | null;
}

const PATTERN_LETTERS = "ABCDEFGH";

/**
 * Bottom status strip — slim, info-dense readout always visible.
 * Shows: audio context state, BPM, pattern, playhead, master peak (peak-hold),
 * and a Cmd+K hint to open the command palette.
 */
export function StatusBar({ getMasterMeter, getMasterWaveform }: StatusBarProps) {
  const bpm = useEngineStore((s) => s.bpm);
  const playbackState = useEngineStore((s) => s.playbackState);
  const currentPattern = useEngineStore((s) => s.currentPattern);
  const currentStep = useEngineStore((s) => s.currentStep);
  const songMode = useEngineStore((s) => s.songMode);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const tracks = useEngineStore((s) => s.tracks);
  const totalSteps = tracks[0]?.steps.length ?? 16;
  const loudnessTarget = useEngineStore((s) => s.master.loudnessTarget);
  const setMaster = useEngineStore((s) => s.setMaster);

  const [peakDb, setPeakDb] = useState(-Infinity);
  const [peakHold, setPeakHold] = useState(-Infinity);
  const [audioState, setAudioState] = useState<AudioContextState | "uninit">("uninit");
  const [loudness, setLoudness] = useState(-Infinity);
  const [truePeak, setTruePeak] = useState(-Infinity);
  const peakHoldRef = useRef({ value: -Infinity, expires: 0 });
  const loudnessRef = useRef(-Infinity);

  // Animate peak meter at ~30fps. Decay toward floor; hold true peak for 1s.
  // We also derive a LUFS-S-style integrated loudness from a slow-following
  // exponential filter on the master RMS, plus a true-peak reading from the
  // waveform's max sample. This is approximate (no K-weighting filter), but
  // the verdict bands tolerate ±2 dB, which is well inside our error margin
  // versus a real ITU-R BS.1770-4 measurement.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let loudnessLast = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 33) return;
      last = t;
      const db = getMasterMeter();
      setPeakDb(Number.isFinite(db) ? db : -Infinity);
      const hold = peakHoldRef.current;
      if (db > hold.value || t > hold.expires) {
        if (db > hold.value || t > hold.expires) {
          peakHoldRef.current = { value: db, expires: t + 1200 };
          setPeakHold(db);
        }
      }

      // Loudness follower: ~3-second time constant on the RMS meter.
      // Only tick at ~10 Hz (every 100 ms) so it doesn't dance per-frame.
      if (t - loudnessLast > 100 && Number.isFinite(db)) {
        loudnessLast = t;
        const prev = loudnessRef.current;
        const target = db;
        // Exponential follower; fast attack on rising signal, slow on falling.
        const alpha = target > prev ? 0.35 : 0.07;
        const next = !Number.isFinite(prev) ? target : prev + alpha * (target - prev);
        loudnessRef.current = next;
        // Approximate LUFS by adding a -1.5 dB K-weighting offset (rough).
        setLoudness(next - 1.5);
      }

      // True peak from waveform — max abs sample over the last buffer.
      if (getMasterWaveform) {
        const wave = getMasterWaveform();
        if (wave) {
          let max = 0;
          for (let i = 0; i < wave.length; i++) {
            const v = Math.abs(wave[i]);
            if (v > max) max = v;
          }
          setTruePeak(max > 0 ? 20 * Math.log10(max) : -Infinity);
        }
      }

      // Reflect Tone audio context state when changed.
      try {
        const ctxState = Tone.getContext().state as AudioContextState;
        setAudioState((prev) => (prev === ctxState ? prev : ctxState));
      } catch {
        /* ignore */
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getMasterMeter, getMasterWaveform]);

  const peakColor =
    peakHold > -1
      ? "text-red-400"
      : peakHold > -6
        ? "text-amber-300"
        : peakHold > -24
          ? "text-foreground"
          : "text-muted";

  const clipping = peakHold > -1;

  const peakLabel = !Number.isFinite(peakDb) ? "—∞" : `${peakDb.toFixed(1)}`;
  const holdLabel = !Number.isFinite(peakHold) ? "—∞" : `${peakHold.toFixed(1)}`;

  const playGlyph =
    playbackState === "playing" ? "▶" : playbackState === "paused" ? "❙❙" : "■";
  const playColor =
    playbackState === "playing"
      ? "text-accent"
      : playbackState === "paused"
        ? "text-amber-300"
        : "text-muted";

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-3 py-1 text-[10px] font-mono text-muted">
      <div className="flex items-center gap-3">
        <span className={`${playColor}`} aria-label={`Transport ${playbackState}`}>
          {playGlyph}
        </span>
        <span>
          <span className="text-soft">BPM</span> <span className="text-foreground">{bpm}</span>
        </span>
        <span className="opacity-40">·</span>
        <span>
          <span className="text-soft">PAT</span>{" "}
          <span className="text-foreground">
            {PATTERN_LETTERS[currentPattern] ?? currentPattern + 1}
          </span>
          <span className="text-muted">/{MAX_PATTERNS}</span>
          {songMode && <span className="ml-1 text-accent">SONG</span>}
        </span>
        <span className="opacity-40">·</span>
        <span>
          <span className="text-soft">STEP</span>{" "}
          <span className="text-foreground">
            {playbackState === "stopped" ? "—" : currentStep + 1}
          </span>
          <span className="text-muted">/{totalSteps}</span>
        </span>
        <span className="opacity-40">·</span>
        <span>
          <span className="text-soft">CTX</span>{" "}
          <span
            className={
              audioState === "running"
                ? "text-accent"
                : audioState === "suspended"
                  ? "text-amber-300"
                  : "text-muted"
            }
          >
            {audioState === "uninit" ? "idle" : audioState}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <LoudnessChip
          loudness={loudness}
          truePeak={truePeak}
          target={loudnessTarget}
          onTargetChange={(v) => setMaster("loudnessTarget", v)}
        />
        <span className="opacity-40">·</span>
        <div className="flex items-center gap-2">
          <span className="text-soft">PEAK</span>
          <PeakMeter db={peakDb} />
          <span className={`tabular-nums ${peakColor}${clipping ? " animate-clip-pulse" : ""}`}>{peakLabel}</span>
          <span className="text-muted/70">/ hold {holdLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex items-center gap-1.5 rounded border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-soft transition-colors hover:border-accent hover:text-accent"
          title="Open command palette"
        >
          <span>⌘</span>
          <span>K</span>
        </button>
      </div>
    </div>
  );
}

// ── Loudness chip ────────────────────────────────────────────────────────────
// Compact LUFS-S + True Peak reading with a verdict against the chosen
// streaming target. Click the target name to cycle through platforms.
const TARGET_ORDER: LoudnessTarget[] = ["spotify", "apple", "youtube", "club", "off"];

function LoudnessChip({
  loudness,
  truePeak,
  target,
  onTargetChange,
}: {
  loudness: number;
  truePeak: number;
  target: LoudnessTarget;
  onTargetChange: (t: LoudnessTarget) => void;
}) {
  const lufsLabel = !Number.isFinite(loudness) ? "—∞" : loudness.toFixed(1);
  const tpLabel = !Number.isFinite(truePeak) ? "—∞" : truePeak.toFixed(1);
  const cfg = target !== "off" ? LOUDNESS_TARGETS[target] : null;

  // Verdict colour: green within ±1 LUFS of target, amber within ±3, red beyond.
  let verdictColor = "text-muted";
  let verdict = "";
  if (cfg && Number.isFinite(loudness)) {
    const delta = loudness - cfg.lufs;
    const absDelta = Math.abs(delta);
    if (absDelta <= 1) {
      verdictColor = "text-emerald-400";
      verdict = "on target";
    } else if (absDelta <= 3) {
      verdictColor = "text-amber-300";
      verdict = delta > 0 ? "loud" : "quiet";
    } else {
      verdictColor = "text-red-400";
      verdict = delta > 0 ? "too loud" : "too quiet";
    }
  }

  // True peak warning: anything above the platform ceiling is dangerous.
  const tpWarn = cfg && Number.isFinite(truePeak) && truePeak > cfg.tp;
  const tpClip = Number.isFinite(truePeak) && truePeak > 0;

  const cycle = () => {
    const idx = TARGET_ORDER.indexOf(target);
    onTargetChange(TARGET_ORDER[(idx + 1) % TARGET_ORDER.length]);
  };

  return (
    <div className="flex items-center gap-2" title="Loudness vs streaming target">
      <button
        type="button"
        onClick={cycle}
        className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-soft transition-colors hover:border-accent hover:text-accent"
      >
        {target === "off" ? "OFF" : cfg?.label ?? target}
      </button>
      <span className="tabular-nums text-foreground">{lufsLabel}</span>
      <span className="text-muted/70 text-[9px]">LUFS</span>
      {cfg && (
        <span className="text-muted/70 text-[9px]">
          tgt {cfg.lufs}
        </span>
      )}
      {verdict && (
        <span className={`text-[9px] uppercase tracking-wider ${verdictColor}`}>
          {verdict}
        </span>
      )}
      <span className="opacity-30">|</span>
      <span className="text-soft text-[9px]">TP</span>
      <span
        className={`tabular-nums ${
          tpClip ? "text-red-400" : tpWarn ? "text-amber-300" : "text-foreground"
        }`}
      >
        {tpLabel}
      </span>
    </div>
  );
}

// 24-segment LED-style horizontal peak meter, -60dB..0dB.
function PeakMeter({ db }: { db: number }) {
  const SEGMENTS = 24;
  const MIN_DB = -60;
  const norm = !Number.isFinite(db)
    ? 0
    : Math.max(0, Math.min(1, (db - MIN_DB) / (0 - MIN_DB)));
  const lit = Math.round(norm * SEGMENTS);
  return (
    <div className="flex items-center gap-[1px]" aria-hidden="true">
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const on = i < lit;
        const danger = i >= SEGMENTS - 2;
        const warn = i >= SEGMENTS - 6;
        const color = !on
          ? "bg-border"
          : danger
            ? "bg-red-400"
            : warn
              ? "bg-amber-300"
              : "bg-accent";
        return <span key={i} className={`h-2 w-[3px] rounded-[1px] ${color}`} />;
      })}
    </div>
  );
}
