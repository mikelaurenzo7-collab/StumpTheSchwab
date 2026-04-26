"use client";

import { useEngine } from "../store/engine";
import { STEPS } from "../lib/sounds";

export default function StepSequencer() {
  const tracks = useEngine((s) => s.tracks);
  const currentStep = useEngine((s) => s.currentStep);
  const playing = useEngine((s) => s.playing);
  const { toggleStep, setTrackLevel, toggleMute, toggleSolo, clearTrack, pushSnapshot } = useEngine.getState();

  return (
    <div className="sequencer-card">
      <div className="section-heading">
        <p>Neural sequencer</p>
        <h2>Six engines, sixteen moments.</h2>
      </div>

      <div className="step-numbers" aria-hidden="true">
        <span className="step-spacer" />
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={playing && currentStep === i ? "is-current-num" : ""}>
            {i + 1}
          </span>
        ))}
        <span className="step-spacer" />
      </div>

      <div className="tracks">
        {tracks.map((track) => (
          <div
            className="track-row"
            key={track.id}
            style={{ "--track-hue": track.hue } as React.CSSProperties}
          >
            <div className="track-meta">
              <strong>{track.name}</strong>
              <div className="track-controls">
                <button
                  className={`track-btn mute-btn ${track.muted ? "is-active" : ""}`}
                  onClick={() => toggleMute(track.id)}
                  title="Mute"
                >
                  M
                </button>
                <button
                  className={`track-btn solo-btn ${track.soloed ? "is-active" : ""}`}
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
                  C
                </button>
              </div>
            </div>

            <div className="step-grid">
              {track.pattern.map((active, i) => (
                <button
                  aria-label={`${track.name} step ${i + 1}`}
                  className={[
                    "step-cell",
                    active ? "is-active" : "",
                    playing && currentStep === i ? "is-current" : "",
                    i % 4 === 0 ? "is-downbeat" : "",
                  ].join(" ")}
                  key={`${track.id}-${i}`}
                  onClick={() => toggleStep(track.id, i)}
                />
              ))}
            </div>

            <label className="mini-fader">
              <input
                type="range" min="0" max="1" step="0.01"
                value={track.level}
                onChange={(e) => setTrackLevel(track.id, Number(e.target.value))}
                onMouseDown={pushSnapshot}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
