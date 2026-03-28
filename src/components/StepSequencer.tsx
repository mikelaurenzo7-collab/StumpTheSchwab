"use client";

import { useEngineStore } from "@/store/engine";
import { useCallback, memo } from "react";

// ── Single Step Cell ───────────────────────────────────────────
const StepCell = memo(function StepCell({
  active,
  isCurrent,
  color,
  onClick,
  beatStart,
}: {
  active: boolean;
  isCurrent: boolean;
  color: string;
  onClick: () => void;
  beatStart: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-8 h-8 rounded-sm transition-all duration-75 border
        ${beatStart ? "ml-1" : ""}
        ${
          active
            ? `border-transparent shadow-sm`
            : "border-border/50 bg-surface-2 hover:bg-surface-3"
        }
        ${isCurrent && !active ? "ring-1 ring-accent/50" : ""}
        ${isCurrent && active ? "ring-1 ring-white/60 scale-105" : ""}
      `}
      style={
        active
          ? { backgroundColor: color, opacity: isCurrent ? 1 : 0.75 }
          : undefined
      }
    />
  );
});

// ── Track Row ──────────────────────────────────────────────────
const TrackRow = memo(function TrackRow({
  trackId,
  name,
  color,
  steps,
  currentStep,
  onToggleStep,
  onClearTrack,
}: {
  trackId: number;
  name: string;
  color: string;
  steps: boolean[];
  currentStep: number;
  onToggleStep: (trackId: number, step: number) => void;
  onClearTrack: (trackId: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 group">
      {/* Track label */}
      <div className="w-20 shrink-0 flex items-center gap-1.5 pr-2">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-medium text-muted truncate">{name}</span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-0.5">
        {steps.map((active, stepIdx) => (
          <StepCell
            key={stepIdx}
            active={active}
            isCurrent={currentStep === stepIdx}
            color={color}
            beatStart={stepIdx > 0 && stepIdx % 4 === 0}
            onClick={() => onToggleStep(trackId, stepIdx)}
          />
        ))}
      </div>

      {/* Clear track */}
      <button
        onClick={() => onClearTrack(trackId)}
        className="ml-2 text-xs text-muted/0 group-hover:text-muted hover:text-danger transition-colors"
        title={`Clear ${name}`}
      >
        ✕
      </button>
    </div>
  );
});

// ── Step Sequencer Grid ────────────────────────────────────────
export function StepSequencer() {
  const tracks = useEngineStore((s) => s.tracks);
  const currentStep = useEngineStore((s) => s.currentStep);
  const toggleStep = useEngineStore((s) => s.toggleStep);
  const clearTrack = useEngineStore((s) => s.clearTrack);

  const handleToggle = useCallback(
    (trackId: number, step: number) => toggleStep(trackId, step),
    [toggleStep]
  );

  const handleClear = useCallback(
    (trackId: number) => clearTrack(trackId),
    [clearTrack]
  );

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="inline-flex flex-col gap-1">
        {/* Step numbers */}
        <div className="flex items-center gap-0.5">
          <div className="w-20 shrink-0" />
          <div className="flex items-center gap-0.5">
            {tracks[0]?.steps.map((_, i) => (
              <div
                key={i}
                className={`w-8 text-center text-[10px] font-mono ${
                  currentStep === i ? "text-accent" : "text-muted/50"
                } ${i > 0 && i % 4 === 0 ? "ml-1" : ""}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Track rows */}
        {tracks.map((track) => (
          <TrackRow
            key={track.id}
            trackId={track.id}
            name={track.sound.name}
            color={track.sound.color}
            steps={track.steps}
            currentStep={currentStep}
            onToggleStep={handleToggle}
            onClearTrack={handleClear}
          />
        ))}
      </div>
    </div>
  );
}
