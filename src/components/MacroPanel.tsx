"use client";

import { useEngine, type Macro } from "@/store/engine";

export function MacroPanel() {
  const macros = useEngine((s) => s.macros);
  const setMacro = useEngine((s) => s.setMacro);
  const regenerate = useEngine((s) => s.regenerate);
  const mutate = useEngine((s) => s.mutate);

  const macroKeys: { key: keyof Macro; label: string; desc: string }[] = [
    { key: "bloom", label: "Bloom", desc: "Filter openness" },
    { key: "gravity", label: "Gravity", desc: "Note gravity" },
    { key: "shimmer", label: "Shimmer", desc: "Send FX depth" },
    { key: "fracture", label: "Fracture", desc: "Mutation rate" },
  ];

  return (
    <div className="macro-panel">
      <div className="section-heading">
        <div>
          <p>Sound Design</p>
          <h2>Morph the machine.</h2>
        </div>
      </div>

      <div className="macro-grid">
        {macroKeys.map(({ key, label, desc }) => (
          <label className="macro-knob" key={key}>
            <div className="macro-ring" style={{ "--progress": macros[key] / 100 } as React.CSSProperties}>
              <span className="macro-value">{macros[key]}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={macros[key]}
              onChange={(e) => setMacro(key, Number(e.target.value))}
              className="macro-slider"
            />
            <strong>{label}</strong>
            <span className="macro-desc">{desc}</span>
          </label>
        ))}
      </div>

      <div className="macro-actions">
        <button className="action-btn generate-btn" onClick={regenerate}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 8a6 6 0 0111.3-2.7M14 8a6 6 0 01-11.3 2.7" />
            <path d="M14 2v4h-4M2 14v-4h4" />
          </svg>
          Generate World
        </button>
        <button className="action-btn" onClick={mutate}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M13 3L3 13M8 3l5 5-5 5" />
          </svg>
          Fracture
        </button>
      </div>
    </div>
  );
}
