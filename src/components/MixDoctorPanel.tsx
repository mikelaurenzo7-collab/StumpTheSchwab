"use client";

import { memo, useCallback, useRef, useState } from "react";
import { useEngineStore } from "@/store/engine";

// ── Patch types matching the API route ───────────────────────────────────────
interface MixPatch {
  type: "trackEffect" | "trackVolume" | "trackPan" | "master";
  trackId?: number;
  key: string;
  value: number | boolean | string;
}

export interface MixSuggestion {
  title: string;
  explanation: string;
  category: "eq" | "volume" | "fx" | "master" | "arrangement" | "praise";
  urgency: "critical" | "recommended" | "optional";
  patches: MixPatch[];
}

// ── Category metadata ────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  eq:          { label: "EQ",          color: "#22c55e" },
  volume:      { label: "Volume",      color: "#06b6d4" },
  fx:          { label: "FX",          color: "#8b5cf6" },
  master:      { label: "Master",      color: "#f59e0b" },
  arrangement: { label: "Arrangement", color: "#ec4899" },
  praise:      { label: "Nice work",   color: "#6366f1" },
} as const;

const URGENCY_CONFIG = {
  critical:    { label: "CRITICAL",    color: "#ef4444" },
  recommended: { label: "REC",         color: "#f59e0b" },
  optional:    { label: "TIP",         color: "#71717a" },
} as const;

// ── Apply a patch to the Zustand store ───────────────────────────────────────
function useApplyPatches() {
  const setTrackEffect = useEngineStore((s) => s.setTrackEffect);
  const setTrackVolume = useEngineStore((s) => s.setTrackVolume);
  const setTrackPan    = useEngineStore((s) => s.setTrackPan);
  const setMaster      = useEngineStore((s) => s.setMaster);

  return useCallback((patches: MixPatch[]) => {
    for (const p of patches) {
      try {
        if (p.type === "trackEffect" && p.trackId !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setTrackEffect(p.trackId, p.key as any, p.value as any);
        } else if (p.type === "trackVolume" && p.trackId !== undefined) {
          setTrackVolume(p.trackId, Number(p.value));
        } else if (p.type === "trackPan" && p.trackId !== undefined) {
          setTrackPan(p.trackId, Number(p.value));
        } else if (p.type === "master") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setMaster(p.key as any, p.value as any);
        }
      } catch {
        // Silently ignore invalid patches — AI might suggest something we don't support yet
      }
    }
  }, [setTrackEffect, setTrackVolume, setTrackPan, setMaster]);
}

// ── Build the mix analysis object to send to the API ─────────────────────────
function buildAnalysis(
  lufs: number | null,
  truePeak: number | null,
  conflicts: Record<string, string[]>
) {
  const s = useEngineStore.getState();
  return {
    bpm: s.bpm,
    swing: s.swing,
    tracks: s.tracks.map((t) => ({
      id: t.id,
      name: t.customSampleName ?? t.sound.name,
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      eqOn: t.effects.trackEqOn,
      eqLow: t.effects.trackEqLow,
      eqMid: t.effects.trackEqMid,
      eqHigh: t.effects.trackEqHigh,
      driveOn: t.effects.driveOn,
      driveAmount: t.effects.driveAmount,
      filterOn: t.effects.filterOn,
      filterType: t.effects.filterType,
      filterFreq: t.effects.filterFreq,
      reverbOn: t.effects.reverbOn,
      delayOn: t.effects.delayOn,
      sidechainOn: t.effects.sidechainOn,
      sidechainSource: t.effects.sidechainSource,
      activeSteps: t.steps.filter((v) => v > 0).length,
      totalSteps: s.totalSteps,
    })),
    lufs,
    truePeak,
    conflicts,
    masterEqOn: s.master.eqOn,
    masterEqLow: s.master.eqLow,
    masterEqMid: s.master.eqMid,
    masterEqHigh: s.master.eqHigh,
    masterCompOn: s.master.compressorOn,
    masterLimiterOn: s.master.limiterOn,
    masterLimiterCeiling: s.master.limiterThreshold,
    masterWarmthOn: s.master.warmthOn,
    masterWarmth: s.master.warmth,
    loudnessTarget: s.master.loudnessTarget,
  };
}

// ── SuggestionCard ────────────────────────────────────────────────────────────
const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  onApply,
}: {
  suggestion: MixSuggestion;
  onApply: (patches: MixPatch[]) => void;
}) {
  const [applied, setApplied] = useState(false);
  const cat = CATEGORY_CONFIG[suggestion.category];
  const urg = URGENCY_CONFIG[suggestion.urgency];
  const hasPatches = suggestion.patches.length > 0;

  const handleApply = () => {
    onApply(suggestion.patches);
    setApplied(true);
  };

  return (
    <div
      className={`flex flex-col gap-1.5 p-3 rounded-lg border transition-all ${
        applied
          ? "border-success/40 bg-success/5"
          : suggestion.urgency === "critical"
            ? "border-danger/30 bg-danger/5"
            : "border-border/60 bg-surface-2/60"
      }`}
      style={{ animation: "fade-in-up 0.18s ease-out both" }}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Urgency badge */}
        <span
          className="px-1 py-0.5 rounded text-[8px] font-bold text-white leading-none"
          style={{ backgroundColor: urg.color }}
        >
          {urg.label}
        </span>
        {/* Category badge */}
        <span
          className="px-1 py-0.5 rounded text-[8px] font-bold leading-none"
          style={{ backgroundColor: `${cat.color}30`, color: cat.color }}
        >
          {cat.label}
        </span>
        <span className="text-[11px] font-semibold text-foreground flex-1">
          {suggestion.title}
        </span>
        {applied && (
          <span className="text-[9px] text-success font-bold">APPLIED ✓</span>
        )}
      </div>
      <p className="text-[10px] text-foreground/80 leading-snug">
        {suggestion.explanation}
      </p>
      {hasPatches && !applied && (
        <button
          onClick={handleApply}
          className="self-start px-2 py-0.5 rounded text-[9px] font-bold bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Apply fix
        </button>
      )}
    </div>
  );
});

// ── Main panel ────────────────────────────────────────────────────────────────
export const MixDoctorPanel = memo(function MixDoctorPanel({
  getLoudness,
  getTruePeak,
  conflicts,
  isOpen,
  onClose,
}: {
  getLoudness: () => number;
  getTruePeak: () => number;
  conflicts: Record<string, string[]>;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [suggestions, setSuggestions] = useState<MixSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const applyPatches = useApplyPatches();
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async () => {
    if (loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const lufsRaw = getLoudness();
      const tpRaw = getTruePeak();
      const analysis = buildAnalysis(
        isFinite(lufsRaw) ? lufsRaw : null,
        isFinite(tpRaw) ? tpRaw : null,
        conflicts
      );

      const res = await fetch("/api/mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const j = (await res.json()) as { suggestions: MixSuggestion[] };
      setSuggestions(j.suggestions ?? []);
      setLastRun(new Date());
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loading, getLoudness, getTruePeak, conflicts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div
        className="w-full max-w-lg bg-surface border border-border/70 rounded-xl shadow-2xl flex flex-col gap-0 overflow-hidden pointer-events-auto"
        style={{ maxHeight: "80vh", animation: "slide-in-right 0.22s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60 bg-surface-2/80">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" style={{ boxShadow: "0 0 6px var(--accent-glow)" }} />
            <span className="text-[12px] font-bold tracking-wider text-foreground">
              MIX DOCTOR
            </span>
            <span className="text-[9px] text-muted">
              AI co-producer · reads your session · gives specific fixes
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-[14px] leading-none px-1"
          >
            ✕
          </button>
        </div>

        {/* Analyze button area */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <button
            onClick={analyze}
            disabled={loading}
            className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors ${
              loading
                ? "bg-surface-3 text-muted cursor-not-allowed"
                : "bg-accent text-white hover:bg-accent-hover"
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-pulse">✦</span>
                Analyzing…
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span>✦</span>
                Analyze my mix
              </span>
            )}
          </button>
          {lastRun && !loading && (
            <span className="text-[9px] text-muted">
              last run {lastRun.toLocaleTimeString()}
            </span>
          )}
          {!lastRun && !loading && (
            <span className="text-[10px] text-foreground/60">
              Claude reads your session and gives specific, one-click fixes
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {error && (
            <div className="p-2 rounded bg-danger/10 border border-danger/30 text-[10px] text-danger">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex flex-col gap-2 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg shimmer" />
              ))}
              <p className="text-center text-[10px] text-muted">
                listening to your mix…
              </p>
            </div>
          )}

          {!loading && suggestions.length === 0 && lastRun && (
            <p className="text-center text-[11px] text-muted py-4">
              No suggestions — mix looks clean. Make some changes and analyze again.
            </p>
          )}

          {suggestions.map((s, i) => (
            <SuggestionCard
              key={i}
              suggestion={s}
              onApply={applyPatches}
            />
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t border-border bg-surface-2 text-[9px] text-muted">
          suggestions are specific to your current session state · re-analyze after applying fixes
        </div>
      </div>
    </div>
  );
});
