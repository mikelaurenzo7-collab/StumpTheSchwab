"use client";

import { useEngineStore } from "@/store/engine";
import { generateNoteRange, isBlackKey } from "@/lib/sounds";
import { memo, useRef, useState } from "react";

// ── Single Note Cell ──────────────────────────────────────────
const NoteCell = memo(function NoteCell({
  active,
  velocity,
  isCurrent,
  color,
  beatStart,
  onMouseDown,
  onMouseEnter,
}: {
  active: boolean;
  velocity: number;
  isCurrent: boolean;
  color: string;
  beatStart: boolean;
  onMouseDown: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onMouseDown(); }}
      onMouseEnter={onMouseEnter}
      className={`
        relative w-7 h-5 transition-all duration-75 border cursor-crosshair select-none
        ${beatStart ? "ml-0.5" : ""}
        ${active ? "border-transparent" : "border-border/20 hover:border-border/40"}
        ${isCurrent && !active ? "bg-accent/10" : ""}
      `}
    >
      {active && (
        <div
          className="absolute inset-0 rounded-[1px] transition-all duration-75"
          style={{
            backgroundColor: color,
            opacity: isCurrent ? 1 : velocity * 0.7 + 0.2,
            boxShadow: isCurrent ? `0 0 10px ${color}88` : `0 0 4px ${color}44`,
          }}
        />
      )}
    </div>
  );
});

// ── Piano Roll Grid ───────────────────────────────────────────
export function PianoRoll() {
  const pianoRollTrack = useEngineStore((s) => s.pianoRollTrack);
  const tracks = useEngineStore((s) => s.tracks);
  const currentStep = useEngineStore((s) => s.currentStep);
  const pianoRollToggleNote = useEngineStore((s) => s.pianoRollToggleNote);
  const setPianoRollTrack = useEngineStore((s) => s.setPianoRollTrack);

  const [isPainting, setIsPainting] = useState(false);
  const paintModeRef = useRef<"add" | "remove">("add");
  const paintNoteRef = useRef<string>("");
  const lastPaintedRef = useRef<string>("");

  if (pianoRollTrack === null) return null;

  const track = tracks[pianoRollTrack];
  if (!track || !track.sound.melodic) return null;

  const [lowNote, highNote] = track.sound.noteRange ?? ["C2", "C4"];
  const noteRange = generateNoteRange(lowNote, highNote);
  // Reverse so high notes are at top
  const notesTopDown = [...noteRange].reverse();

  const handleMouseDown = (step: number, note: string) => {
    const isActive = track.steps[step] > 0 && track.notes[step] === note;
    paintModeRef.current = isActive ? "remove" : "add";
    paintNoteRef.current = note;
    lastPaintedRef.current = `${step}-${note}`;
    setIsPainting(true);
    pianoRollToggleNote(pianoRollTrack, step, note);
  };

  const handleMouseEnter = (step: number, note: string) => {
    if (!isPainting) return;
    const key = `${step}-${note}`;
    if (key === lastPaintedRef.current) return;
    lastPaintedRef.current = key;

    const isActive = track.steps[step] > 0 && track.notes[step] === note;
    if (paintModeRef.current === "add" && !isActive) {
      pianoRollToggleNote(pianoRollTrack, step, note);
    } else if (paintModeRef.current === "remove" && isActive) {
      pianoRollToggleNote(pianoRollTrack, step, note);
    }
  };

  const handleMouseUp = () => {
    setIsPainting(false);
  };

  return (
    <div
      className="border-t border-border bg-surface-deep"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border/60">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: track.sound.color, boxShadow: `0 0 8px ${track.sound.color}66` }}
          />
          <span className="text-sm font-medium text-foreground">
            {track.sound.name} — Piano Roll
          </span>
          <span className="text-xs text-muted">
            Click to place notes. Drag to paint.
          </span>
        </div>
        <button
          onClick={() => setPianoRollTrack(null)}
          className="text-muted hover:text-foreground text-sm px-2 py-0.5 rounded hover:bg-surface-2 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-auto max-h-64 p-2">
        <div className="inline-flex flex-col gap-0">
          {/* Step numbers header */}
          <div className="flex items-center gap-0">
            <div className="w-14 shrink-0" />
            <div className="flex items-center gap-0">
              {track.steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-7 text-center text-[8px] font-mono ${
                    currentStep === i ? "text-accent" : "text-muted/40"
                  } ${i > 0 && i % 4 === 0 ? "ml-0.5" : ""}`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Note rows */}
          {notesTopDown.map((note) => {
            const black = isBlackKey(note);
            const isC = note.startsWith("C") && !note.startsWith("C#");

            return (
              <div key={note} className="flex items-center gap-0">
                {/* Note label */}
                <div
                  className={`w-14 shrink-0 flex items-center justify-end pr-2 h-5 ${
                    black ? "bg-surface-2" : ""
                  } ${isC ? "border-t border-border/30" : ""}`}
                >
                  <span
                    className={`text-[9px] font-mono ${
                      black ? "text-muted/60" : "text-muted"
                    } ${isC ? "font-bold" : ""}`}
                  >
                    {note}
                  </span>
                </div>

                {/* Step cells for this note */}
                <div
                  className={`flex items-center gap-0 ${
                    black ? "bg-surface/50" : "bg-surface-deep/70"
                  } ${isC ? "border-t border-border/20" : ""}`}
                >
                  {track.steps.map((velocity, stepIdx) => {
                    const stepNote = track.notes[stepIdx];
                    const isActiveHere = velocity > 0 && stepNote === note;

                    return (
                      <NoteCell
                        key={stepIdx}
                        active={isActiveHere}
                        velocity={velocity}
                        isCurrent={currentStep === stepIdx}
                        color={track.sound.color}
                        beatStart={stepIdx > 0 && stepIdx % 4 === 0}
                        onMouseDown={() => handleMouseDown(stepIdx, note)}
                        onMouseEnter={() => handleMouseEnter(stepIdx, note)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
