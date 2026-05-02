"use client";

import { useEngineStore } from "../store/engine";
import { STEPS } from "../lib/sounds";

export function StepSequencer() {
  const tracks = useEngineStore((s) => s.tracks);
  const currentStep = useEngineStore((s) => s.currentStep);
  const toggleStep = useEngineStore((s) => s.toggleStep);
  const setTrackLevel = useEngineStore((s) => s.setTrackLevel);
  const setTrackMute = useEngineStore((s) => s.setTrackMute);
  const setTrackSolo = useEngineStore((s) => s.setTrackSolo);
  const pushHistory = useEngineStore((s) => s.pushHistory);

  const hasSolo = tracks.some((t) => t.soloed);

  return (
    <div className="sequencer-card">
      <div className="section-heading">
        <p>Neural sequencer</p>
        <h2>Six engines, sixteen moments.</h2>
      </div>
      <div className="step-numbers" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={currentStep === i ? "step-num-active" : ""}>
            {i + 1}
          </span>
        ))}
      </div>
      <div className="tracks">
        {tracks.map((track, trackIndex) => {
          const dimmed = hasSolo && !track.soloed;
          return (
            <div
              className={`track-row${track.muted || dimmed ? " is-dimmed" : ""}`}
              key={track.id}
              style={{ "--track-hue": track.hue } as React.CSSProperties}
            >
              <div className="track-meta">
                <strong>{track.name}</strong>
                <span>{track.voice}</span>
                <div className="track-btns">
                  <button
                    className={`track-btn${track.muted ? " is-on" : ""}`}
                    onClick={() => setTrackMute(track.id)}
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    className={`track-btn solo${track.soloed ? " is-on" : ""}`}
                    onClick={() => setTrackSolo(track.id)}
                    title="Solo"
                  >
                    S
                  </button>
                </div>
              </div>
              <div className="step-grid">
                {track.pattern.map((active, i) => (
                  <button
                    aria-label={`${track.name} step ${i + 1}`}
                    className={`step-cell${active ? " is-active" : ""}${currentStep === i ? " is-current" : ""}${i % 4 === 0 ? " is-downbeat" : ""}`}
                    key={`${track.id}-${i}`}
                    onClick={() => toggleStep(trackIndex, i)}
                  />
                ))}
              </div>
              <label className="mini-fader">
                <span>Vol</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.level}
                  onPointerDown={pushHistory}
                  onChange={(e) => setTrackLevel(track.id, Number(e.target.value))}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
