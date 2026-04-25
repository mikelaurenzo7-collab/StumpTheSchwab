"use client";

import { useEngineStore, nextVelocity, nextProbability } from "@/store/engine";
import { useCallback, memo, useState } from "react";
import { EuclideanPopover } from "@/components/EuclideanPopover";

const velLabel = (v: number) =>
  v >= 1 ? "Full" : v >= 0.75 ? "High" : v >= 0.5 ? "Med" : "Soft";

const probLabel = (p: number) =>
  p >= 1 ? "100%" : p >= 0.75 ? "75%" : p >= 0.5 ? "50%" : "25%";

// ── Single Step Cell ───────────────────────────────────────────
const StepCell = memo(function StepCell({
  velocity,
  probability,
  isCurrent,
  color,
  onClick,
  onRightClick,
  onCtrlClick,
  beatStart,
}: {
  velocity: number;
  probability: number;
  isCurrent: boolean;
  color: string;
  onClick: () => void;
  onRightClick: () => void;
  onCtrlClick: () => void;
  beatStart: boolean;
}) {
  const active = velocity > 0;
  const hasProb = active && probability < 1;

  return (
    <button
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          onCtrlClick();
        } else {
          onClick();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick();
      }}
      title={
        active
          ? `${velLabel(velocity)} (${Math.round(velocity * 100)}%)${hasProb ? ` — ${probLabel(probability)} chance` : ""} — right-click: velocity, ctrl-click: probability`
          : "ctrl-click: add with probability"
      }
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
        ${hasProb ? "ring-1 ring-white/20" : ""}
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
      {hasProb && (
        <span
          className="absolute bottom-0 left-0.5 text-[7px] font-mono leading-none text-white/80 font-bold"
          style={{ textShadow: "0 0 3px rgba(0,0,0,0.8)" }}
        >
          {Math.round(probability * 100)}
        </span>
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
  probabilities,
  melodic,
  pianoRollOpen,
  currentStep,
  canPaste,
  euclideanOpen,
  onToggleStep,
  onCycleVelocity,
  onCtrlClick,
  onClearTrack,
  onTogglePianoRoll,
  onCopyTrack,
  onPasteTrack,
  onHumanizeTrack,
  onOpenEuclidean,
  onCloseEuclidean,
}: {
  trackId: number;
  name: string;
  color: string;
  steps: number[];
  probabilities: number[];
  melodic: boolean;
  pianoRollOpen: boolean;
  currentStep: number;
  canPaste: boolean;
  euclideanOpen: boolean;
  onToggleStep: (trackId: number, step: number) => void;
  onCycleVelocity: (trackId: number, step: number) => void;
  onCtrlClick: (trackId: number, step: number) => void;
  onClearTrack: (trackId: number) => void;
  onTogglePianoRoll: (trackId: number) => void;
  onCopyTrack: (trackId: number) => void;
  onPasteTrack: (trackId: number) => void;
  onHumanizeTrack: (trackId: number) => void;
  onOpenEuclidean: (trackId: number) => void;
  onCloseEuclidean: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 group relative">
      {/* Track label */}
      <div
        className={`w-20 shrink-0 flex items-center gap-1.5 pr-2 ${
          melodic ? "cursor-pointer hover:opacity-80" : ""
        }`}
        onClick={() => melodic && onTogglePianoRoll(trackId)}
        title={melodic ? `${pianoRollOpen ? "Close" : "Open"} piano roll` : ""}
      >
        <div
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            pianoRollOpen ? "ring-2 ring-accent ring-offset-1 ring-offset-background" : ""
          }`}
          style={{ backgroundColor: color }}
        />
        <span className={`text-xs font-medium truncate ${pianoRollOpen ? "text-accent" : "text-muted"}`}>
          {name}
          {melodic && <span className="text-[8px] ml-0.5 opacity-50">♪</span>}
        </span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-0.5">
        {steps.map((velocity, stepIdx) => (
          <StepCell
            key={stepIdx}
            velocity={velocity}
            probability={probabilities[stepIdx] ?? 1.0}
            isCurrent={currentStep === stepIdx}
            color={color}
            beatStart={stepIdx > 0 && stepIdx % 4 === 0}
            onClick={() => onToggleStep(trackId, stepIdx)}
            onRightClick={() => onCycleVelocity(trackId, stepIdx)}
            onCtrlClick={() => onCtrlClick(trackId, stepIdx)}
          />
        ))}
      </div>

      {/* Track actions — visible on hover (and while popover is open) */}
      <div
        className={`ml-2 flex items-center gap-0.5 transition-opacity relative ${
          euclideanOpen
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <button
          onClick={() => onCopyTrack(trackId)}
          className="w-5 h-5 rounded text-[9px] font-bold bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground transition-colors"
          title={`Copy ${name} pattern`}
        >
          C
        </button>
        <button
          onClick={() => onPasteTrack(trackId)}
          disabled={!canPaste}
          className="w-5 h-5 rounded text-[9px] font-bold bg-surface-2 text-muted hover:bg-accent-dim/30 hover:text-accent disabled:opacity-25 disabled:hover:bg-surface-2 disabled:hover:text-muted transition-colors"
          title={canPaste ? `Paste into ${name}` : "Copy a track first"}
        >
          P
        </button>
        <button
          onClick={() => onHumanizeTrack(trackId)}
          className="w-5 h-5 rounded text-[9px] font-bold bg-surface-2 text-muted hover:bg-accent-dim/30 hover:text-accent transition-colors"
          title={`Humanize ${name} — slight velocity randomization`}
        >
          ~
        </button>
        <button
          onClick={() => onOpenEuclidean(trackId)}
          className={`w-5 h-5 rounded text-[9px] font-bold transition-colors ${
            euclideanOpen
              ? "bg-accent text-white"
              : "bg-surface-2 text-muted hover:bg-accent-dim/30 hover:text-accent"
          }`}
          title={`Euclidean fill for ${name}`}
        >
          E
        </button>
        <button
          onClick={() => onClearTrack(trackId)}
          className="w-5 h-5 rounded text-[9px] font-bold bg-surface-2 text-muted hover:bg-danger/20 hover:text-danger transition-colors"
          title={`Clear ${name}`}
        >
          ✕
        </button>

        {euclideanOpen && (
          <EuclideanPopover
            trackId={trackId}
            trackName={name}
            trackColor={color}
            onClose={onCloseEuclidean}
          />
        )}
      </div>
    </div>
  );
});

// ── Step Sequencer Grid ────────────────────────────────────────
export function StepSequencer() {
  const tracks = useEngineStore((s) => s.tracks);
  const currentStep = useEngineStore((s) => s.currentStep);
  const toggleStep = useEngineStore((s) => s.toggleStep);
  const setStepVelocity = useEngineStore((s) => s.setStepVelocity);
  const setStepProbability = useEngineStore((s) => s.setStepProbability);
  const clearTrack = useEngineStore((s) => s.clearTrack);
  const pianoRollTrack = useEngineStore((s) => s.pianoRollTrack);
  const setPianoRollTrack = useEngineStore((s) => s.setPianoRollTrack);
  const copyTrackSteps = useEngineStore((s) => s.copyTrackSteps);
  const pasteTrackSteps = useEngineStore((s) => s.pasteTrackSteps);
  const humanize = useEngineStore((s) => s.humanize);
  const canPaste = useEngineStore((s) => s.trackClipboard !== null);

  const [euclideanTrack, setEuclideanTrack] = useState<number | null>(null);

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
        setStepVelocity(trackId, step, 0.25);
      }
    },
    [setStepVelocity]
  );

  const handleCtrlClick = useCallback(
    (trackId: number, step: number) => {
      const track = useEngineStore.getState().tracks[trackId];
      if (track.steps[step] > 0) {
        setStepProbability(trackId, step, nextProbability(track.probabilities[step]));
      } else {
        toggleStep(trackId, step);
      }
    },
    [toggleStep, setStepProbability]
  );

  const handleClear = useCallback(
    (trackId: number) => clearTrack(trackId),
    [clearTrack]
  );

  const handleTogglePianoRoll = useCallback(
    (trackId: number) => {
      setPianoRollTrack(pianoRollTrack === trackId ? null : trackId);
    },
    [pianoRollTrack, setPianoRollTrack]
  );

  const handleCopyTrack = useCallback(
    (trackId: number) => copyTrackSteps(trackId),
    [copyTrackSteps]
  );

  const handlePasteTrack = useCallback(
    (trackId: number) => pasteTrackSteps(trackId),
    [pasteTrackSteps]
  );

  const handleHumanizeTrack = useCallback(
    (trackId: number) => humanize(trackId, 0.15),
    [humanize]
  );

  const handleOpenEuclidean = useCallback(
    (trackId: number) => setEuclideanTrack(trackId),
    []
  );

  const handleCloseEuclidean = useCallback(() => setEuclideanTrack(null), []);

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
            probabilities={track.probabilities}
            melodic={track.sound.melodic}
            pianoRollOpen={pianoRollTrack === track.id}
            currentStep={currentStep}
            canPaste={canPaste}
            euclideanOpen={euclideanTrack === track.id}
            onToggleStep={handleToggle}
            onCycleVelocity={handleCycleVelocity}
            onCtrlClick={handleCtrlClick}
            onClearTrack={handleClear}
            onTogglePianoRoll={handleTogglePianoRoll}
            onCopyTrack={handleCopyTrack}
            onPasteTrack={handlePasteTrack}
            onHumanizeTrack={handleHumanizeTrack}
            onOpenEuclidean={handleOpenEuclidean}
            onCloseEuclidean={handleCloseEuclidean}
          />
        ))}
      </div>
    </div>
  );
}
