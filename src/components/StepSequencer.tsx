"use client";

import { useEngineStore, STEPS } from "@/store/engine";

export default function StepSequencer() {
  const tracks = useEngineStore((s) => s.tracks);
  const currentStep = useEngineStore((s) => s.currentStep);
  const playing = useEngineStore((s) => s.playing);
  const toggleStep = useEngineStore((s) => s.toggleStep);
  const setTrackLevel = useEngineStore((s) => s.setTrackLevel);
  const toggleMute = useEngineStore((s) => s.toggleMute);
  const toggleSolo = useEngineStore((s) => s.toggleSolo);
  const clearTrack = useEngineStore((s) => s.clearTrack);

  const hasSolo = tracks.some((t) => t.solo);

  return (
    <div className="sequencer-card">
      <div className="section-heading">
        <p>Neural sequencer</p>
        <h2>Six engines, sixteen moments.</h2>
      </div>
      <div className="step-numbers" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={playing && currentStep === i ? "is-current-num" : ""}>
            {i + 1}
          </span>
        ))}
      </div>
      <div className="tracks">
        {tracks.map((track, trackIndex) => {
          const dimmed =
            (hasSolo && !track.solo) || track.muted;

          return (
            <div
              className={`track-row ${dimmed ? "is-dimmed" : ""}`}
              key={track.id}
              style={{ "--track-hue": track.hue } as React.CSSProperties}
            >
              <div className="track-meta">
                <strong>{track.name}</strong>
                <span>{track.voice}</span>
                <div className="track-buttons">
                  <button
                    className={`track-btn mute-btn ${track.muted ? "is-on" : ""}`}
                    onClick={() => toggleMute(track.id)}
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    className={`track-btn solo-btn ${track.solo ? "is-on" : ""}`}
                    onClick={() => toggleSolo(track.id)}
                    title="Solo"
                  >
                    S
                  </button>
                  <button
                    className="track-btn clear-btn"
                    onClick={() => clearTrack(track.id)}
                    title="Clear pattern"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="step-grid">
                {track.pattern.map((active, stepIdx) => (
                  <button
                    aria-label={`${track.name} step ${stepIdx + 1}`}
                    className={`step-cell${active ? " is-active" : ""}${playing && currentStep === stepIdx ? " is-current" : ""}${stepIdx % 4 === 0 ? " is-downbeat" : ""}`}
                    key={stepIdx}
                    onClick={() => toggleStep(trackIndex, stepIdx)}
                  />
                ))}
              </div>
              <label className="mini-fader">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.level}
                  onChange={(e) =>
                    setTrackLevel(track.id, Number(e.target.value))
                  }
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
