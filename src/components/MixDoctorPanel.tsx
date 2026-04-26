"use client";

import { memo, useCallback, useState } from "react";
import { useEngineStore } from "@/store/engine";
import type { MixSuggestion } from "@/app/api/mix-doctor/route";
import { applyMixPatch, type MixPatch } from "@/lib/patchValidation";

// ── Snapshot builder ─────────────────────────────────────────────────────────
// Collects the current mix state into the compact JSON that the route expects.
export function buildMixSnapshot(
  getMasterSpectrum: () => Float32Array | null,
  getLoudness: () => number,
  getTruePeak: () => number,
) {
  const state = useEngineStore.getState();
  const spectrum = getMasterSpectrum();

  // Compute 6-zone energy averages from the FFT — same boundaries as X-Ray.
  const zones = [
    { name: "sub",      lo: 20,   hi: 60    },
    { name: "bass",     lo: 60,   hi: 250   },
    { name: "lo-mid",   lo: 250,  hi: 500   },
    { name: "mid",      lo: 500,  hi: 2000  },
    { name: "presence", lo: 2000, hi: 6000  },
    { name: "air",      lo: 6000, hi: 20000 },
  ];
  const sampleRate = 44100;
  const zoneEnergies: Record<string, number> = {};
  if (spectrum) {
    const n = spectrum.length;
    for (const z of zones) {
      const startBin = Math.max(0, Math.floor((z.lo / (sampleRate / 2)) * n));
      const endBin   = Math.min(n, Math.ceil((z.hi / (sampleRate / 2)) * n));
      if (endBin > startBin) {
        let sum = 0;
        for (let i = startBin; i < endBin; i++) sum += spectrum[i];
        zoneEnergies[z.name] = parseFloat((sum / (endBin - startBin)).toFixed(1));
      } else {
        zoneEnergies[z.name] = -100;
      }
    }
  }

  return {
    bpm: state.bpm,
    swing: state.swing,
    totalSteps: state.totalSteps,
    lufs: Number.isFinite(getLoudness()) ? parseFloat(getLoudness().toFixed(1)) : null,
    truePeak: Number.isFinite(getTruePeak()) ? parseFloat(getTruePeak().toFixed(1)) : null,
    loudnessTarget: state.master.loudnessTarget,
    master: {
      volume:               state.master.volume,
      eqOn:                 state.master.eqOn,
      eqLow:                state.master.eqLow,
      eqMid:                state.master.eqMid,
      eqHigh:               state.master.eqHigh,
      compressorOn:         state.master.compressorOn,
      compressorThreshold:  state.master.compressorThreshold,
      compressorRatio:      state.master.compressorRatio,
      limiterOn:            state.master.limiterOn,
      limiterThreshold:     state.master.limiterThreshold,
      tapeOn:               state.master.tapeOn,
      tapeAmount:           state.master.tapeAmount,
      widthOn:              state.master.widthOn,
      width:                state.master.width,
    },
    spectrumZones: zoneEnergies,
    tracks: state.tracks.map((t) => ({
      id:      t.id,
      name:    t.customSampleName ?? t.sound.name,
      volume:  t.volume,
      pan:     t.pan,
      muted:   t.muted,
      solo:    t.solo,
      effects: {
        filterOn:        t.effects.filterOn,
        filterType:      t.effects.filterType,
        filterFreq:      t.effects.filterFreq,
        filterQ:         t.effects.filterQ,
        driveOn:         t.effects.driveOn,
        driveAmount:     t.effects.driveAmount,
        delayOn:         t.effects.delayOn,
        delayTime:       t.effects.delayTime,
        delayFeedback:   t.effects.delayFeedback,
        delayWet:        t.effects.delayWet,
        reverbOn:        t.effects.reverbOn,
        reverbDecay:     t.effects.reverbDecay,
        reverbWet:       t.effects.reverbWet,
        sidechainOn:     t.effects.sidechainOn,
        sidechainDepth:  t.effects.sidechainDepth,
      },
    })),
  };
}

// ── Urgency colours ───────────────────────────────────────────────────────────
const URGENCY_STYLE: Record<MixSuggestion["urgency"], string> = {
  critical:    "border-red-500/50 bg-red-500/10",
  recommended: "border-amber-400/50 bg-amber-400/10",
  optional:    "border-border bg-surface-2",
};
const URGENCY_DOT: Record<MixSuggestion["urgency"], string> = {
  critical:    "bg-red-400",
  recommended: "bg-amber-300",
  optional:    "bg-border",
};
const CATEGORY_COLOR: Record<MixSuggestion["category"], string> = {
  eq:          "text-cyan-400",
  volume:      "text-blue-400",
  fx:          "text-purple-400",
  master:      "text-accent",
  arrangement: "text-pink-400",
  praise:      "text-emerald-400",
};

// ── Main panel ────────────────────────────────────────────────────────────────
export const MixDoctorPanel = memo(function MixDoctorPanel({
  getMasterSpectrum,
  getLoudness,
  getTruePeak,
}: {
  getMasterSpectrum: () => Float32Array | null;
  getLoudness: () => number;
  getTruePeak: () => number;
}) {
  const [loading, setLoading]             = useState(false);
  const [suggestions, setSuggestions]     = useState<MixSuggestion[] | null>(null);
  const [dismissed, setDismissed]         = useState<Set<number>>(new Set());
  const [applied, setApplied]             = useState<Set<number>>(new Set());
  const [error, setError]                 = useState<string | null>(null);

  const applyPatch = useCallback((p: MixPatch) => { applyMixPatch(p); }, []);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    setDismissed(new Set());
    setApplied(new Set());

    try {
      const snapshot = buildMixSnapshot(getMasterSpectrum, getLoudness, getTruePeak);
      const res = await fetch("/api/mix-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setSuggestions(data.suggestions as MixSuggestion[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [getMasterSpectrum, getLoudness, getTruePeak]);

  const handleApply = useCallback((idx: number, patches: MixPatch[]) => {
    patches.forEach(applyPatch);
    setApplied((prev) => new Set([...prev, idx]));
  }, [applyPatch]);

  const handleDismiss = useCallback((idx: number) => {
    setDismissed((prev) => new Set([...prev, idx]));
  }, []);

  const handleApplyAll = useCallback(() => {
    if (!suggestions) return;
    suggestions.forEach((s, i) => {
      if (!dismissed.has(i) && !applied.has(i)) {
        s.patches.forEach(applyPatch);
        setApplied((prev) => new Set([...prev, i]));
      }
    });
  }, [suggestions, dismissed, applied, applyPatch]);

  const visible = suggestions?.filter((_, i) => !dismissed.has(i));

  return (
    <div className="flex flex-col gap-3">
      {/* Run button */}
      <div className="flex items-center gap-2">
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="button-primary flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Analyzing mix…
            </>
          ) : (
            <>✦ Analyze Mix</>
          )}
        </button>
        {visible && visible.length > 0 && !applied.size && (
          <button
            onClick={handleApplyAll}
            className="button-secondary rounded-lg px-3 py-2 text-[11px] font-semibold"
          >
            Apply All
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
          {error}
        </div>
      )}

      {/* Suggestion cards */}
      {visible && visible.length === 0 && (
        <p className="text-[11px] text-muted">All suggestions dismissed.</p>
      )}
      {visible?.map((s) => {
        const idx = suggestions!.indexOf(s);
        const isApplied = applied.has(idx);
        return (
          <div
            key={idx}
            className={`rounded-lg border p-3 transition-opacity ${URGENCY_STYLE[s.urgency]} ${
              isApplied ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${URGENCY_DOT[s.urgency]}`} />
                <span className="text-[11px] font-bold text-foreground">{s.title}</span>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${CATEGORY_COLOR[s.category]}`}>
                  {s.category}
                </span>
              </div>
              <button
                onClick={() => handleDismiss(idx)}
                className="shrink-0 text-muted hover:text-foreground text-[11px] leading-none"
                title="Dismiss"
              >
                ×
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-soft">{s.explanation}</p>
            <div className="mt-2 flex items-center gap-2">
              {!isApplied ? (
                <button
                  onClick={() => handleApply(idx, s.patches)}
                  className="button-primary rounded-md px-2.5 py-1 text-[10px] font-bold"
                >
                  Apply
                </button>
              ) : (
                <span className="text-[10px] text-emerald-400 font-semibold">✓ Applied</span>
              )}
              <span className="text-[9px] text-muted">
                {s.patches.length} patch{s.patches.length !== 1 ? "es" : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
