"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  useEngineStore,
  LOUDNESS_TARGETS,
  type LoudnessTarget,
} from "@/store/engine";

// LUFS scale we render on the bar. Real masters live in the -24..-6 range, so
// we crop the meter there for resolution where it matters. Outside this range
// the bar pins to the edge.
const LUFS_MIN = -36;
const LUFS_MAX = -3;

// True-peak danger thresholds. -1 dBTP is the streaming standard ceiling.
// Above 0 dBFS = guaranteed clipping on consumer playback chains.
const TP_WARN = -1;
const TP_CLIP = 0;

function lufsToPct(lufs: number): number {
  if (!isFinite(lufs)) return 0;
  return Math.max(0, Math.min(100, ((lufs - LUFS_MIN) / (LUFS_MAX - LUFS_MIN)) * 100));
}

const TARGET_ORDER: LoudnessTarget[] = ["spotify", "apple", "youtube", "club", "off"];

export const LoudnessPanel = memo(function LoudnessPanel({
  getLoudness,
  getTruePeak,
}: {
  getLoudness: () => number;
  getTruePeak: () => number;
}) {
  const target = useEngineStore((s) => s.master.loudnessTarget);
  const setMaster = useEngineStore((s) => s.setMaster);

  const barRef = useRef<HTMLDivElement>(null);
  const lufsTextRef = useRef<HTMLSpanElement>(null);
  const tpTextRef = useRef<HTMLSpanElement>(null);
  const tpBarRef = useRef<HTMLDivElement>(null);

  // Smoothed integrated-style reading: a slow follower over the K-weighted
  // RMS so the number doesn't dance every frame. ~3-second time constant.
  const smoothedLoudness = useRef(-Infinity);
  const peakHold = useRef(-Infinity);
  const peakHoldFrames = useRef(0);

  const [verdict, setVerdict] = useState<{
    label: string;
    color: string;
    detail: string;
  }>({
    label: "—",
    color: "var(--muted)",
    detail: "press play to start metering",
  });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const lufs = getLoudness();
      const tp = getTruePeak();

      // Smooth loudness with a one-pole IIR — about 3s time constant at 60fps.
      const a = 0.012;
      if (isFinite(lufs)) {
        if (!isFinite(smoothedLoudness.current)) smoothedLoudness.current = lufs;
        else smoothedLoudness.current = smoothedLoudness.current * (1 - a) + lufs * a;
      } else {
        smoothedLoudness.current -= 0.5;
        if (smoothedLoudness.current < LUFS_MIN - 10) smoothedLoudness.current = -Infinity;
      }

      // True-peak hold: snap up immediately, decay slowly.
      if (isFinite(tp)) {
        if (tp > peakHold.current) {
          peakHold.current = tp;
          peakHoldFrames.current = 60;
        } else if (peakHoldFrames.current > 0) {
          peakHoldFrames.current--;
        } else {
          peakHold.current -= 0.3;
        }
      }

      const lufsPct = lufsToPct(smoothedLoudness.current);
      if (barRef.current) {
        barRef.current.style.width = `${lufsPct}%`;
      }
      if (lufsTextRef.current) {
        lufsTextRef.current.textContent = isFinite(smoothedLoudness.current)
          ? `${smoothedLoudness.current.toFixed(1)}`
          : "—";
      }
      if (tpTextRef.current) {
        tpTextRef.current.textContent = isFinite(peakHold.current)
          ? `${peakHold.current.toFixed(1)}`
          : "—";
        if (peakHold.current >= TP_CLIP) {
          tpTextRef.current.style.color = "var(--danger)";
        } else if (peakHold.current >= TP_WARN) {
          tpTextRef.current.style.color = "var(--warning)";
        } else {
          tpTextRef.current.style.color = "var(--success)";
        }
      }
      if (tpBarRef.current) {
        // Map -24..0 dBTP onto a small bar.
        const tpPct = Math.max(0, Math.min(100, ((peakHold.current + 24) / 24) * 100));
        tpBarRef.current.style.width = `${tpPct}%`;
        tpBarRef.current.style.backgroundColor =
          peakHold.current >= TP_CLIP
            ? "var(--danger)"
            : peakHold.current >= TP_WARN
              ? "var(--warning)"
              : "var(--success)";
      }

      // Verdict every ~15 frames
      if (raf % 15 === 0 || raf === 0) {
        if (!isFinite(smoothedLoudness.current)) {
          setVerdict({
            label: "—",
            color: "var(--muted)",
            detail: "press play to start metering",
          });
        } else if (target === "off") {
          setVerdict({
            label: `${smoothedLoudness.current.toFixed(1)} LUFS`,
            color: "var(--accent)",
            detail: "no target — raw loudness only",
          });
        } else {
          const t = LOUDNESS_TARGETS[target];
          const delta = smoothedLoudness.current - t.lufs;
          const abs = Math.abs(delta);
          if (abs < 1) {
            setVerdict({
              label: "ON TARGET",
              color: "var(--success)",
              detail: `you're within 1 LUFS of ${t.label} (${t.lufs} LUFS). ship it.`,
            });
          } else if (delta > 0) {
            setVerdict({
              label: `${delta > 3 ? "WAY " : ""}TOO LOUD`,
              color: delta > 3 ? "var(--danger)" : "var(--warning)",
              detail: `${abs.toFixed(1)} LUFS over ${t.label}. ${t.label} will turn it down on playback — pull master volume or back off the limiter.`,
            });
          } else {
            setVerdict({
              label: "TOO QUIET",
              color: "var(--warning)",
              detail: `${abs.toFixed(1)} LUFS under ${t.label}. push the master, raise the limiter ceiling, or add saturation to fill it out.`,
            });
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getLoudness, getTruePeak, target]);

  const t = LOUDNESS_TARGETS[target];
  // Render the green target zone on the bar (-1..+1 LUFS around the target).
  const targetMidPct = lufsToPct(t.lufs);
  const targetLoPct = lufsToPct(t.lufs - 1);
  const targetHiPct = lufsToPct(t.lufs + 1);

  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface px-3 py-2.5 border border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider text-foreground">
            LOUDNESS
          </span>
          <span className="text-[9px] text-muted">
            real-time mastering meter · K-weighted LUFS-S + true peak
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted uppercase tracking-wider">
            target
          </span>
          {TARGET_ORDER.map((tk) => (
            <button
              key={tk}
              onClick={() => setMaster("loudnessTarget", tk)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                target === tk
                  ? "bg-accent text-white"
                  : "bg-surface-3 text-muted hover:text-foreground"
              }`}
              title={LOUDNESS_TARGETS[tk].hint}
            >
              {LOUDNESS_TARGETS[tk].label}
            </button>
          ))}
        </div>
      </div>

      {/* Main LUFS bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[9px] font-mono text-muted">
          <span>{LUFS_MIN}</span>
          <span>quiet</span>
          <span className="text-foreground/70">
            {target !== "off" && `target: ${t.lufs} LUFS`}
          </span>
          <span>loud</span>
          <span>{LUFS_MAX}</span>
        </div>
        <div className="relative h-5 w-full bg-surface rounded overflow-hidden border border-border">
          {/* Green target zone */}
          {target !== "off" && (
            <>
              <div
                className="absolute top-0 bottom-0 bg-success/20 border-x border-success/40"
                style={{
                  left: `${targetLoPct}%`,
                  width: `${targetHiPct - targetLoPct}%`,
                }}
              />
              {/* Target tick */}
              <div
                className="absolute top-0 bottom-0 w-px bg-success"
                style={{ left: `${targetMidPct}%` }}
              />
            </>
          )}
          {/* The actual loudness bar — gradient blue→purple→red */}
          <div
            ref={barRef}
            className="absolute top-0 bottom-0 left-0 transition-[width] duration-75"
            style={{
              width: "0%",
              background:
                "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ef4444 100%)",
              opacity: 0.85,
            }}
          />
          {/* Big number readout */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-mono text-[11px] font-bold text-foreground drop-shadow">
              <span ref={lufsTextRef}>—</span>
              <span className="text-[8px] font-normal text-foreground/70 ml-1">LUFS</span>
            </span>
          </div>
        </div>
      </div>

      {/* True peak (small bar) + verdict */}
      <div className="flex items-stretch gap-3">
        <div className="flex flex-col gap-0.5 min-w-[140px]">
          <div className="flex items-center justify-between text-[9px] font-mono text-muted">
            <span>True Peak</span>
            <span>
              <span ref={tpTextRef} className="text-success">—</span>
              <span className="text-muted ml-0.5">dBTP</span>
            </span>
          </div>
          <div className="relative h-2 w-full bg-surface rounded overflow-hidden border border-border">
            {/* -1 dBTP danger line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-warning"
              style={{ left: `${((TP_WARN + 24) / 24) * 100}%` }}
              title="-1 dBTP — streaming ceiling"
            />
            <div
              ref={tpBarRef}
              className="absolute top-0 bottom-0 left-0 transition-[width] duration-75"
              style={{ width: "0%", backgroundColor: "var(--success)" }}
            />
          </div>
        </div>

        {/* Verdict pill */}
        <div className="flex-1 flex items-center gap-2 rounded bg-surface px-2 py-1">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
            style={{ backgroundColor: verdict.color }}
          >
            {verdict.label}
          </span>
          <span className="text-[10px] text-foreground/80 leading-tight">
            {verdict.detail}
          </span>
        </div>
      </div>
    </div>
  );
});
