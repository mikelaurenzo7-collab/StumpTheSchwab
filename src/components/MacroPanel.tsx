"use client";

import { useEngineStore, type Macros } from "@/store/engine";

export default function MacroPanel() {
  const macros = useEngineStore((s) => s.macros);
  const tracks = useEngineStore((s) => s.tracks);
  const setMacro = useEngineStore((s) => s.setMacro);

  return (
    <aside className="synth-card">
      <div className="section-heading">
        <p>Sound design cockpit</p>
        <h2>Morph the whole machine.</h2>
      </div>
      {(Object.keys(macros) as Array<keyof Macros>).map((key) => (
        <label className="macro" key={key}>
          <span>{key}</span>
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
      <div className="visualizer" aria-label="Generative studio visualizer">
        {tracks.map((track, i) => (
          <span
            key={track.id}
            style={
              {
                "--track-hue": track.hue,
                "--height": `${18 + track.pattern.filter(Boolean).length * 5 + i * 4}%`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </aside>
  );
}
