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
    const stepNotes = track.notes[step] ? track.notes[step].split(",") : [];
    const isActive = track.steps[step] > 0 && stepNotes.includes(note);
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

    const stepNotes = track.notes[step] ? track.notes[step].split(",") : [];
    const isActive = track.steps[step] > 0 && stepNotes.includes(note);
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
      className="border-t border-border bg-surface-2"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]"
            style={{ backgroundColor: track.sound.color }}
          />
          <span className="text-sm font-medium text-foreground">
            {track.sound.name} — Piano Roll
          </span>
          <span className="pill-badge rounded-full px-2 py-1 text-[10px] font-semibold">
            Click to place notes. Drag to paint.
          </span>
        </div>
        <button
          onClick={() => setPianoRollTrack(null)}
          className="button-secondary rounded-xl px-3 py-1 text-sm"
        >
          Close
        </button>
      </div>

      {/* Grid */}
      <div className="max-h-72 overflow-auto px-4 pb-4 pt-3">
        <div className="inline-flex flex-col gap-0 rounded-lg border border-border bg-surface-2 p-3">
          {/* Step numbers header */}
          <div className="sticky top-0 z-10 mb-2 flex items-center gap-0 rounded-[0.9rem] bg-surface-2 py-1 backdrop-blur-sm">
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
                    black ? "bg-surface" : ""
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
                    black ? "bg-surface/50" : "bg-background"
                  } ${isC ? "border-t border-border/20" : ""}`}
                >
                  {track.steps.map((velocity, stepIdx) => {
                    const stepNote = track.notes[stepIdx];
                    // Polyphonic chord support: check if this note is included in a comma-separated list
                    const stepNotes = stepNote ? stepNote.split(",") : [];
                    const isActiveHere = velocity > 0 && stepNotes.includes(note);

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
