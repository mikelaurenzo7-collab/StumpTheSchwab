"use client";

import { useEngine } from "@/store/engine";

export function Mixer() {
  const patterns = useEngine((s) => s.patterns);
  const currentPattern = useEngine((s) => s.currentPattern);
  const tracks = patterns[currentPattern]?.tracks ?? [];
  const setLevel = useEngine((s) => s.setLevel);
  const setPan = useEngine((s) => s.setPan);

  return (
    <div className="mixer-card">
      <div className="section-heading">
        <div>
          <p>Channel Strip</p>
          <h2>Mix & Pan</h2>
        </div>
      </div>
      <div className="mixer-channels">
        {tracks.map((track, i) => (
          <div
            key={track.id}
            className="mixer-channel"
            style={{ "--track-color": track.color } as React.CSSProperties}
          >
            <div className="mixer-meter">
              <div
                className="mixer-meter-fill"
                style={{ height: `${track.level * 100}%` }}
              />
            </div>
            <input
              className="mixer-fader"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.level}
              onChange={(e) => setLevel(i, Number(e.target.value))}
              aria-label={`${track.name} level`}
              style={{ writingMode: "vertical-lr", direction: "rtl" } as React.CSSProperties}
            />
            <input
              className="mixer-pan"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={track.pan}
              onChange={(e) => setPan(i, Number(e.target.value))}
              aria-label={`${track.name} pan`}
            />
            <span className="mixer-label">{track.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
