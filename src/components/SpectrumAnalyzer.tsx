"use client";

import { memo, useEffect, useRef } from "react";

// Map a normalized x in [0,1] to a log-scaled frequency bin index. Audio is
// most informative on a log axis — 100Hz to 200Hz takes the same eye-space
// as 10kHz to 20kHz, which is how producers actually think about EQ.
function logBinIndex(x: number, binCount: number, sampleRate: number): number {
  const minHz = 30;
  const maxHz = sampleRate / 2;
  const hz = minHz * Math.pow(maxHz / minHz, x);
  const idx = Math.round((hz / maxHz) * binCount);
  return Math.max(0, Math.min(binCount - 1, idx));
}

// Producer-vocab frequency zones. Boundaries are textbook mixing splits —
// when the X-ray overlay is on, bars get tinted by zone and lo/hi guides are
// drawn so the eye learns where energy lives. This is the teaching surface.
const ZONES: { short: string; lo: number; hi: number; color: string; rgba: string }[] = [
  { short: "SUB",  lo: 20,    hi: 60,    color: "#7c3aed", rgba: "rgba(124,58,237,0.55)" },
  { short: "BASS", lo: 60,    hi: 250,   color: "#6366f1", rgba: "rgba(99,102,241,0.55)" },
  { short: "LOMID",lo: 250,   hi: 500,   color: "#06b6d4", rgba: "rgba(6,182,212,0.55)"  },
  { short: "MID",  lo: 500,   hi: 2000,  color: "#22c55e", rgba: "rgba(34,197,94,0.55)"  },
  { short: "PRES", lo: 2000,  hi: 6000,  color: "#f59e0b", rgba: "rgba(245,158,11,0.55)" },
  { short: "AIR",  lo: 6000,  hi: 20000, color: "#ec4899", rgba: "rgba(236,72,153,0.55)" },
];

function hzForX(x: number): number {
  const minHz = 30;
  const maxHz = 22050;
  return minHz * Math.pow(maxHz / minHz, x);
}

function xForHz(hz: number): number {
  const minHz = 30;
  const maxHz = 22050;
  return Math.log(hz / minHz) / Math.log(maxHz / minHz);
}

function zoneIndexForHz(hz: number): number {
  for (let i = 0; i < ZONES.length; i++) {
    if (hz < ZONES[i].hi) return i;
  }
  return ZONES.length - 1;
}

export const SpectrumAnalyzer = memo(function SpectrumAnalyzer({
  getSpectrum,
  getWaveform,
  height = 64,
  xrayOn = false,
}: {
  getSpectrum: () => Float32Array | null;
  getWaveform: () => Float32Array | null;
  height?: number;
  xrayOn?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Per-bar peak hold so loud transients leave a visible afterimage that
  // decays — same trick as a hardware analyzer.
  const peaksRef = useRef<Float32Array | null>(null);

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
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const sampleRate = 44100;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // Translucent fill = nice motion-trail / glow look without GPU shaders.
      ctx.fillStyle = "rgba(15, 14, 23, 0.45)";
      ctx.fillRect(0, 0, w, h);

      const spectrum = getSpectrum();
      const waveform = getWaveform();

      // ── Zone bands (X-Ray overlay) ────────────────────────
      // Vertical guide lines at zone boundaries + a thin label strip along
      // the top. Drawn before the spectrum so bars sit on top.
      if (xrayOn) {
        ctx.fillStyle = "rgba(15, 14, 23, 0.0)";
        for (let z = 0; z < ZONES.length; z++) {
          const zone = ZONES[z];
          const xLo = xForHz(zone.lo) * w;
          const xHi = xForHz(zone.hi) * w;
          // Faint band fill so the zone is visible at rest.
          ctx.fillStyle = zone.rgba.replace("0.55", "0.06");
          ctx.fillRect(xLo, 0, Math.max(1, xHi - xLo), h);
          // Boundary line.
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(xHi, 0);
          ctx.lineTo(xHi, h);
          ctx.stroke();
          // Label.
          ctx.fillStyle = zone.color;
          ctx.font = "9px ui-monospace, monospace";
          ctx.textBaseline = "top";
          const labelX = xLo + (xHi - xLo) / 2 - ctx.measureText(zone.short).width / 2;
          ctx.fillText(zone.short, labelX, 2);
        }
      }

      // ── Spectrum bars (log freq axis, dB on y) ────────────
      if (spectrum) {
        const binCount = spectrum.length;
        const barCount = Math.min(96, Math.floor(w / 3));
        const barWidth = w / barCount;

        if (!peaksRef.current || peaksRef.current.length !== barCount) {
          peaksRef.current = new Float32Array(barCount);
        }
        const peaks = peaksRef.current;

        for (let i = 0; i < barCount; i++) {
          const xStart = i / barCount;
          const xEnd = (i + 1) / barCount;
          const binStart = logBinIndex(xStart, binCount, sampleRate);
          const binEnd = Math.max(binStart + 1, logBinIndex(xEnd, binCount, sampleRate));

          // Average dB over the bin range so wider log buckets stay smooth.
          let sum = 0;
          for (let b = binStart; b < binEnd; b++) sum += spectrum[b];
          const db = sum / (binEnd - binStart);

          // Map -100 dB .. 0 dB to 0..1
          const norm = Math.max(0, Math.min(1, (db + 100) / 100));

          // Peak hold with slow decay
          if (norm > peaks[i]) {
            peaks[i] = norm;
          } else {
            peaks[i] = Math.max(0, peaks[i] - 0.012);
          }

          const barH = norm * h;
          const x = i * barWidth;

          // In X-Ray mode tint the bar by its dominant frequency zone so the
          // user can see at a glance which zones are eating headroom.
          if (xrayOn) {
            const centreHz = hzForX((i + 0.5) / barCount);
            const zone = ZONES[zoneIndexForHz(centreHz)];
            const grad = ctx.createLinearGradient(0, h - barH, 0, h);
            grad.addColorStop(0, zone.rgba.replace("0.55", "0.95"));
            grad.addColorStop(1, zone.rgba.replace("0.55", "0.35"));
            ctx.fillStyle = grad;
          } else {
            const grad = ctx.createLinearGradient(0, h - barH, 0, h);
            grad.addColorStop(0, "rgba(167, 139, 250, 0.95)");
            grad.addColorStop(1, "rgba(139, 92, 246, 0.4)");
            ctx.fillStyle = grad;
          }
          ctx.fillRect(x + 0.5, h - barH, Math.max(1, barWidth - 1), barH);

          // Peak cap — single pixel marker that decays
          ctx.fillStyle = xrayOn ? "rgba(255,255,255,0.85)" : "rgba(232, 121, 249, 0.9)";
          const peakY = h - peaks[i] * h;
          ctx.fillRect(x + 0.5, peakY, Math.max(1, barWidth - 1), 1.5);
        }
      }

      // ── Oscilloscope overlay (time-domain) ────────────────
      if (waveform) {
        const len = waveform.length;
        ctx.beginPath();
        ctx.strokeStyle = xrayOn ? "rgba(255,255,255,0.45)" : "rgba(232, 121, 249, 0.7)";
        ctx.lineWidth = 1;
        for (let i = 0; i < len; i++) {
          const x = (i / (len - 1)) * w;
          const y = h / 2 + (waveform[i] * h) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [getSpectrum, getWaveform, xrayOn]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className="w-full block bg-surface-2 rounded"
    />
  );
});
