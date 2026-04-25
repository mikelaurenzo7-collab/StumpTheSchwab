"use client";

import { useEngineStore, nextProbability } from "@/store/engine";
import { useCallback, memo, useEffect, useRef, useState } from "react";
import { EuclideanPopover } from "@/components/EuclideanPopover";
import { StepDetailPopover } from "@/components/StepDetailPopover";

// Paint mode lives in a module-level ref-style holder so onMouseEnter on a
// memoized cell can read it without re-render churn. Only one drag is active
// at a time, app-wide.
type PaintMode = "paint" | "erase" | null;
const paintState: { mode: PaintMode } = { mode: null };

const velLabel = (v: number) =>
  v >= 1 ? "Full" : v >= 0.75 ? "High" : v >= 0.5 ? "Med" : "Soft";

const probLabel = (p: number) =>
  p >= 1 ? "100%" : p >= 0.75 ? "75%" : p >= 0.5 ? "50%" : "25%";

// ── Single Step Cell ───────────────────────────────────────────
const StepCell = memo(function StepCell({
  velocity,
  probability,
  nudge,
  isCurrent,
  color,
  onPaint,
  onErase,
  onRightClick,
  onOpenDetail,
  onCtrlClick,
  beatStart,
}: {
  velocity: number;
  probability: number;
  nudge: number;
  isCurrent: boolean;
  color: string;
  onPaint: () => void;
  onErase: () => void;
  onRightClick: (rect: DOMRect) => void;
  onOpenDetail: (rect: DOMRect) => void;
  onCtrlClick: () => void;
  beatStart: boolean;
}) {
  const active = velocity > 0;
  const hasProb = active && probability < 1;
  const hasNudge = active && nudge !== 0;
  let activeStateClass = "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015)),rgba(6,10,16,0.92)] hover:border-accent/35 hover:bg-white/[0.08]";
  if (active) {
    activeStateClass = "border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)),rgba(10,15,23,0.94)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_26px_rgba(0,0,0,0.26)]";
  }

  return (
    <button
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        if (e.detail > 1) {
          paintState.mode = null;
          return;
        }
        if (e.ctrlKey || e.metaKey) {
          onCtrlClick();
          return;
        }
        if (active) {
          paintState.mode = "erase";
          onErase();
        } else {
          paintState.mode = "paint";
          onPaint();
        }
      }}
      onMouseEnter={() => {
        if (paintState.mode === "paint" && !active) {
          onPaint();
        } else if (paintState.mode === "erase" && active) {
          onErase();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onRightClick(rect);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onOpenDetail(rect);
      }}
      title={
        active
          ? `${velLabel(velocity)} (${Math.round(velocity * 100)}%)${hasProb ? ` — ${probLabel(probability)} chance` : ""}${hasNudge ? ` — nudge ${nudge > 0 ? "+" : ""}${Math.round(nudge * 100)}%` : ""} — double-click: shape step`
          : "Click or drag to paint · double-click: shape step"
      }
      className={`
        relative h-10 w-10 rounded-[0.95rem] border overflow-hidden select-none transition-all duration-75
        ${beatStart ? "ml-1" : ""}
        ${activeStateClass}
        ${isCurrent && !active ? "ring-2 ring-accent/70 border-accent/40 bg-accent/10" : ""}
        ${isCurrent && active ? "ring-2 ring-white/70 scale-[1.02]" : ""}
        ${hasProb ? "ring-1 ring-cyan/40" : ""}
      `}
    >
      {active && (
        <div
          className="absolute inset-x-1 bottom-1 rounded-[0.7rem] transition-all duration-75"
          style={{
            background: `linear-gradient(180deg, ${color}, ${color}cc)`,
            height: `${Math.max(velocity * 100, 18)}%`,
            opacity: isCurrent ? 1 : 0.8,
            boxShadow: `0 0 18px ${color}55`,
          }}
        />
      )}
      {active && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/80" />
      )}
      {hasProb && (
        <span
          className="absolute bottom-1 left-1 text-[8px] font-mono leading-none text-white/90 font-bold"
          style={{ textShadow: "0 0 3px rgba(0,0,0,0.8)" }}
        >
          {Math.round(probability * 100)}
        </span>
      )}
      {hasNudge && (
        <span
          className="absolute top-1 right-1 text-[8px] font-mono leading-none text-yellow-300 font-bold"
          style={{ textShadow: "0 0 3px rgba(0,0,0,0.8)" }}
        >
          {nudge > 0 ? ">" : "<"}
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
  nudgeArr,
  melodic,
  pianoRollOpen,
  currentStep,
  canPaste,
  euclideanOpen,
  onPaintStep,
  onEraseStep,
  onRightClickStep,
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
  nudgeArr: number[];
  melodic: boolean;
  pianoRollOpen: boolean;
  currentStep: number;
  canPaste: boolean;
  euclideanOpen: boolean;
  onPaintStep: (trackId: number, step: number) => void;
  onEraseStep: (trackId: number, step: number) => void;
  onRightClickStep: (trackId: number, step: number, rect: DOMRect) => void;
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
    <div className="relative min-w-max rounded-[1.45rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015)),rgba(8,12,18,0.62)] p-2.5 shadow-[0_14px_32px_rgba(0,0,0,0.18)]">
      {/* Track label */}
      <div
        className={`sticky left-0 z-20 flex w-40 shrink-0 items-center gap-2 rounded-[1rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)),rgba(11,16,24,0.92)] px-3 py-2 pr-2 backdrop-blur-md ${
          melodic ? "cursor-pointer hover:opacity-80" : ""
        }`}
        onClick={() => melodic && onTogglePianoRoll(trackId)}
        title={melodic ? `${pianoRollOpen ? "Close" : "Open"} piano roll` : ""}
      >
        {/* Track color rail anchors the row and separates instruments at scan speed. */}
        <div
          className={`h-10 w-2 shrink-0 rounded-full ${
             pianoRollOpen ? "ring-2 ring-accent ring-offset-1 ring-offset-background" : ""
           }`}
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0">
          <span className={`block truncate text-sm font-black tracking-[-0.02em] ${pianoRollOpen ? "text-accent" : "text-foreground"}`}>
            {name}
            {melodic && <span className="ml-1 text-[10px] opacity-60">♪</span>}
          </span>
          <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted/80">
            {melodic ? "Piano lane" : "Rhythm lane"}
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="mx-3 flex items-center gap-0.5">
        {steps.map((velocity, stepIdx) => (
          <StepCell
            key={stepIdx}
            velocity={velocity}
            probability={probabilities[stepIdx] ?? 1.0}
            nudge={nudgeArr[stepIdx] ?? 0}
            isCurrent={currentStep === stepIdx}
            color={color}
            beatStart={stepIdx > 0 && stepIdx % 4 === 0}
            onPaint={() => onPaintStep(trackId, stepIdx)}
            onErase={() => onEraseStep(trackId, stepIdx)}
            onRightClick={(rect: DOMRect) => onRightClickStep(trackId, stepIdx, rect)}
            onOpenDetail={(rect: DOMRect) => onRightClickStep(trackId, stepIdx, rect)}
            onCtrlClick={() => onCtrlClick(trackId, stepIdx)}
          />
        ))}
      </div>

      {/* Core groove actions stay visible so editing is discoverable without hover. */}
      <div
        className="sticky right-0 z-20 ml-2 flex items-center gap-1 rounded-[1rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)),rgba(11,16,24,0.92)] px-2 py-1.5 backdrop-blur-md"
      >
        <button
          onClick={() => onCopyTrack(trackId)}
          className="button-secondary h-7 rounded-full px-2 text-[9px] font-bold"
          title={`Copy ${name} pattern`}
        >
          Copy
        </button>
        <button
          onClick={() => onPasteTrack(trackId)}
          disabled={!canPaste}
          className="button-secondary h-7 rounded-full px-2 text-[9px] font-bold hover:bg-accent-dim/30 hover:text-accent disabled:hover:text-muted"
          title={canPaste ? `Paste into ${name}` : "Copy a track first"}
        >
          Paste
        </button>
        <button
          onClick={() => onHumanizeTrack(trackId)}
          className="button-secondary h-7 rounded-full px-2 text-[9px] font-bold hover:bg-accent-dim/30 hover:text-accent"
          title={`Humanize ${name} — slight velocity randomization`}
        >
          Feel
        </button>
        <button
          onClick={() => onOpenEuclidean(trackId)}
          className={`h-7 rounded-full px-2 text-[9px] font-bold transition-colors ${
            euclideanOpen
              ? "bg-accent text-white"
              : "button-secondary hover:bg-accent-dim/30 hover:text-accent"
           }`}
          title={`Euclidean fill for ${name}`}
        >
          Fill
        </button>
        <button
          onClick={() => onClearTrack(trackId)}
          className="button-secondary h-7 rounded-full px-2 text-[9px] font-bold hover:bg-danger/20 hover:text-danger"
          title={`Clear ${name}`}
        >
          Clear
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
  const setStepProbability = useEngineStore((s) => s.setStepProbability);
  const dragSeenRef = useRef<Set<string>>(new Set());

  // Clear paint mode whenever the mouse is released anywhere on the page.
  useEffect(() => {
    const end = () => {
      paintState.mode = null;
      dragSeenRef.current.clear();
    };
    window.addEventListener("mouseup", end);
    window.addEventListener("mouseleave", end);
    return () => {
      window.removeEventListener("mouseup", end);
      window.removeEventListener("mouseleave", end);
    };
  }, []);
  const clearTrack = useEngineStore((s) => s.clearTrack);
  const pianoRollTrack = useEngineStore((s) => s.pianoRollTrack);
  const setPianoRollTrack = useEngineStore((s) => s.setPianoRollTrack);
  const copyTrackSteps = useEngineStore((s) => s.copyTrackSteps);
  const pasteTrackSteps = useEngineStore((s) => s.pasteTrackSteps);
  const humanize = useEngineStore((s) => s.humanize);
  const canPaste = useEngineStore((s) => s.trackClipboard !== null);

  const [euclideanTrack, setEuclideanTrack] = useState<number | null>(null);
  const [detailStep, setDetailStep] = useState<{
    trackId: number;
    step: number;
    rect: DOMRect;
  } | null>(null);
  const totalSteps = tracks[0]?.steps.length ?? 0;
  const activeTrackCount = tracks.reduce(
    (count, track) => count + (track.steps.some((step) => step > 0) ? 1 : 0),
    0
  );

  const handlePaintStep = useCallback(
    (trackId: number, step: number) => {
      const key = `${trackId}:${step}`;
      if (dragSeenRef.current.has(key)) return;
      dragSeenRef.current.add(key);
      const t = useEngineStore.getState().tracks[trackId];
      if (!t || t.steps[step] > 0) return;
      toggleStep(trackId, step);
    },
    [toggleStep]
  );

  const handleEraseStep = useCallback(
    (trackId: number, step: number) => {
      const key = `${trackId}:${step}`;
      if (dragSeenRef.current.has(key)) return;
      dragSeenRef.current.add(key);
      const t = useEngineStore.getState().tracks[trackId];
      if (!t || t.steps[step] === 0) return;
      toggleStep(trackId, step);
    },
    [toggleStep]
  );

  const handleRightClickStep = useCallback(
    (trackId: number, step: number, rect: DOMRect) => {
      const track = useEngineStore.getState().tracks[trackId];
      if (track.steps[step] <= 0) {
        toggleStep(trackId, step);
      }
      setDetailStep({ trackId, step, rect });
    },
    [toggleStep]
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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {detailStep && (
        <StepDetailPopover
          trackId={detailStep.trackId}
          step={detailStep.step}
          anchorRect={detailStep.rect}
          onClose={() => setDetailStep(null)}
        />
      )}
      <div className="border-b border-white/[0.06] px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-accent-hover">
            Compose
          </p>
          <h2 className="text-2xl font-black tracking-[-0.04em] text-white">
            Step canvas
          </h2>
            <p className="mt-1 text-sm text-foreground/70">
              Clear lanes, anchored controls, and a stickier ruler so the groove stays readable while you work.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            <span className="pill-badge rounded-full px-3 py-1.5">{tracks.length} lanes</span>
            <span className="pill-badge rounded-full px-3 py-1.5">{totalSteps} steps</span>
            <span className="pill-badge rounded-full px-3 py-1.5">{activeTrackCount} active</span>
            <span className="pill-badge rounded-full px-3 py-1.5">Playhead {currentStep + 1}</span>
          </div>
        </div>
      </div>

      <section aria-label="Sequencer workflow tips" className="border-b border-white/[0.05] px-4 py-3">
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/72">
          <span className="pill-badge rounded-full px-3 py-1.5">Drag to paint</span>
          <span className="pill-badge rounded-full px-3 py-1.5">Double-click to shape</span>
          <span className="pill-badge rounded-full px-3 py-1.5">Ctrl-click for chance</span>
          <span className="pill-badge rounded-full px-3 py-1.5">Fill lanes with Euclid</span>
        </div>
      </section>

      <div className="min-h-0 flex-1 px-4 pb-4 pt-3">
        <div className="h-full overflow-auto rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015)),rgba(6,10,16,0.7)]">
          <div className="min-w-max p-3">
            <div className="sticky top-0 z-30 mb-3 rounded-[1.1rem] border border-white/[0.08] bg-[rgba(8,13,20,0.9)] px-3 py-2 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <div className="w-40 shrink-0 text-[10px] font-black uppercase tracking-[0.22em] text-muted/90">
                  Track / controls
                </div>
                <div className="flex items-center gap-0.5">
                  {tracks[0]?.steps.map((_, i) => (
                    <div
                      key={i}
                      className={`w-10 text-center text-[10px] font-mono ${
                        currentStep === i ? "font-black text-accent" : "text-muted/60"
                      } ${i > 0 && i % 4 === 0 ? "ml-1" : ""}`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                <div className="ml-3 text-[10px] font-black uppercase tracking-[0.22em] text-muted/90">
                  Edit tools
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pb-1">
              {tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  trackId={track.id}
                  name={track.sound.name}
                  color={track.sound.color}
                  steps={track.steps}
                  probabilities={track.probabilities}
                  nudgeArr={track.nudge}
                  melodic={track.sound.melodic}
                  pianoRollOpen={pianoRollTrack === track.id}
                  currentStep={currentStep}
                  canPaste={canPaste}
                  euclideanOpen={euclideanTrack === track.id}
                  onPaintStep={handlePaintStep}
                  onEraseStep={handleEraseStep}
                  onRightClickStep={handleRightClickStep}
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
        </div>
      </div>
    </div>
  );
}
