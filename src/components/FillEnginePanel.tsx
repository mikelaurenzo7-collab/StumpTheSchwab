"use client";

import { useState, useCallback, useMemo } from "react";
import { useEngineStore } from "@/store/engine";
import {
  generateFill,
  suggestFills,
  type FillType,
  type FillResult,
} from "@/lib/fillEngine";
import { DEFAULT_KIT } from "@/lib/sounds";

const FILL_TYPES: Array<{ type: FillType; label: string; emoji: string; desc: string }> = [
  { type: "fill", label: "Fill", emoji: "🥁", desc: "Add energy in the last bar" },
  { type: "break", label: "Break", emoji: "🛑", desc: "Strip back for contrast" },
  { type: "build", label: "Build", emoji: "📈", desc: "Crescendo toward a peak" },
  { type: "drop", label: "Drop", emoji: "💥", desc: "Impact hit with silence" },
  { type: "switch-up", label: "Switch", emoji: "🔀", desc: "Rhythmic variation" },
  { type: "ghost-notes", label: "Ghosts", emoji: "👻", desc: "Subtle between-hits" },
];

export function FillEnginePanel() {
  const tracks = useEngineStore((s) => s.tracks);
  const totalSteps = useEngineStore((s) => s.totalSteps);
  const setStepVelocity = useEngineStore((s) => s.setStepVelocity);
  const setStepProbability = useEngineStore((s) => s.setStepProbability);
  const setStepNudge = useEngineStore((s) => s.setStepNudge);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [intensity, setIntensity] = useState(0.6);
  const [lastResult, setLastResult] = useState<FillResult | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const track = tracks[selectedTrack];
  const trackName = track?.customSampleName || DEFAULT_KIT[selectedTrack]?.name || `Track ${selectedTrack + 1}`;

  const suggestions = useMemo(
    () => suggestFills(tracks.map((t) => ({ steps: t.steps, name: t.customSampleName || DEFAULT_KIT[t.id]?.name || "" }))),
    [tracks]
  );

  const trackSuggestion = suggestions.find((s) => s.trackIndex === selectedTrack);

  const applyFill = useCallback(
    (type: FillType) => {
      if (!track) return;
      const result = generateFill(
        track.steps,
        track.notes,
        trackName,
        totalSteps,
        { type, intensity }
      );
      setLastResult(result);

      if (previewMode) {
        // Preview: only show, don't apply
        return;
      }

      // Apply to the track
      for (let i = 0; i < totalSteps; i++) {
        if (result.steps[i] !== track.steps[i]) {
          setStepVelocity(selectedTrack, i, result.steps[i]);
        }
        if (result.probabilities[i] !== track.probabilities[i]) {
          setStepProbability(selectedTrack, i, result.probabilities[i]);
        }
        if (result.nudge[i] !== track.nudge[i]) {
          setStepNudge(selectedTrack, i, result.nudge[i]);
        }
      }
    },
    [track, trackName, totalSteps, intensity, previewMode, selectedTrack, setStepVelocity, setStepProbability, setStepNudge]
  );



  if (!track) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Track selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Target</span>
        <select
          value={selectedTrack}
          onChange={(e) => setSelectedTrack(Number(e.target.value))}
          className="control-input flex-1 rounded-md px-2 py-1 text-[12px]"
        >
          {tracks.map((t, i) => (
            <option key={i} value={i}>
              {t.customSampleName || DEFAULT_KIT[i]?.name || `Track ${i + 1}`}
            </option>
          ))}
        </select>
      </div>

      {/* Smart suggestion */}
      {trackSuggestion && (
        <button
          onClick={() => applyFill(trackSuggestion.suggestedType)}
          className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-left transition-colors hover:bg-accent/20"
        >
          <span className="text-[16px]">
            {FILL_TYPES.find((f) => f.type === trackSuggestion.suggestedType)?.emoji}
          </span>
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-accent">
              Smart suggestion: {FILL_TYPES.find((f) => f.type === trackSuggestion.suggestedType)?.label}
            </div>
            <div className="text-[10px] text-soft">{trackSuggestion.reason}</div>
          </div>
        </button>
      )}

      {/* Intensity slider */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Intensity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={intensity * 100}
          onChange={(e) => setIntensity(Number(e.target.value) / 100)}
          className="flex-1 accent-accent"
        />
        <span className="w-8 text-right text-[11px] font-mono text-foreground">{Math.round(intensity * 100)}%</span>
      </div>

      {/* Fill type grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {FILL_TYPES.map(({ type, label, emoji, desc }) => (
          <button
            key={type}
            onClick={() => applyFill(type)}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-2.5 transition-colors hover:border-accent/40 hover:bg-surface-3"
            title={desc}
          >
            <span className="text-[18px]">{emoji}</span>
            <span className="text-[10px] font-semibold text-foreground">{label}</span>
          </button>
        ))}
      </div>

      {/* Preview toggle */}
      <label className="flex items-center gap-2 text-[11px] text-soft">
        <input
          type="checkbox"
          checked={previewMode}
          onChange={(e) => setPreviewMode(e.target.checked)}
          className="accent-accent"
        />
        Preview mode (don&rsquo;t apply yet)
      </label>

      {/* Last result */}
      {lastResult && (
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Last applied</div>
          <div className="mt-1 text-[12px] text-foreground">
            {FILL_TYPES.find((f) => f.type === lastResult.type)?.emoji}{" "}
            {lastResult.description}
          </div>
          <div className="mt-1 flex gap-1">
            {lastResult.steps.map((v, i) => (
              <div
                key={i}
                className="h-4 w-1 rounded-sm"
                style={{
                  backgroundColor: v > 0 ? `rgba(139, 92, 246, ${v})` : "transparent",
                  border: v > 0 ? "none" : "1px solid rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
