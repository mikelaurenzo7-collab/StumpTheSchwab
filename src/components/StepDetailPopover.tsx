"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEngineStore } from "@/store/engine";
import { generateNoteRange } from "@/lib/sounds";

interface StepDetailPopoverProps {
  trackId: number;
  step: number;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function StepDetailPopover({ trackId, step, anchorRect, onClose }: StepDetailPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const track = useEngineStore((s) => s.tracks[trackId]);
  const setStepVelocity = useEngineStore((s) => s.setStepVelocity);
  const setStepProbability = useEngineStore((s) => s.setStepProbability);
  const setStepNudge = useEngineStore((s) => s.setStepNudge);
  const setStepNote = useEngineStore((s) => s.setStepNote);

  const velocity = track?.steps[step] ?? 0;
  const probability = track?.probabilities[step] ?? 1;
  const nudge = track?.nudge[step] ?? 0;
  const note = track?.notes[step] ?? "";
  const isMelodic = track?.sound.melodic ?? false;
  const noteRange = track?.sound.noteRange;

  const notes = isMelodic && noteRange
    ? generateNoteRange(noteRange[0], noteRange[1])
    : [];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const handleVelocity = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStepVelocity(trackId, step, parseFloat(e.target.value));
    },
    [trackId, step, setStepVelocity]
  );

  const handleProbability = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStepProbability(trackId, step, parseFloat(e.target.value));
    },
    [trackId, step, setStepProbability]
  );

  const handleNudge = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStepNudge(trackId, step, parseFloat(e.target.value));
    },
    [trackId, step, setStepNudge]
  );

  const handleNote = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStepNote(trackId, step, e.target.value);
    },
    [trackId, step, setStepNote]
  );

  if (!track || velocity <= 0) {
    onClose();
    return null;
  }

  const popoverWidth = 220;
  const popoverHeight = isMelodic ? 210 : 170;
  let left = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;
  let top = anchorRect.bottom + 6;

  if (left < 8) left = 8;
  if (left + popoverWidth > window.innerWidth - 8) left = window.innerWidth - 8 - popoverWidth;
  if (top + popoverHeight > window.innerHeight - 8) {
    top = anchorRect.top - popoverHeight - 6;
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface-raised border border-border/70 rounded-xl shadow-2xl p-3 select-none"
      style={{ left, top, width: popoverWidth, animation: "fade-in-up 0.15s ease-out both" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: track.sound.color }} />
        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
          {track.sound.name} · Step {step + 1}
        </span>
        <button
          onClick={onClose}
          className="ml-auto w-4 h-4 flex items-center justify-center text-muted hover:text-foreground text-xs"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[10px] text-muted">Velocity</label>
            <span className="text-[10px] font-mono text-accent">{Math.round(velocity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={velocity}
            onChange={handleVelocity}
            className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
            style={{ accentColor: track.sound.color }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[10px] text-muted">Probability</label>
            <span className="text-[10px] font-mono text-accent">{Math.round(probability * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={probability}
            onChange={handleProbability}
            className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[10px] text-muted">Nudge</label>
            <span className="text-[10px] font-mono text-accent">
              {nudge === 0 ? "0" : nudge > 0 ? `+${Math.round(nudge * 100)}%` : `${Math.round(nudge * 100)}%`}
            </span>
          </div>
          <input
            type="range"
            min={-0.5}
            max={0.5}
            step={0.01}
            value={nudge}
            onChange={handleNudge}
            onDoubleClick={() => setStepNudge(trackId, step, 0)}
            className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[8px] text-muted/50 -mt-0.5">
            <span>early</span>
            <span>late</span>
          </div>
        </div>

        {isMelodic && notes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[10px] text-muted">Note</label>
              <span className="text-[10px] font-mono text-accent">{note || track.sound.note}</span>
            </div>
            <select
              value={note || ""}
              onChange={handleNote}
              className="w-full bg-surface-2 border border-border rounded px-1.5 py-0.5 text-xs text-foreground"
            >
              <option value="">Default ({track.sound.note})</option>
              {notes.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
