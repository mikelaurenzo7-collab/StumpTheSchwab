"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  useEngineStore,
  type ApplyCoverInput,
  type GeneratedBeat,
} from "@/store/engine";
import {
  analyzeSong,
  disposeAnalysis,
  type SongAnalysis,
} from "@/lib/songAnalyzer";
import { encodeWAV } from "@/lib/wavEncoder";
import type { CoverResult } from "@/app/api/cover/route";
import { ErrorChip } from "./ErrorChip";

type Stage = "idle" | "analyzing" | "ready" | "covering" | "done";

export const CoverSongModal = memo(function CoverSongModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const applyCoverSong = useEngineStore((s) => s.applyCoverSong);

  const [stage, setStage]                 = useState<Stage>("idle");
  const [progress, setProgress]           = useState("");
  const [error, setError]                 = useState<string | null>(null);
  const [analysis, setAnalysis]           = useState<SongAnalysis | null>(null);
  const [coverResult, setCoverResult]     = useState<CoverResult | null>(null);
  const [direction, setDirection]         = useState("");
  const [fileName, setFileName]           = useState<string>("");

  const fileRef = useRef<HTMLInputElement>(null);

  // Free blob URLs on unmount or when starting fresh
  useEffect(() => {
    return () => {
      if (analysis) disposeAnalysis(analysis);
    };
  }, [analysis]);

  const reset = useCallback(() => {
    if (analysis) disposeAnalysis(analysis);
    setAnalysis(null);
    setCoverResult(null);
    setError(null);
    setProgress("");
    setStage("idle");
    setDirection("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }, [analysis]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setStage("analyzing");
    setProgress("Decoding audio…");
    try {
      // Yield to the UI between decode + analyze so the spinner renders
      await new Promise((r) => requestAnimationFrame(r));
      setProgress("Detecting tempo · key · sections · slicing bars…");
      const result = await analyzeSong(file);
      setAnalysis(result);
      setStage("ready");
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStage("idle");
    }
  }, []);

  const handleCover = useCallback(async () => {
    if (!analysis) return;
    setStage("covering");
    setError(null);
    try {
      // Send only metadata for bar slices (no audio) — Claude picks indices
      const barMeta = analysis.barSlices
        .map((s) => ({ index: s.index, startSec: Math.round(s.startSec * 100) / 100, rms: Math.round(s.rms * 1000) / 1000 }))
        .sort((a, b) => b.rms - a.rms)
        .slice(0, 12);

      const res = await fetch("/api/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descriptor: JSON.stringify(analysis.descriptor),
          barSlices: JSON.stringify(barMeta),
          direction: direction.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setCoverResult(json as CoverResult);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover request failed.");
      setStage("ready");
    }
  }, [analysis, direction]);

  const handleApply = useCallback(() => {
    if (!analysis || !coverResult) return;
    try {
      // Build patternBeats: map roles to slots 0..7 in order
      const patternBeats = coverResult.patterns.map((p, i) => {
        const beat: GeneratedBeat = {
          name: p.name,
          bpm: coverResult.bpm,
          swing: coverResult.swing,
          totalSteps: coverResult.totalSteps,
          tracks: p.tracks as GeneratedBeat["tracks"],
          melodicNotes: p.melodicNotes as GeneratedBeat["melodicNotes"],
          explanation: p.explanation,
        };
        return { slot: i, beat };
      });

      // Build sample loads from sample_picks (concat selected bar slices into one WAV blob)
      const sampleLoads: ApplyCoverInput["sampleLoads"] = [];
      for (const pick of coverResult.sample_picks ?? []) {
        const slices = pick.bar_indices
          .map((idx) => analysis.barSlices.find((s) => s.index === idx))
          .filter((s): s is NonNullable<typeof s> => !!s);
        if (slices.length === 0) continue;
        // Concat: build an AudioBuffer covering all picked bars from the source
        const sr = analysis.sourceBuffer.sampleRate;
        const samplesPerBar = Math.round((60 / coverResult.bpm) * 4 * sr);
        const totalLen = samplesPerBar * slices.length;
        const out = new AudioBuffer({
          numberOfChannels: analysis.sourceBuffer.numberOfChannels,
          length: totalLen,
          sampleRate: sr,
        });
        for (let ch = 0; ch < out.numberOfChannels; ch++) {
          const dest = new Float32Array(totalLen);
          slices.forEach((s, k) => {
            const startSample = s.index * samplesPerBar;
            const src = analysis.sourceBuffer.getChannelData(ch);
            for (let i = 0; i < samplesPerBar && startSample + i < src.length; i++) {
              dest[k * samplesPerBar + i] = src[startSample + i];
            }
          });
          out.copyToChannel(dest, ch);
        }
        const blob = encodeWAV(out);
        const url = URL.createObjectURL(blob);
        sampleLoads.push({
          trackId: pick.slot,
          url,
          name: `Cover bar${slices.length > 1 ? "s" : ""} ${slices.map((s) => s.index).join("+")}`,
        });
      }

      applyCoverSong({
        bpm: coverResult.bpm,
        swing: coverResult.swing,
        totalSteps: coverResult.totalSteps,
        kitPackId: coverResult.kit_pack ?? null,
        patternBeats,
        chain: coverResult.chain,
        sampleLoads,
      });

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed.");
    }
  }, [analysis, coverResult, applyCoverSong, handleClose]);

  if (!open) return null;

  const d = analysis?.descriptor;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="max-h-[90vh] w-[92vw] max-w-[520px] overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Cover Song</p>
            <h2 className="text-lg font-bold text-foreground">📥 Import a song, get a remix</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-[18px] text-muted hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && <ErrorChip message={error} className="mb-3" />}

        {/* Stage: idle / file picker */}
        {(stage === "idle" || stage === "analyzing") && (
          <div>
            <p className="mb-3 text-[12px] text-soft">
              Drop in any audio file. We&rsquo;ll detect tempo, key, sections, and energy contour, then
              Claude builds a remix-ready 8-pattern arrangement using StumpTheSchwab voices —
              optionally loading the most distinctive bars from the original as samples.
            </p>
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accent/40 bg-accent/5 px-4 py-8 text-center hover:bg-accent/10 ${
                stage === "analyzing" ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <span className="text-[24px]">{stage === "analyzing" ? "⌛" : "🎵"}</span>
              <span className="text-[11px] font-semibold text-accent">
                {stage === "analyzing" ? "Analyzing…" : fileName || "Choose audio file"}
              </span>
              {stage === "analyzing" && progress && (
                <span className="text-[10px] text-muted">{progress}</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFile}
                disabled={stage === "analyzing"}
              />
            </label>
          </div>
        )}

        {/* Stage: ready */}
        {stage === "ready" && d && (
          <div>
            <p className="mb-2 text-[11px] font-semibold text-soft">Analysis ready</p>
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-3 text-[11px]">
              <div>
                <span className="text-muted">Duration </span>
                <span className="text-foreground">{Math.round(d.durationSeconds)}s</span>
              </div>
              <div>
                <span className="text-muted">Tempo </span>
                <span className="text-foreground">{d.estimatedBpm} BPM</span>
              </div>
              <div>
                <span className="text-muted">Key </span>
                <span className="text-foreground">{d.estimatedKey.tonic} {d.estimatedKey.mode}</span>
              </div>
              <div>
                <span className="text-muted">Sections </span>
                <span className="text-foreground">{d.sections.length}</span>
              </div>
              <div>
                <span className="text-muted">Bar slices </span>
                <span className="text-foreground">{analysis?.barSlices.length ?? 0}</span>
              </div>
              <div>
                <span className="text-muted">Loudness </span>
                <span className="text-foreground">{(20 * Math.log10(Math.max(d.overallRms, 1e-6))).toFixed(1)} dB</span>
              </div>
            </div>
            <input
              type="text"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="Optional direction… (e.g. lean trap, slower, dark)"
              className="mb-2 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="button-secondary flex-1 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
              >
                Try another
              </button>
              <button
                onClick={handleCover}
                className="button-primary flex-[2] rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
              >
                ✨ Cover with Claude
              </button>
            </div>
          </div>
        )}

        {/* Stage: covering */}
        {stage === "covering" && (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-[28px]">⌛</span>
            <p className="text-[11px] text-soft">Claude is building your arrangement…</p>
            <p className="text-[10px] text-muted">8 patterns + chain + kit + samples</p>
          </div>
        )}

        {/* Stage: done */}
        {stage === "done" && coverResult && (
          <div>
            <p className="mb-2 text-[11px] font-semibold text-soft">Arrangement ready</p>
            <p className="mb-3 text-[11px] text-foreground">{coverResult.explanation}</p>
            <div className="mb-3 space-y-1.5 rounded-lg bg-surface-2 p-3 text-[11px]">
              <div>
                <span className="text-muted">Setup </span>
                <span className="text-foreground">{coverResult.bpm} BPM · {Math.round(coverResult.swing * 100)}% swing · {coverResult.totalSteps} steps · {coverResult.kit_pack} kit</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {coverResult.patterns.map((p, i) => (
                  <span key={i} className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                    {p.role} · {p.name}
                  </span>
                ))}
              </div>
              <div className="text-muted">
                Chain: {coverResult.chain.join(" → ")}
              </div>
              {coverResult.sample_picks && coverResult.sample_picks.length > 0 && (
                <div className="text-muted">
                  Samples: {coverResult.sample_picks.length} bar pick{coverResult.sample_picks.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="button-secondary flex-1 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
              >
                Discard
              </button>
              <button
                onClick={handleApply}
                className="button-primary flex-[2] rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
              >
                Apply to Project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
