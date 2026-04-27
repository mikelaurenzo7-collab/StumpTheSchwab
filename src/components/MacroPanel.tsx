"use client";

import { useEngine, type Macro } from "@/store/engine";
import { useMemo } from "react";

const MACRO_META: Record<keyof Macro, { label: string; desc: string }> = {
  bloom:    { label: "Bloom",    desc: "Filter sweep" },
  gravity:  { label: "Gravity",  desc: "Pitch warp" },
  shimmer:  { label: "Shimmer",  desc: "Reverb send" },
  fracture: { label: "Fracture", desc: "Resonance" },
};

export function MacroPanel() {
  const macros = useEngine((s) => s.macros);
  const setMacro = useEngine((s) => s.setMacro);
  const patterns = useEngine((s) => s.patterns);
  const currentPattern = useEngine((s) => s.currentPattern);

  const tracks = useMemo(
    () => patterns[currentPattern]?.tracks ?? [],
    [patterns, currentPattern]
  );

  const energy = useMemo(() => {
    const active = tracks.reduce(
      (sum, track) => sum + track.pattern.filter(Boolean).length * track.level,
      0
    );
    return Math.round((active / (tracks.length * 16)) * 100);
  }, [tracks]);

  return (
    <aside className="synth-card">
      <div className="section-heading">
        <p>Sound design cockpit</p>
        <h2>Morph the machine.</h2>
      </div>

      {(Object.keys(macros) as Array<keyof Macro>).map((key) => (
        <label className="macro" key={key}>
          <div className="macro-info">
            <span className="macro-label">{MACRO_META[key].label}</span>
            <span className="macro-desc">{MACRO_META[key].desc}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={macros[key]}
            onChange={(e) => setMacro(key, Number(e.target.value))}
          />
          <strong>{macros[key]}</strong>
        </label>
      ))}

      <div className="visualizer" aria-label="Track energy visualizer">
        {tracks.map((track) => (
          <span
            key={track.id}
            style={{
              "--track-hue": track.hue,
              "--height": `${12 + track.pattern.filter(Boolean).length * 5.5}%`,
              opacity: track.muted ? 0.2 : 1,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="energy-readout">
        <span>Energy</span>
        <div className="energy-bar">
          <div className="energy-fill" style={{ width: `${energy}%` }} />
        </div>
        <strong>{energy}%</strong>
      </div>
    </aside>
  );
}
