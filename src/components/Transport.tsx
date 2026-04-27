"use client";

import { useEngine } from "@/store/engine";
import { useAudioEngine } from "@/lib/useAudioEngine";
import { useEffect, useCallback } from "react";

export function Transport() {
  const playing = useEngine((s) => s.playing);
  const bpm = useEngine((s) => s.bpm);
  const swing = useEngine((s) => s.swing);
  const currentStep = useEngine((s) => s.currentStep);
  const patterns = useEngine((s) => s.patterns);
  const currentPattern = useEngine((s) => s.currentPattern);
  const setBpm = useEngine((s) => s.setBpm);
  const setSwing = useEngine((s) => s.setSwing);
  const selectPattern = useEngine((s) => s.selectPattern);
  const duplicatePattern = useEngine((s) => s.duplicatePattern);
  const undo = useEngine((s) => s.undo);
  const redo = useEngine((s) => s.redo);

  const { startPlayback, stopPlayback, pausePlayback, exportWav } = useAudioEngine();

  const handlePlayPause = useCallback(() => {
    if (playing) pausePlayback();
    else startPlayback();
  }, [playing, startPlayback, pausePlayback]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          handlePlayPause();
          break;
        case "Escape":
          stopPlayback();
          break;
        case "z":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
          }
          break;
        case "y":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            redo();
          }
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePlayPause, stopPlayback, undo, redo]);

  return (
    <section className="transport-bar">
      <div className="transport-left">
        <button
          className={`transport-btn play-btn ${playing ? "is-playing" : ""}`}
          onClick={handlePlayPause}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="1" width="4" height="14" rx="1" />
              <rect x="10" y="1" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 1.5v13l11-6.5z" />
            </svg>
          )}
        </button>
        <button className="transport-btn" onClick={stopPlayback} aria-label="Stop">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="1" y="1" width="12" height="12" rx="2" />
          </svg>
        </button>
        <div className="step-indicator">
          {currentStep >= 0 ? String(currentStep + 1).padStart(2, "0") : "--"}
        </div>
      </div>

      <div className="transport-center">
        <label className="transport-knob">
          <span>BPM</span>
          <input
            type="range"
            min="30"
            max="300"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <strong>{bpm}</strong>
        </label>
        <label className="transport-knob">
          <span>Swing</span>
          <input
            type="range"
            min="0"
            max="100"
            value={swing}
            onChange={(e) => setSwing(Number(e.target.value))}
          />
          <strong>{swing}%</strong>
        </label>
      </div>

      <div className="transport-right">
        <div className="pattern-selector">
          {patterns.map((p, i) => (
            <button
              key={i}
              className={`pattern-btn ${i === currentPattern ? "is-active" : ""}`}
              onClick={() => selectPattern(i)}
            >
              {p.name}
            </button>
          ))}
          {patterns.length < 8 && (
            <button className="pattern-btn pattern-add" onClick={duplicatePattern}>+</button>
          )}
        </div>
        <button className="transport-btn export-btn" onClick={exportWav} aria-label="Export WAV">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 1v8m0 0L4 6.5m3 2.5l3-2.5M1 10v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
          </svg>
        </button>
        <div className="undo-redo">
          <button className="transport-btn" onClick={undo} aria-label="Undo" title="Undo (Ctrl+Z)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 5h6a3 3 0 110 6H7M3 5l2.5-2.5M3 5l2.5 2.5" />
            </svg>
          </button>
          <button className="transport-btn" onClick={redo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M11 5H5a3 3 0 100 6h2M11 5L8.5 2.5M11 5L8.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
