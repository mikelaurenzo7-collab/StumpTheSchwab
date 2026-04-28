"use client";

import { useEngineStore } from "@/store/engine";

interface Props {
  onTogglePlay: () => void;
}

export default function Transport({ onTogglePlay }: Props) {
  const playing = useEngineStore((s) => s.playing);
  const bpm = useEngineStore((s) => s.bpm);
  const density = useEngineStore((s) => s.density);
  const scene = useEngineStore((s) => s.scene);
  const setBpm = useEngineStore((s) => s.setBpm);
  const setDensity = useEngineStore((s) => s.setDensity);

  const tracks = useEngineStore((s) => s.tracks);
  const energy = Math.round(
    (tracks.reduce((sum, t) => sum + t.pattern.filter(Boolean).length * t.level, 0) /
      (tracks.length * 16)) *
      100
  );

  return (
    <section className="command-strip" aria-label="Session controls">
      <div className="transport-play">
        <button
          className={`play-btn ${playing ? "is-playing" : ""}`}
          onClick={onTogglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect x="3" y="2" width="4" height="14" rx="1" />
              <rect x="11" y="2" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M4 2.5v13l12-6.5z" />
            </svg>
          )}
        </button>
        <div>
          <span>Scene</span>
          <strong>{scene}</strong>
        </div>
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
  );
}
