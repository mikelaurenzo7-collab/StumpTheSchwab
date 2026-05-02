"use client";

import { useEngineStore, type Macro } from "../store/engine";

export function SynthPanel() {
  const macros = useEngineStore((s) => s.macros);
  const tracks = useEngineStore((s) => s.tracks);
  const setMacro = useEngineStore((s) => s.setMacro);
  const pushHistory = useEngineStore((s) => s.pushHistory);

  return (
    <aside className="synth-card">
      <div className="section-heading">
        <p>Sound design cockpit</p>
        <h2>Morph the whole machine.</h2>
      </div>
      {(Object.keys(macros) as Array<keyof Macro>).map((key) => (
        <label className="macro" key={key}>
          <span>{key}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={macros[key]}
            onPointerDown={pushHistory}
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
      <div className="ai-card">
        <p>Keyboard</p>
        <div className="shortcut-list">
          <span>
            <kbd>Space</kbd> Play / Pause
          </span>
          <span>
            <kbd>R</kbd> Generate
          </span>
          <span>
            <kbd>F</kbd> Fracture
          </span>
          <span>
            <kbd>C</kbd> Clear
          </span>
          <span>
            <kbd>E</kbd> Export WAV
          </span>
          <span>
            <kbd>⌘Z</kbd> Undo
          </span>
          <span>
            <kbd>⌘⇧Z</kbd> Redo
          </span>
        </div>
      </div>
    </aside>
  );
}
