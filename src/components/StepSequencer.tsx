"use client";

import { useEngineStore, nextVelocity } from "@/store/engine";
import { useCallback, memo } from "react";

// ── Velocity labels for tooltip ──────────────────────────────
const velLabel = (v: number) =>
  v >= 1 ? "Full" : v >= 0.75 ? "High" : v >= 0.5 ? "Med" : "Soft";

// ── Single Step Cell ───────────────────────────────────────────
const StepCell = memo(function StepCell({
  velocity,
  isCurrent,
  color,
  onClick,
  onRightClick,
  beatStart,
}: {
  velocity: number;
  isCurrent: boolean;
  color: string;
  onClick: () => void;
  onRightClick: () => void;
  beatStart: boolean;
}) {
  const active = velocity > 0;

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick();
      }}
      title={active ? `${velLabel(velocity)} (${Math.round(velocity * 100)}%) — right-click to adjust` : ""}
      className={`
        relative w-8 h-8 rounded-sm transition-all duration-75 border overflow-hidden
        ${beatStart ? "ml-1" : ""}
        ${
          active
            ? `border-transparent shadow-sm`
            : "border-border/50 bg-surface-2 hover:bg-surface-3"
        }
        ${isCurrent && !active ? "ring-1 ring-accent/50" : ""}
        ${isCurrent && active ? "ring-1 ring-white/60 scale-105" : ""}
      `}
    >
      {active && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-75"
          style={{
            backgroundColor: color,
            height: `${velocity * 100}%`,
            opacity: isCurrent ? 1 : 0.8,
          }}
        />
      )}
    </button>
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
  onCycleVelocity,
  onClearTrack,
}: {
  trackId: number;
  name: string;
  color: string;
  steps: number[];
  currentStep: number;
  onToggleStep: (trackId: number, step: number) => void;
  onCycleVelocity: (trackId: number, step: number) => void;
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
        {steps.map((velocity, stepIdx) => (
          <StepCell
            key={stepIdx}
            velocity={velocity}
            isCurrent={currentStep === stepIdx}
            color={color}
            beatStart={stepIdx > 0 && stepIdx % 4 === 0}
            onClick={() => onToggleStep(trackId, stepIdx)}
            onRightClick={() => onCycleVelocity(trackId, stepIdx)}
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
  const setStepVelocity = useEngineStore((s) => s.setStepVelocity);
  const clearTrack = useEngineStore((s) => s.clearTrack);

  const handleToggle = useCallback(
    (trackId: number, step: number) => toggleStep(trackId, step),
    [toggleStep]
  );

  const handleCycleVelocity = useCallback(
    (trackId: number, step: number) => {
      const track = useEngineStore.getState().tracks[trackId];
      const current = track.steps[step];
      if (current > 0) {
        setStepVelocity(trackId, step, nextVelocity(current));
      } else {
        // If step is off, right-click activates at soft velocity
        setStepVelocity(trackId, step, 0.25);
      }
    },
    [setStepVelocity]
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
            onCycleVelocity={handleCycleVelocity}
            onClearTrack={handleClear}
          />
        ))}
      </div>
    </div>
  );
}
