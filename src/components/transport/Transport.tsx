"use client";

import { useCallback, useEffect, useRef } from "react";
import { useDAWStore } from "@/store/daw-store";
import { audioEngine } from "@/engine/audio-engine";

function formatTime(beat: number, bpm: number): string {
  const totalSeconds = (beat / bpm) * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

function formatBeatPosition(beat: number): string {
  const bar = Math.floor(beat / 4) + 1;
  const beatInBar = Math.floor(beat % 4) + 1;
  const tick = Math.floor((beat % 1) * 100);
  return `${bar}.${beatInBar}.${String(tick).padStart(2, "0")}`;
}

export default function Transport() {
  const {
    transportState,
    bpm,
    currentBeat,
    loopEnabled,
    play,
    stop,
    record,
    setBpm,
    setCurrentBeat,
    toggleLoop,
  } = useDAWStore();

  const bpmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [bpm]);

  useEffect(() => {
    audioEngine.onBeat((beat) => {
      setCurrentBeat(beat);
    });
  }, [setCurrentBeat]);

  const handlePlay = useCallback(async () => {
    if (transportState === "playing") {
      audioEngine.stop();
      stop();
    } else {
      await audioEngine.play();
      play();
    }
  }, [transportState, play, stop]);

  const handleStop = useCallback(() => {
    audioEngine.stop();
    stop();
    setCurrentBeat(0);
  }, [stop, setCurrentBeat]);

  const handleRecord = useCallback(async () => {
    if (transportState === "recording") {
      audioEngine.stop();
      stop();
    } else {
      await audioEngine.play();
      record();
    }
  }, [transportState, record, stop]);

  const handleBpmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) setBpm(val);
    },
    [setBpm]
  );

  return (
    <div
      className="flex items-center gap-1 px-4 h-14 shrink-0"
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-primary)",
      }}
    >
      {/* Logo / App Name */}
      <div className="flex items-center gap-2 mr-4">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
          style={{ background: "var(--accent)" }}
        >
          S
        </div>
        <span className="text-sm font-semibold tracking-tight hidden sm:block">
          StumpTheSchwab
        </span>
      </div>

      {/* Divider */}
      <div
        className="w-px h-8 mx-2"
        style={{ background: "var(--border-primary)" }}
      />

      {/* Transport Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleStop}
          className="w-9 h-9 rounded-md flex items-center justify-center text-lg transition-colors"
          style={{
            background:
              transportState === "stopped"
                ? "var(--bg-hover)"
                : "var(--bg-tertiary)",
          }}
          title="Stop"
        >
          &#9632;
        </button>
        <button
          onClick={handlePlay}
          className="w-9 h-9 rounded-md flex items-center justify-center text-lg transition-colors"
          style={{
            background:
              transportState === "playing"
                ? "var(--accent-dim)"
                : "var(--bg-tertiary)",
            color:
              transportState === "playing"
                ? "var(--accent)"
                : "var(--text-primary)",
          }}
          title="Play"
        >
          &#9654;
        </button>
        <button
          onClick={handleRecord}
          className="w-9 h-9 rounded-md flex items-center justify-center transition-colors"
          style={{
            background:
              transportState === "recording"
                ? "var(--recording-dim)"
                : "var(--bg-tertiary)",
            color:
              transportState === "recording"
                ? "var(--recording)"
                : "var(--text-secondary)",
          }}
          title="Record"
        >
          <span className="w-3.5 h-3.5 rounded-full inline-block" style={{
            background: transportState === "recording" ? "var(--recording)" : "currentColor",
          }} />
        </button>
      </div>

      {/* Divider */}
      <div
        className="w-px h-8 mx-2"
        style={{ background: "var(--border-primary)" }}
      />

      {/* Position Display */}
      <div
        className="flex flex-col items-center px-3 py-1 rounded-md min-w-[120px]"
        style={{ background: "var(--bg-primary)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          POSITION
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatBeatPosition(currentBeat)}
        </span>
      </div>

      {/* Time Display */}
      <div
        className="flex flex-col items-center px-3 py-1 rounded-md min-w-[100px]"
        style={{ background: "var(--bg-primary)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          TIME
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatTime(currentBeat, bpm)}
        </span>
      </div>

      {/* Divider */}
      <div
        className="w-px h-8 mx-2"
        style={{ background: "var(--border-primary)" }}
      />

      {/* BPM */}
      <div
        className="flex flex-col items-center px-3 py-1 rounded-md"
        style={{ background: "var(--bg-primary)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          BPM
        </span>
        <input
          ref={bpmInputRef}
          type="number"
          value={bpm}
          onChange={handleBpmChange}
          className="w-14 bg-transparent text-center font-mono text-sm font-semibold outline-none tabular-nums"
          min={20}
          max={300}
          step={1}
        />
      </div>

      {/* Loop Toggle */}
      <button
        onClick={toggleLoop}
        className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
        style={{
          background: loopEnabled ? "var(--accent-dim)" : "var(--bg-tertiary)",
          color: loopEnabled ? "var(--accent)" : "var(--text-secondary)",
        }}
        title="Toggle Loop"
      >
        LOOP
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View Toggle */}
      <ViewToggle />
    </div>
  );
}

function ViewToggle() {
  const { viewMode, setViewMode } = useDAWStore();
  return (
    <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <button
        onClick={() => setViewMode("arrange")}
        className="px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          background: viewMode === "arrange" ? "var(--accent-dim)" : "transparent",
          color: viewMode === "arrange" ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        ARRANGE
      </button>
      <button
        onClick={() => setViewMode("mixer")}
        className="px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          background: viewMode === "mixer" ? "var(--accent-dim)" : "transparent",
          color: viewMode === "mixer" ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        MIXER
      </button>
    </div>
  );
}
