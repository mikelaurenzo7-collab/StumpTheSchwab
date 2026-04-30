"use client";

import { useEngine } from "@/store/engine";

interface TransportProps {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onExport: () => void;
}

export function Transport({ onPlay, onPause, onStop, onExport }: TransportProps) {
  const playing = useEngine((s) => s.playing);
  const bpm = useEngine((s) => s.bpm);
  const swing = useEngine((s) => s.swing);
  const scene = useEngine((s) => s.scene);
  const energy = useEngine((s) => s.energy());
  const canUndo = useEngine((s) => s.canUndo());
  const canRedo = useEngine((s) => s.canRedo());
  const setBpm = useEngine((s) => s.setBpm);
  const setSwing = useEngine((s) => s.setSwing);
  const undo = useEngine((s) => s.undo);
  const redo = useEngine((s) => s.redo);

  return (
    <section className="transport-bar">
      <div className="transport-left">
        <button
          className="transport-btn play-btn"
          onClick={() => (playing ? onPause() : onPlay())}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect x="3" y="2" width="4" height="14" rx="1" />
              <rect x="11" y="2" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M4 2l12 7-12 7z" />
            </svg>
          )}
        </button>
        <button className="transport-btn" onClick={onStop} aria-label="Stop">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="1" y="1" width="12" height="12" rx="2" />
          </svg>
        </button>
        <div className="transport-divider" />
        <button className="transport-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 7h7a4 4 0 110 8H7" /><path d="M6 4L3 7l3 3" />
          </svg>
        </button>
        <button className="transport-btn" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M13 7H6a4 4 0 100 8h3" /><path d="M10 4l3 3-3 3" />
          </svg>
        </button>
      </div>

      <div className="transport-center">
        <label className="transport-param">
          <span>BPM</span>
          <input
            type="range"
            min="40"
            max="220"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <strong>{bpm}</strong>
        </label>
        <label className="transport-param">
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
        <div className="transport-info">
          <span className="scene-label">{scene}</span>
          <span className="energy-label">Energy {energy}%</span>
        </div>
        <button className="transport-btn export-btn" onClick={onExport} title="Export WAV (Ctrl+E)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" />
          </svg>
          WAV
        </button>
      </div>
    </section>
  );
}
