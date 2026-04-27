"use client";

import { useEngine } from "@/store/engine";
import { STEPS, VOICES } from "@/lib/sounds";
import { useCallback, useState } from "react";

export function StepSequencer() {
  const patterns = useEngine((s) => s.patterns);
  const currentPattern = useEngine((s) => s.currentPattern);
  const currentStep = useEngine((s) => s.currentStep);
  const toggleStep = useEngine((s) => s.toggleStep);
  const clearTrack = useEngine((s) => s.clearTrack);
  const setStepProbability = useEngine((s) => s.setStepProbability);

  const tracks = patterns[currentPattern]?.tracks ?? [];

  const [probTarget, setProbTarget] = useState<{ track: number; step: number } | null>(null);

  const handleStepClick = useCallback(
    (trackIndex: number, stepIndex: number) => {
      toggleStep(trackIndex, stepIndex);
    },
    [toggleStep]
  );

  const handleRightClick = useCallback(
    (e: React.MouseEvent, trackIndex: number, stepIndex: number) => {
      e.preventDefault();
      setProbTarget((prev) =>
        prev?.track === trackIndex && prev?.step === stepIndex
          ? null
          : { track: trackIndex, step: stepIndex }
      );
    },
    []
  );

  return (
    <div className="sequencer-card">
      <div className="section-heading">
        <div>
          <p>Neural sequencer</p>
          <h2>Eight engines, sixteen moments.</h2>
        </div>
      </div>

      <div className="step-numbers" aria-hidden="true">
        <span className="track-meta-spacer" />
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={currentStep === i ? "is-current" : ""}>
            {i + 1}
          </span>
        ))}
        <span className="track-actions-spacer" />
      </div>

      <div className="tracks">
        {tracks.map((track, trackIndex) => (
          <div
            className="track-row"
            key={track.id}
            style={{ "--track-hue": track.hue } as React.CSSProperties}
          >
            <div className="track-meta">
              <strong>{track.name}</strong>
              <span>{VOICES[track.voice]?.short ?? track.voice}</span>
            </div>

            <div className="step-grid">
              {track.pattern.map((active, stepIndex) => {
                const prob = track.probability[stepIndex] ?? 100;
                const isProbEditing =
                  probTarget?.track === trackIndex && probTarget?.step === stepIndex;
                return (
                  <button
                    key={`${track.id}-${stepIndex}`}
                    className={[
                      "step-cell",
                      active ? "is-active" : "",
                      currentStep === stepIndex ? "is-current" : "",
                      prob < 100 && active ? "is-prob" : "",
                      stepIndex % 4 === 0 ? "is-downbeat" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={
                      active && prob < 100
                        ? ({ "--prob": `${prob}%` } as React.CSSProperties)
                        : undefined
                    }
                    aria-label={`${track.name} step ${stepIndex + 1}${active ? " active" : ""}${prob < 100 ? ` ${prob}%` : ""}`}
                    onClick={() => handleStepClick(trackIndex, stepIndex)}
                    onContextMenu={(e) => handleRightClick(e, trackIndex, stepIndex)}
                  >
                    {isProbEditing && (
                      <input
                        className="prob-input"
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={prob}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          setStepProbability(trackIndex, stepIndex, Number(e.target.value));
                        }}
                        onBlur={() => setProbTarget(null)}
                        autoFocus
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              className="track-clear"
              onClick={() => clearTrack(trackIndex)}
              aria-label={`Clear ${track.name}`}
              title="Clear pattern"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
