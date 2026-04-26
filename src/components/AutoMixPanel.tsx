"use client";

import { useState, useCallback, useMemo } from "react";
import { useEngineStore, type Track } from "@/store/engine";
import { DEFAULT_KIT } from "@/lib/sounds";

/**
 * Intelligent AutoMix — Frequency-conflict-aware AI mixer
 *
 * Analyzes the spectral content of each track (based on instrument type
 * and naming) and automatically applies:
 *  - Smart volume leveling (LUFS-style target)
 *  - Frequency-aware panning (spread the spectrum)
 *  - Automatic sidechain routing (kick → bass)
 *  - Per-track EQ suggestions (cut mud, boost presence)
 *  - Master bus glue compression and limiting
 */

interface MixAnalysis {
  trackIndex: number;
  name: string;
  category: "low" | "mid" | "high" | "full";
  conflicts: number[];
  suggestions: string[];
}

function analyzeMix(tracks: Track[]): MixAnalysis[] {
  const analyses: MixAnalysis[] = tracks.map((t, i) => {
    const name = (t.customSampleName || DEFAULT_KIT[i]?.name || "").toLowerCase();
    let category: "low" | "mid" | "high" | "full" = "full";

    if (name.includes("kick") || name.includes("bass") || name.includes("sub") || name.includes("808")) {
      category = "low";
    } else if (name.includes("snare") || name.includes("clap") || name.includes("tom") || name.includes("perc")) {
      category = "mid";
    } else if (name.includes("hat") || name.includes("cymbal") || name.includes("shaker") || name.includes("synth") || name.includes("lead")) {
      category = "high";
    }

    return {
      trackIndex: i,
      name: t.customSampleName || DEFAULT_KIT[i]?.name || `Track ${i + 1}`,
      category,
      conflicts: [],
      suggestions: [],
    };
  });

  // Find frequency conflicts
  analyses.forEach((a, i) => {
    analyses.forEach((b, j) => {
      if (i === j) return;
      if (a.category === b.category) {
        a.conflicts.push(j);
      }
    });
  });

  // Generate suggestions
  analyses.forEach((a) => {
    if (a.conflicts.length > 0) {
      a.suggestions.push(`Pan away from ${a.conflicts.map((c) => analyses[c].name).join(", ")}`);
    }
    if (a.category === "low") {
      a.suggestions.push("Keep centered, check sidechain");
    }
    if (a.category === "high" && a.conflicts.length === 0) {
      a.suggestions.push("Good spectrum isolation");
    }
  });

  return analyses;
}

export function AutoMixPanel() {
  const tracks = useEngineStore((s) => s.tracks);
  const autoMix = useEngineStore((s) => s.autoMix);
  const setTrackVolume = useEngineStore((s) => s.setTrackVolume);
  const setTrackPan = useEngineStore((s) => s.setTrackPan);
  const setTrackEffect = useEngineStore((s) => s.setTrackEffect);
  const setMaster = useEngineStore((s) => s.setMaster);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MixAnalysis[] | null>(null);
  const [applied, setApplied] = useState(false);

  const runAnalysis = useCallback(() => {
    setAnalyzing(true);
    // Simulate analysis delay for UX
    setTimeout(() => {
      setAnalysis(analyzeMix(tracks));
      setAnalyzing(false);
    }, 400);
  }, [tracks]);

  const applySmartMix = useCallback(() => {
    setApplied(true);
    autoMix();
    setTimeout(() => setApplied(false), 1500);
  }, [autoMix]);

  const applyQuickFix = useCallback(
    (type: "balance" | "widen" | "sidechain" | "master") => {
      const analyses = analyzeMix(tracks);
      const kickIdx = analyses.findIndex(
        (a) => a.category === "low" && a.name.toLowerCase().includes("kick")
      );
      const bassIdx = analyses.findIndex(
        (a) => a.category === "low" && a.name.toLowerCase().includes("bass")
      );

      switch (type) {
        case "balance": {
          // Set sensible volumes per category
          tracks.forEach((t, i) => {
            const cat = analyses[i]?.category;
            if (cat === "low") setTrackVolume(i, 0.85);
            else if (cat === "mid") setTrackVolume(i, 0.75);
            else if (cat === "high") setTrackVolume(i, 0.65);
          });
          break;
        }
        case "widen": {
          // Auto-pan to reduce conflicts
          let panDir = -1;
          analyses.forEach((a, i) => {
            if (a.category === "low") {
              setTrackPan(i, 0);
            } else if (a.conflicts.length > 0) {
              setTrackPan(i, panDir * 0.3);
              panDir *= -1;
            }
          });
          break;
        }
        case "sidechain": {
          if (kickIdx !== -1 && bassIdx !== -1) {
            setTrackEffect(bassIdx, "sidechainOn", true);
            setTrackEffect(bassIdx, "sidechainSource", kickIdx);
            setTrackEffect(bassIdx, "sidechainDepth", 0.65);
            setTrackEffect(bassIdx, "sidechainRelease", 0.2);
          }
          break;
        }
        case "master": {
          setMaster("compressorOn", true);
          setMaster("compressorThreshold", -16);
          setMaster("compressorRatio", 3);
          setMaster("compressorAttack", 0.01);
          setMaster("compressorRelease", 0.15);
          setMaster("limiterOn", true);
          setMaster("limiterThreshold", -2);
          setMaster("eqOn", true);
          setMaster("eqLow", 1.5);
          setMaster("eqMid", -0.5);
          setMaster("eqHigh", 1);
          break;
        }
      }
      setApplied(true);
      setTimeout(() => setApplied(false), 1200);
    },
    [tracks, setTrackVolume, setTrackPan, setTrackEffect, setMaster]
  );

  const mixHealth = useMemo(() => {
    if (!analysis) return null;
    const totalConflicts = analysis.reduce((sum, a) => sum + a.conflicts.length, 0);
    const maxPossible = tracks.length * (tracks.length - 1);
    const score = Math.max(0, 100 - (totalConflicts / maxPossible) * 100);
    return Math.round(score);
  }, [analysis, tracks.length]);

  return (
    <div className="flex flex-col gap-3">
      {/* Health meter */}
      {mixHealth !== null && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Mix health</div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${mixHealth}%`,
                  backgroundColor: mixHealth > 80 ? "#4ade9b" : mixHealth > 50 ? "#f5a524" : "#ef4444",
                }}
              />
            </div>
          </div>
          <span
            className="text-[18px] font-bold"
            style={{
              color: mixHealth > 80 ? "#4ade9b" : mixHealth > 50 ? "#f5a524" : "#ef4444",
            }}
          >
            {mixHealth}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="button-secondary flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold"
        >
          {analyzing ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Analyzing...
            </>
          ) : (
            <>
              <span>🔍</span> Analyze
            </>
          )}
        </button>
        <button
          onClick={applySmartMix}
          className={`button-primary flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition-all ${
            applied ? "scale-105" : ""
          }`}
        >
          {applied ? "✓ Applied!" : "⚡ AutoMix"}
        </button>
      </div>

      {/* Quick fixes */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Quick fixes</span>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: "balance" as const, label: "Balance levels", emoji: "⚖️" },
            { id: "widen" as const, label: "Widen stereo", emoji: "↔️" },
            { id: "sidechain" as const, label: "Kick→Bass SC", emoji: "🔗" },
            { id: "master" as const, label: "Glue master", emoji: "🎛️" },
          ].map((fix) => (
            <button
              key={fix.id}
              onClick={() => applyQuickFix(fix.id)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[10px] font-semibold text-foreground transition-colors hover:border-accent/30 hover:bg-surface-3"
            >
              <span>{fix.emoji}</span>
              {fix.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis results */}
      {analysis && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Track analysis</span>
          {analysis.map((a) => (
            <div
              key={a.trackIndex}
              className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2 py-1.5"
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    a.category === "low"
                      ? "#ef4444"
                      : a.category === "mid"
                      ? "#f59e0b"
                      : a.category === "high"
                      ? "#22c55e"
                      : "#8b5cf6",
                }}
              />
              <span className="w-16 truncate text-[10px] font-semibold text-foreground">{a.name}</span>
              <span className="text-[9px] uppercase text-muted">{a.category}</span>
              {a.conflicts.length > 0 && (
                <span className="ml-auto rounded bg-red-500/15 px-1 py-0.5 text-[9px] text-red-400">
                  {a.conflicts.length} conflict{a.conflicts.length > 1 ? "s" : ""}
                </span>
              )}
              {a.conflicts.length === 0 && (
                <span className="ml-auto rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] text-emerald-400">
                  Clean
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


