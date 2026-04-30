"use client";

import { useEngine } from "@/store/engine";

export function Visualizer() {
  const patterns = useEngine((s) => s.patterns);
  const currentPattern = useEngine((s) => s.currentPattern);
  const tracks = patterns[currentPattern]?.tracks ?? [];
  const currentStep = useEngine((s) => s.currentStep);
  const playing = useEngine((s) => s.playing);

  return (
    <div className="visualizer-panel">
      <div className="viz-bars">
        {tracks.map((track) => {
          const activeCount = track.steps.filter((s) => s.active).length;
          const isCurrent = playing && track.steps[currentStep]?.active;
          return (
            <div
              key={track.id}
              className={`viz-bar ${isCurrent ? "is-firing" : ""}`}
              style={{
                "--track-color": track.color,
                "--track-hue": track.hue,
                "--bar-height": `${12 + activeCount * 5.5}%`,
                "--bar-intensity": track.level,
              } as React.CSSProperties}
            >
              <div className="viz-bar-fill" />
              <span className="viz-bar-label">{track.name.split(" ")[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
