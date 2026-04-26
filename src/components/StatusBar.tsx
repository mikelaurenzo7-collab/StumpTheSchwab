"use client";

import { useEffect, useRef, useState } from "react";
import { useEngineStore, MAX_PATTERNS } from "@/store/engine";
import { useUiStore } from "@/store/ui";
import * as Tone from "tone";
import type { MidiStatus } from "@/lib/useMidi";

interface StatusBarProps {
  getMasterMeter: () => number;
  midiStatus?: MidiStatus;
}

const PATTERN_LETTERS = "ABCDEFGH";

/**
 * Bottom status strip — slim, info-dense readout always visible.
 * Shows: audio context state, BPM, pattern, playhead, master peak (peak-hold),
 * and a Cmd+K hint to open the command palette.
 */
export function StatusBar({ getMasterMeter, midiStatus }: StatusBarProps) {
  const bpm = useEngineStore((s) => s.bpm);
  const playbackState = useEngineStore((s) => s.playbackState);
  const currentPattern = useEngineStore((s) => s.currentPattern);
  const currentStep = useEngineStore((s) => s.currentStep);
  const songMode = useEngineStore((s) => s.songMode);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setMidiOpen = useUiStore((s) => s.setMidiOpen);
  const tracks = useEngineStore((s) => s.tracks);
  const totalSteps = tracks[0]?.steps.length ?? 16;

  const [peakDb, setPeakDb] = useState(-Infinity);
  const [peakHold, setPeakHold] = useState(-Infinity);
  const [audioState, setAudioState] = useState<AudioContextState | "uninit">("uninit");
  const peakHoldRef = useRef({ value: -Infinity, expires: 0 });

  // Animate peak meter at ~30fps. Decay toward floor; hold true peak for 1s.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 33) return;
      last = t;
      const db = getMasterMeter();
      setPeakDb(Number.isFinite(db) ? db : -Infinity);
      const hold = peakHoldRef.current;
      if (db > hold.value || t > hold.expires) {
        if (db > hold.value || t > hold.expires) {
          peakHoldRef.current = { value: db, expires: t + 1200 };
          setPeakHold(db);
        }
      }
      // Reflect Tone audio context state when changed.
      try {
        const ctxState = Tone.getContext().state as AudioContextState;
        setAudioState((prev) => (prev === ctxState ? prev : ctxState));
      } catch {
        /* ignore */
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getMasterMeter]);

  const peakColor =
    peakHold > -1
      ? "text-red-400"
      : peakHold > -6
        ? "text-amber-300"
        : peakHold > -24
          ? "text-foreground"
          : "text-muted";

  const peakLabel = !Number.isFinite(peakDb) ? "—∞" : `${peakDb.toFixed(1)}`;
  const holdLabel = !Number.isFinite(peakHold) ? "—∞" : `${peakHold.toFixed(1)}`;

  const playGlyph =
    playbackState === "playing" ? "▶" : playbackState === "paused" ? "❙❙" : "■";
  const playColor =
    playbackState === "playing"
      ? "text-accent"
      : playbackState === "paused"
        ? "text-amber-300"
        : "text-muted";

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-3 py-1 text-[10px] font-mono text-muted">
      <div className="flex items-center gap-3">
        <span className={`${playColor}`} aria-label={`Transport ${playbackState}`}>
          {playGlyph}
        </span>
        <span>
          <span className="text-soft">BPM</span> <span className="text-foreground">{bpm}</span>
        </span>
        <span className="opacity-40">·</span>
        <span>
          <span className="text-soft">PAT</span>{" "}
          <span className="text-foreground">
            {PATTERN_LETTERS[currentPattern] ?? currentPattern + 1}
          </span>
          <span className="text-muted">/{MAX_PATTERNS}</span>
          {songMode && <span className="ml-1 text-accent">SONG</span>}
        </span>
        <span className="opacity-40">·</span>
        <span>
          <span className="text-soft">STEP</span>{" "}
          <span className="text-foreground">
            {playbackState === "stopped" ? "—" : currentStep + 1}
          </span>
          <span className="text-muted">/{totalSteps}</span>
        </span>
        <span className="opacity-40">·</span>
        <span>
          <span className="text-soft">CTX</span>{" "}
          <span
            className={
              audioState === "running"
                ? "text-accent"
                : audioState === "suspended"
                  ? "text-amber-300"
                  : "text-muted"
            }
          >
            {audioState === "uninit" ? "idle" : audioState}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-soft">PEAK</span>
          <PeakMeter db={peakDb} />
          <span className={`tabular-nums ${peakColor}`}>{peakLabel}</span>
          <span className="text-muted/70">/ hold {holdLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => setMidiOpen(true)}
          className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] transition-colors ${
            midiStatus?.enabled
              ? "border-accent/50 text-accent"
              : "border-border bg-surface-2 text-soft hover:border-accent hover:text-accent"
          }`}
          title={
            midiStatus?.enabled
              ? `MIDI: ${midiStatus.inputs.length} device${midiStatus.inputs.length === 1 ? "" : "s"}`
              : "Enable MIDI input (⌘M)"
          }
        >
          <span>MIDI</span>
          {midiStatus?.enabled && (
            <span className="font-mono">{midiStatus.inputs.length}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex items-center gap-1.5 rounded border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-soft transition-colors hover:border-accent hover:text-accent"
          title="Open command palette"
        >
          <span>⌘</span>
          <span>K</span>
        </button>
      </div>
    </div>
  );
}

// 24-segment LED-style horizontal peak meter, -60dB..0dB.
function PeakMeter({ db }: { db: number }) {
  const SEGMENTS = 24;
  const MIN_DB = -60;
  const norm = !Number.isFinite(db)
    ? 0
    : Math.max(0, Math.min(1, (db - MIN_DB) / (0 - MIN_DB)));
  const lit = Math.round(norm * SEGMENTS);
  return (
    <div className="flex items-center gap-[1px]" aria-hidden="true">
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const on = i < lit;
        const danger = i >= SEGMENTS - 2;
        const warn = i >= SEGMENTS - 6;
        const color = !on
          ? "bg-border"
          : danger
            ? "bg-red-400"
            : warn
              ? "bg-amber-300"
              : "bg-accent";
        return <span key={i} className={`h-2 w-[3px] rounded-[1px] ${color}`} />;
      })}
    </div>
  );
}
