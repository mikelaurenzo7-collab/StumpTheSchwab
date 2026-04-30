"use client";

import { useCallback } from "react";
import { useEngine } from "@/store/engine";
import { STEPS } from "@/lib/sounds";

export function StepSequencer() {
  const patterns = useEngine((s) => s.patterns);
  const currentPattern = useEngine((s) => s.currentPattern);
  const tracks = patterns[currentPattern]?.tracks ?? [];
  const currentStep = useEngine((s) => s.currentStep);
  const playing = useEngine((s) => s.playing);
  const toggleStep = useEngine((s) => s.toggleStep);
  const toggleMute = useEngine((s) => s.toggleMute);
  const toggleSolo = useEngine((s) => s.toggleSolo);
  const clearTrack = useEngine((s) => s.clearTrack);
  const selectPattern = useEngine((s) => s.selectPattern);

  const handleStepClick = useCallback(
    (trackIndex: number, stepIndex: number) => {
      toggleStep(trackIndex, stepIndex);
    },
    [toggleStep],
  );

  return (
    <div className="sequencer-card">
      <div className="sequencer-header">
        <div className="section-heading">
          <div>
            <p>Neural Sequencer</p>
            <h2>Eight engines, sixteen steps.</h2>
          </div>
        </div>
        <div className="pattern-slots">
          {patterns.map((p, i) => (
            <button
              key={p.id}
              className={`pattern-slot ${i === currentPattern ? "is-active" : ""}`}
              onClick={() => selectPattern(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="step-numbers" aria-hidden="true">
        <div className="step-numbers-spacer" />
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={i === currentStep && playing ? "is-current" : ""}>
            {i + 1}
          </span>
        ))}
      </div>

      <div className="tracks">
        {tracks.map((track, trackIndex) => (
          <div
            className="track-row"
            key={track.id}
            style={{ "--track-hue": track.hue, "--track-color": track.color } as React.CSSProperties}
          >
            <div className="track-meta">
              <div className="track-name-row">
                <span className="track-dot" />
                <strong>{track.name}</strong>
              </div>
              <div className="track-controls">
                <button
                  className={`track-ctrl-btn ${track.mute ? "is-active" : ""}`}
                  onClick={() => toggleMute(trackIndex)}
                  title="Mute"
                >
                  M
                </button>
                <button
                  className={`track-ctrl-btn solo-btn ${track.solo ? "is-active" : ""}`}
                  onClick={() => toggleSolo(trackIndex)}
                  title="Solo"
                >
                  S
                </button>
                <button
                  className="track-ctrl-btn"
                  onClick={() => clearTrack(trackIndex)}
                  title="Clear"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="step-grid">
              {track.steps.map((step, stepIndex) => (
                <button
                  key={stepIndex}
                  aria-label={`${track.name} step ${stepIndex + 1}`}
                  className={[
                    "step-cell",
                    step.active ? "is-active" : "",
                    stepIndex === currentStep && playing ? "is-current" : "",
                    stepIndex % 4 === 0 ? "is-downbeat" : "",
                  ].join(" ")}
                  onClick={() => handleStepClick(trackIndex, stepIndex)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
