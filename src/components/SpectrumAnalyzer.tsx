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

export const SpectrumAnalyzer = memo(function SpectrumAnalyzer({
  getSpectrum,
  getWaveform,
  height = 64,
}: {
  getSpectrum: () => Float32Array | null;
  getWaveform: () => Float32Array | null;
  height?: number;
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

          // Vertical gradient — body of the bar
          const grad = ctx.createLinearGradient(0, h - barH, 0, h);
          grad.addColorStop(0, "rgba(167, 139, 250, 0.95)");
          grad.addColorStop(1, "rgba(139, 92, 246, 0.4)");
          ctx.fillStyle = grad;
          ctx.fillRect(x + 0.5, h - barH, Math.max(1, barWidth - 1), barH);

          // Peak cap — single pixel marker that decays
          const peakY = h - peaks[i] * h;
          ctx.fillStyle = "rgba(232, 121, 249, 0.9)";
          ctx.fillRect(x + 0.5, peakY, Math.max(1, barWidth - 1), 1.5);
        }
      }

      // ── Oscilloscope overlay (time-domain) ────────────────
      if (waveform) {
        const len = waveform.length;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(232, 121, 249, 0.7)";
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
  }, [getSpectrum, getWaveform]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className="w-full block bg-surface-2 rounded"
    />
  );
});
