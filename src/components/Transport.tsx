"use client";

import { useMemo } from "react";
import { useEngineStore } from "../store/engine";
import { STEPS } from "../lib/sounds";

interface Props {
  onPlay: () => void;
  onPause: () => void;
  onExport: () => void;
}

export function Transport({ onPlay, onPause, onExport }: Props) {
  const playing = useEngineStore((s) => s.playing);
  const bpm = useEngineStore((s) => s.bpm);
  const swing = useEngineStore((s) => s.swing);
  const density = useEngineStore((s) => s.density);
  const scene = useEngineStore((s) => s.scene);
  const tracks = useEngineStore((s) => s.tracks);
  const exporting = useEngineStore((s) => s.exporting);
  const past = useEngineStore((s) => s.past);
  const future = useEngineStore((s) => s.future);

  const setBpm = useEngineStore((s) => s.setBpm);
  const setSwing = useEngineStore((s) => s.setSwing);
  const setDensity = useEngineStore((s) => s.setDensity);
  const setPlaying = useEngineStore((s) => s.setPlaying);
  const randomizePattern = useEngineStore((s) => s.randomizePattern);
  const mutatePattern = useEngineStore((s) => s.mutatePattern);
  const clearPattern = useEngineStore((s) => s.clearPattern);
  const undo = useEngineStore((s) => s.undo);
  const redo = useEngineStore((s) => s.redo);

  const energy = useMemo(() => {
    const active = tracks.reduce(
      (sum, track) => sum + track.pattern.filter(Boolean).length * track.level,
      0,
    );
    return Math.round((active / (tracks.length * STEPS)) * 100);
  }, [tracks]);

  const toggle = () => {
    if (playing) {
      onPause();
      setPlaying(false);
    } else {
      onPlay();
      setPlaying(true);
    }
  };

  return (
    <>
      <section className="hero-panel">
        <div className="brand-block">
          <div className="orbital-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <p className="eyebrow">StumpTheSchwab</p>
            <h1>Future studio for beats &amp; sound design.</h1>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary-action" onClick={toggle}>
            {playing ? "Pause" : "Play"}
            <kbd>{" "}Space</kbd>
          </button>
          <button className="ghost-action" onClick={randomizePattern}>
            Generate world<kbd>{" "}R</kbd>
          </button>
          <button className="ghost-action" onClick={mutatePattern}>
            Fracture pattern<kbd>{" "}F</kbd>
          </button>
          <div className="hero-action-row">
            <button className="ghost-action small" onClick={clearPattern}>
              Clear
            </button>
            <button className="ghost-action small" onClick={undo} disabled={past.length === 0}>
              Undo
            </button>
            <button className="ghost-action small" onClick={redo} disabled={future.length === 0}>
              Redo
            </button>
            <button
              className="ghost-action small export-btn"
              onClick={onExport}
              disabled={exporting}
            >
              {exporting ? "Rendering…" : "Export WAV"}
            </button>
          </div>
        </div>
      </section>

      <section className="command-strip" aria-label="Session controls">
        <div>
          <span>Scene</span>
          <strong>{scene}</strong>
        </div>
        <label>
          <span>BPM</span>
          <input
            type="range"
            min="72"
            max="178"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <strong>{bpm}</strong>
        </label>
        <label>
          <span>Swing</span>
          <input
            type="range"
            min="0"
            max="80"
            value={swing}
            onChange={(e) => setSwing(Number(e.target.value))}
          />
          <strong>{swing}%</strong>
        </label>
        <label>
          <span>Density</span>
          <input
            type="range"
            min="12"
            max="96"
            value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
          />
          <strong>{density}%</strong>
        </label>
        <div>
          <span>Energy</span>
          <strong>{energy}%</strong>
        </div>
      </section>
    </>
  );
}
