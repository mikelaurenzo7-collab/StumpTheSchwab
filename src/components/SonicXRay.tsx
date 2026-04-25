"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useEngineStore } from "@/store/engine";

// ── Frequency zones a producer actually thinks about ─────────────
// Boundaries are the standard mixing-textbook splits. The "what lives here"
// hint is what we show on hover — this is the teaching surface.
const ZONES: {
  name: string;
  short: string;
  lo: number;
  hi: number;
  color: string;
  what: string;
  tip: string;
}[] = [
  {
    name: "Sub",
    short: "SUB",
    lo: 20,
    hi: 60,
    color: "#7c3aed",
    what: "Felt more than heard. Kick fundamentals, 808s.",
    tip: "Too much here = boomy on phones, distorted on club PAs. High-pass everything that isn't kick or bass.",
  },
  {
    name: "Bass",
    short: "BASS",
    lo: 60,
    hi: 250,
    color: "#6366f1",
    what: "Body of the kick, weight of the bass, low end of toms.",
    tip: "If kick + bass both live here, one will mask the other. Sidechain or carve a notch.",
  },
  {
    name: "Low Mid",
    short: "LO-MID",
    lo: 250,
    hi: 500,
    color: "#06b6d4",
    what: "Warmth of vocals, body of snares and synths.",
    tip: "The 'mud zone'. A small cut around 300Hz often clears up a busy mix.",
  },
  {
    name: "Mid",
    short: "MID",
    lo: 500,
    hi: 2000,
    color: "#22c55e",
    what: "Where most melodic content lives. Voice, leads, guitars.",
    tip: "Boost too much and the mix gets boxy. Crowded mids = listener fatigue.",
  },
  {
    name: "Presence",
    short: "PRES",
    lo: 2000,
    hi: 6000,
    color: "#f59e0b",
    what: "Bite of snare, attack of synths, intelligibility of vocals.",
    tip: "A small bump here makes things 'pop forward'. Too much = harsh / shouty.",
  },
  {
    name: "Air",
    short: "AIR",
    lo: 6000,
    hi: 20000,
    color: "#ec4899",
    what: "Cymbals, breathiness, 'sparkle'. The top shelf.",
    tip: "A gentle high-shelf here adds expensive-sounding sheen. Cut it for a lo-fi feel.",
  },
];

const MIN_HZ = 20;
const MAX_HZ = 20000;

// Map a normalized x in [0,1] to log-scaled frequency.
function xToHz(x: number): number {
  return MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, x);
}
function hzToX(hz: number): number {
  return Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ);
}

// Convert a track FFT (dB float array) into a zone-energy summary: mean dB
// per zone. Used for collision detection.
function zoneEnergies(spectrum: Float32Array, sampleRate: number): number[] {
  const n = spectrum.length;
  const out: number[] = [];
  for (const z of ZONES) {
    const startBin = Math.max(0, Math.floor((z.lo / (sampleRate / 2)) * n));
    const endBin = Math.min(n, Math.ceil((z.hi / (sampleRate / 2)) * n));
    if (endBin <= startBin) {
      out.push(-Infinity);
      continue;
    }
    let sum = 0;
    for (let i = startBin; i < endBin; i++) sum += spectrum[i];
    out.push(sum / (endBin - startBin));
  }
  return out;
}

// A "loud" track in a zone: dB above this threshold counts as occupying it.
const ZONE_OCCUPY_DB = -55;

// Approximate EQ frequency response for a Tone.EQ3-style setup.
// loShelf @ 250Hz, midPeak @ 1500Hz (Q≈1), hiShelf @ 6000Hz.
// Returns gain in dB at the given frequency.
function eqResponseDb(hz: number, low: number, mid: number, high: number): number {
  const smoothStep = (x: number) => {
    const c = Math.max(-1, Math.min(1, x));
    return 0.5 - 0.5 * (3 * c - c * c * c) / 2;
  };
  const loGain = low * smoothStep(-Math.log2(hz / 250) * 1.5);
  const hiGain = high * smoothStep(Math.log2(hz / 6000) * 1.5);
  const midOctaves = Math.log2(hz / 1500);
  const midGain = mid * Math.exp(-0.5 * (midOctaves * 1.0) ** 2);
  return loGain + midGain + hiGain;
}

interface TrackInfo {
  id: number;
  name: string;
  color: string;
  eqOn: boolean;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
}

export const SonicXRay = memo(function SonicXRay({
  getTrackSpectrum,
  height = 180,
  onConflictsChange,
  onOpenMixDoctor,
}: {
  getTrackSpectrum: (index: number) => Float32Array | null;
  height?: number;
  onConflictsChange?: (c: Record<string, string[]>) => void;
  onOpenMixDoctor?: () => void;
}) {
  const tracks = useEngineStore((s) => s.tracks);
  const trackInfos = useMemo<TrackInfo[]>(
    () =>
      tracks.map((t) => ({
        id: t.id,
        name: t.customSampleName ?? t.sound.name,
        color: t.sound.color,
        eqOn: t.effects.trackEqOn,
        eqLow: t.effects.trackEqLow,
        eqMid: t.effects.trackEqMid,
        eqHigh: t.effects.trackEqHigh,
      })),
    [tracks]
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverZone, setHoverZone] = useState<number | null>(null);
  // Conflicts: zone index -> list of track names currently fighting in it.
  const [conflicts, setConflicts] = useState<Record<number, string[]>>({});
  const [focusedTrack, setFocusedTrack] = useState<number | null>(null);
  const onConflictsChangeRef = useRef(onConflictsChange);
  onConflictsChangeRef.current = onConflictsChange;

  // Stable mouse handler: convert x position to a zone index for the tooltip.
  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const hz = xToHz(x);
    const idx = ZONES.findIndex((z) => hz >= z.lo && hz <= z.hi);
    setHoverZone(idx === -1 ? null : idx);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const sampleRate = 44100;
    let conflictTick = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // Background
      ctx.fillStyle = "rgba(15, 14, 23, 0.92)";
      ctx.fillRect(0, 0, w, h);

      // ── Frequency-zone bands (subtle vertical regions w/ labels) ─────
      for (let i = 0; i < ZONES.length; i++) {
        const z = ZONES[i];
        const x0 = hzToX(z.lo) * w;
        const x1 = hzToX(z.hi) * w;
        const isHover = hoverZone === i;
        ctx.fillStyle = isHover
          ? `${z.color}22`
          : `${z.color}10`;
        ctx.fillRect(x0, 0, x1 - x0, h);
        // Divider line
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(x1 - 0.5, 0, 1, h);
        // Label at top
        ctx.fillStyle = isHover ? z.color : "rgba(255,255,255,0.45)";
        ctx.font = "bold 9px ui-monospace, monospace";
        ctx.textBaseline = "top";
        ctx.fillText(z.short, x0 + 4, 4);
      }

      // ── Frequency reference grid (100Hz, 1kHz, 10kHz) ────────────────
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (const hz of [100, 1000, 10000]) {
        const x = hzToX(hz) * w;
        ctx.beginPath();
        ctx.moveTo(x, 14);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "8px ui-monospace, monospace";
        ctx.fillText(
          hz >= 1000 ? `${hz / 1000}k` : `${hz}`,
          x + 2,
          h - 10
        );
      }

      // ── Per-track FFT lines ──────────────────────────────────────────
      // Each track is drawn as a soft filled area + a bright stroke on top.
      // The track in `focusedTrack` is opaque; everything else is dimmed.
      // Frequency points are sampled along a log-spaced curve (96 cols).
      const cols = 96;
      const zoneEnergiesPerTrack: (number[] | null)[] = [];

      for (let t = 0; t < trackInfos.length; t++) {
        const spectrum = getTrackSpectrum(t);
        if (!spectrum) {
          zoneEnergiesPerTrack.push(null);
          continue;
        }
        zoneEnergiesPerTrack.push(zoneEnergies(spectrum, sampleRate));

        const dim = focusedTrack !== null && focusedTrack !== t;
        const alpha = dim ? 0.08 : 0.85;
        const fillAlpha = dim ? 0.03 : 0.18;

        ctx.beginPath();
        ctx.moveTo(0, h);

        const binCount = spectrum.length;
        for (let i = 0; i <= cols; i++) {
          const xN = i / cols;
          const hz = xToHz(xN);
          // Average a small window of bins around this point so the line
          // reads smoothly rather than spiking on a single bin.
          const center = (hz / (sampleRate / 2)) * binCount;
          const lo = Math.max(0, Math.floor(center - 1));
          const hi = Math.min(binCount, Math.ceil(center + 2));
          let sum = 0;
          for (let b = lo; b < hi; b++) sum += spectrum[b];
          const db = sum / Math.max(1, hi - lo);
          // Map -90..-10 dB to 0..1
          const norm = Math.max(0, Math.min(1, (db + 90) / 80));
          const x = xN * w;
          const y = h - norm * (h - 18) - 2;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();

        // Fill
        ctx.fillStyle = `${trackInfos[t].color}${Math.round(fillAlpha * 255)
          .toString(16)
          .padStart(2, "0")}`;
        ctx.fill();

        // Stroke
        ctx.strokeStyle = trackInfos[t].color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = dim ? 1 : 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // ── EQ response curves — drawn BELOW the FFT lines, one per track ─────
      // The curve shows the EQ transfer function (gain vs. frequency) as a
      // glowing line at the bottom of the canvas. Center = 0dB, ±18dB fills
      // the zone. This is the visual-learning moment: you SEE what EQ does.
      // Only rendered when trackEqOn is true for that track.
      const eqZoneH = h * 0.22;    // EQ display uses bottom 22% of canvas
      const eqZeroY = h - 8;       // 0dB line near the bottom
      const eqScale = (eqZoneH - 4) / 18; // pixels per dB

      // Draw 0dB reference line
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(0, eqZeroY);
      ctx.lineTo(w, eqZeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let t = 0; t < trackInfos.length; t++) {
        const info = trackInfos[t];
        if (!info.eqOn) continue;
        if (info.eqLow === 0 && info.eqMid === 0 && info.eqHigh === 0) continue;
        const dim = focusedTrack !== null && focusedTrack !== info.id;
        if (dim) continue;

        ctx.beginPath();
        const eqCols = 120;
        for (let i = 0; i <= eqCols; i++) {
          const xN = i / eqCols;
          const hz = xToHz(xN);
          const db = eqResponseDb(hz, info.eqLow, info.eqMid, info.eqHigh);
          const x = xN * w;
          const y = eqZeroY - db * eqScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = info.color;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // ── Collision detection (every ~10 frames so the labels don't flicker)
      conflictTick++;
      if (conflictTick % 10 === 0) {
        const next: Record<number, string[]> = {};
        for (let zi = 0; zi < ZONES.length; zi++) {
          const occupants: string[] = [];
          for (let ti = 0; ti < trackInfos.length; ti++) {
            const ze = zoneEnergiesPerTrack[ti];
            if (!ze) continue;
            if (ze[zi] > ZONE_OCCUPY_DB) occupants.push(trackInfos[ti].name);
          }
          if (occupants.length >= 2) next[zi] = occupants;
        }
        setConflicts(next);
        onConflictsChangeRef.current?.(next as Record<string, string[]>);
      }

      // Conflict glow on the zone divider for any contested zone.
      for (const zi of Object.keys(conflicts)) {
        const idx = Number(zi);
        const z = ZONES[idx];
        const x0 = hzToX(z.lo) * w;
        const x1 = hzToX(z.hi) * w;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(239, 68, 68, 0.0)");
        grad.addColorStop(1, "rgba(239, 68, 68, 0.18)");
        ctx.fillStyle = grad;
        ctx.fillRect(x0, 0, x1 - x0, h);
        // Pulsing red dot at the top of the zone
        const pulse = 0.5 + 0.5 * Math.sin(conflictTick / 8);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.5})`;
        ctx.beginPath();
        ctx.arc((x0 + x1) / 2, 14, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [getTrackSpectrum, trackInfos, focusedTrack, hoverZone, conflicts]);

  const conflictCount = Object.keys(conflicts).length;

  return (
    <div className="flex flex-col gap-2">
      {/* Header strip: title + per-track legend chips (click to focus) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider text-foreground">
            SONIC X-RAY
          </span>
          <span className="text-[9px] text-muted">
            see what every track is doing in the frequency spectrum
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {trackInfos.map((t) => {
            const isFocus = focusedTrack === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFocusedTrack(isFocus ? null : t.id)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                  isFocus
                    ? "bg-surface-3 text-foreground"
                    : "bg-surface-2 text-muted hover:bg-surface-3"
                }`}
                title={isFocus ? "Show all tracks" : `Focus on ${t.name}`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.name.slice(0, 6)}
              </button>
            );
          })}
          {focusedTrack !== null && (
            <button
              onClick={() => setFocusedTrack(null)}
              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent text-white"
            >
              Show all
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverZone(null)}
          style={{ height: `${height}px` }}
          className="w-full block bg-surface-2 rounded cursor-crosshair"
        />
      </div>

      {/* Teaching strip: zone hint OR conflict warning */}
      <div className="min-h-[40px] rounded bg-surface-2 px-3 py-2 text-[10px] leading-snug">
        {hoverZone !== null ? (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: ZONES[hoverZone].color }}
              />
              <span className="font-bold text-foreground">
                {ZONES[hoverZone].name}
              </span>
              <span className="text-muted font-mono">
                {ZONES[hoverZone].lo}–
                {ZONES[hoverZone].hi >= 1000
                  ? `${ZONES[hoverZone].hi / 1000}k`
                  : ZONES[hoverZone].hi}
                Hz
              </span>
              {conflicts[hoverZone] && (
                <span className="text-danger font-bold">
                  · conflict: {conflicts[hoverZone].join(", ")}
                </span>
              )}
            </div>
            <div className="text-muted">
              <span className="text-foreground/80">{ZONES[hoverZone].what}</span>{" "}
              {ZONES[hoverZone].tip}
            </div>
          </div>
        ) : conflictCount > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-danger font-bold">
              {conflictCount} frequency conflict{conflictCount > 1 ? "s" : ""}
            </span>
            <span className="text-foreground/70">
              · hover any red zone to see who&apos;s fighting and how to fix it.
            </span>
            {onOpenMixDoctor && (
              <button
                onClick={onOpenMixDoctor}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Fix with Mix Doctor
              </button>
            )}
          </div>
        ) : (
          <div className="text-muted">
            hover a zone to learn what lives there · click a track chip to
            isolate · red glow = two or more tracks competing for the same
            frequencies
          </div>
        )}
      </div>
    </div>
  );
});
