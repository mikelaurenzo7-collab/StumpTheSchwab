"use client";

import { useEngineStore } from "@/store/engine";
import { generateNoteRange, isBlackKey } from "@/lib/sounds";
import {
  isNoteInScale,
  buildChord,
  ALL_NOTES,
  SCALE_TYPES,
  CHORD_TYPES,
  type NoteName,
  type ScaleType,
  type ChordType,
} from "@/lib/musicTheory";
import { memo, useRef, useState } from "react";

// ── Single Note Cell ──────────────────────────────────────────
const NoteCell = memo(function NoteCell({
  active,
  velocity,
  isCurrent,
  color,
  beatStart,
  inScale,
  scaleLock,
  onMouseDown,
  onMouseEnter,
}: {
  active: boolean;
  velocity: number;
  isCurrent: boolean;
  color: string;
  beatStart: boolean;
  inScale: boolean;
  scaleLock: boolean;
  onMouseDown: () => void;
  onMouseEnter: () => void;
}) {
  const dimmed = scaleLock && !inScale;
  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onMouseDown(); }}
      onMouseEnter={onMouseEnter}
      className={`
        relative w-7 h-5 transition-all duration-75 border select-none
        ${dimmed ? "cursor-not-allowed" : "cursor-crosshair"}
        ${beatStart ? "ml-0.5" : ""}
        ${active ? "border-transparent" : dimmed ? "border-border/10 hover:border-border/15" : "border-border/20 hover:border-border/40"}
        ${isCurrent && !active ? (inScale ? "bg-accent/10" : "bg-accent/5") : ""}
        ${dimmed && !active ? "opacity-25" : ""}
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

// ── Key Label (left side of row) ──────────────────────────────
function NoteLabel({ note, inScale, scaleLock }: { note: string; inScale: boolean; scaleLock: boolean }) {
  const black = isBlackKey(note);
  const isC = note.startsWith("C") && !note.startsWith("C#");
  const dimmed = scaleLock && !inScale;

  return (
    <div
      className={`w-14 shrink-0 flex items-center justify-end pr-2 h-5 ${
        black ? "bg-surface" : ""
      } ${isC ? "border-t border-border/30" : ""}`}
    >
      <span
        className={`text-[9px] font-mono ${
          dimmed ? "text-muted/25" : inScale ? (black ? "text-muted/80" : "text-foreground/90") : (black ? "text-muted/60" : "text-muted")
        } ${isC ? "font-bold" : ""}`}
      >
        {note}
      </span>
      {inScale && scaleLock && (
        <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-accent/50" />
      )}
    </div>
  );
}

// ── Piano Roll Grid ───────────────────────────────────────────
export function PianoRoll() {
  const pianoRollTrack = useEngineStore((s) => s.pianoRollTrack);
  const tracks = useEngineStore((s) => s.tracks);
  const currentStep = useEngineStore((s) => s.currentStep);
  const pianoRollToggleNote = useEngineStore((s) => s.pianoRollToggleNote);
  const setPianoRollTrack = useEngineStore((s) => s.setPianoRollTrack);
  const globalKey = useEngineStore((s) => s.globalKey);
  const globalScale = useEngineStore((s) => s.globalScale);
  const scaleLock = useEngineStore((s) => s.scaleLock);
  const chordMode = useEngineStore((s) => s.chordMode);
  const setGlobalKey = useEngineStore((s) => s.setGlobalKey);
  const setGlobalScale = useEngineStore((s) => s.setGlobalScale);
  const setScaleLock = useEngineStore((s) => s.setScaleLock);
  const setChordMode = useEngineStore((s) => s.setChordMode);
  const snapAllToScale = useEngineStore((s) => s.snapAllToScale);

  const [isPainting, setIsPainting] = useState(false);
  const paintModeRef = useRef<"add" | "remove">("add");
  const paintNoteRef = useRef<string>("");
  const lastPaintedRef = useRef<string>("");

  if (pianoRollTrack === null) return null;

  const track = tracks[pianoRollTrack];
  if (!track || !track.sound.melodic) return null;

  const [lowNote, highNote] = track.sound.noteRange ?? ["C2", "C4"];
  const noteRange = generateNoteRange(lowNote, highNote);
  const notesTopDown = [...noteRange].reverse();

  const handleMouseDown = (step: number, note: string) => {
    if (scaleLock && !isNoteInScale(note, globalKey, globalScale)) return;

    if (chordMode) {
      const chordNotes = buildChord(note, chordMode, globalKey, globalScale, noteRange);
      const stepNotes = track.notes[step] ? track.notes[step].split(",") : [];
      const allActive = chordNotes.every((n) => track.steps[step] > 0 && stepNotes.includes(n));
      paintModeRef.current = allActive ? "remove" : "add";
      for (const cn of chordNotes) {
        const noteActive = track.steps[step] > 0 && stepNotes.includes(cn);
        if (paintModeRef.current === "add" && !noteActive) {
          pianoRollToggleNote(pianoRollTrack, step, cn);
        } else if (paintModeRef.current === "remove" && noteActive) {
          pianoRollToggleNote(pianoRollTrack, step, cn);
        }
      }
      paintNoteRef.current = note;
      lastPaintedRef.current = `${step}-${note}`;
      setIsPainting(true);
      return;
    }

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
    if (scaleLock && !isNoteInScale(note, globalKey, globalScale)) return;
    const key = `${step}-${note}`;
    if (key === lastPaintedRef.current) return;
    lastPaintedRef.current = key;

    if (chordMode) {
      const chordNotes = buildChord(note, chordMode, globalKey, globalScale, noteRange);
      const stepNotes = track.notes[step] ? track.notes[step].split(",") : [];
      for (const cn of chordNotes) {
        const noteActive = track.steps[step] > 0 && stepNotes.includes(cn);
        if (paintModeRef.current === "add" && !noteActive) {
          pianoRollToggleNote(pianoRollTrack, step, cn);
        } else if (paintModeRef.current === "remove" && noteActive) {
          pianoRollToggleNote(pianoRollTrack, step, cn);
        }
      }
      return;
    }

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
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]"
            style={{ backgroundColor: track.sound.color }}
          />
          <span className="text-sm font-medium text-foreground">
            {track.sound.name} — Piano Roll
          </span>
        </div>

        {/* Key / Scale / Chord controls */}
        <div className="flex items-center gap-1.5">
          <select
            value={globalKey}
            onChange={(e) => setGlobalKey(e.target.value as NoteName)}
            className="h-6 rounded border border-border bg-surface px-1.5 text-[10px] font-mono text-foreground"
          >
            {ALL_NOTES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <select
            value={globalScale}
            onChange={(e) => setGlobalScale(e.target.value as ScaleType)}
            className="h-6 rounded border border-border bg-surface px-1.5 text-[10px] font-mono text-foreground"
          >
            {SCALE_TYPES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <button
            onClick={() => setScaleLock(!scaleLock)}
            className={`h-6 rounded border px-2 text-[10px] font-bold transition-colors ${
              scaleLock
                ? "border-accent bg-accent/20 text-accent"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
            title="Scale Lock — constrain input to scale notes only"
          >
            LOCK
          </button>

          <div className="mx-1 h-4 w-px bg-border" />

          <select
            value={chordMode ?? "off"}
            onChange={(e) => setChordMode(e.target.value === "off" ? null : e.target.value as ChordType)}
            className={`h-6 rounded border px-1.5 text-[10px] font-mono ${
              chordMode
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-border bg-surface text-foreground"
            }`}
          >
            <option value="off">Single</option>
            {CHORD_TYPES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <button
            onClick={snapAllToScale}
            className="h-6 rounded border border-border bg-surface px-2 text-[10px] text-muted transition-colors hover:border-accent hover:text-accent"
            title="Snap all melodic notes to the current scale"
          >
            Snap
          </button>

          <div className="mx-1 h-4 w-px bg-border" />

          <button
            onClick={() => setPianoRollTrack(null)}
            className="button-secondary rounded-xl px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>
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
            const inScale = isNoteInScale(note, globalKey, globalScale);

            return (
              <div key={note} className="flex items-center gap-0">
                <NoteLabel note={note} inScale={inScale} scaleLock={scaleLock} />

                {/* Step cells for this note */}
                <div
                  className={`flex items-center gap-0 ${
                    black ? "bg-surface/50" : "bg-background"
                  } ${isC ? "border-t border-border/20" : ""} ${
                    inScale && scaleLock ? "bg-accent/[0.03]" : ""
                  }`}
                >
                  {track.steps.map((velocity, stepIdx) => {
                    const stepNote = track.notes[stepIdx];
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
                        inScale={inScale}
                        scaleLock={scaleLock}
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
