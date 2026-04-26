"use client";

import { useEngine, selectEnergy } from "../store/engine";

type Props = {
  onPlay: () => void;
  onStop: () => void;
  onExport: () => void;
};

export default function Transport({ onPlay, onStop, onExport }: Props) {
  const playing = useEngine((s) => s.playing);
  const scene = useEngine((s) => s.scene);
  const bpm = useEngine((s) => s.bpm);
  const swing = useEngine((s) => s.swing);
  const density = useEngine((s) => s.density);
  const energy = useEngine(selectEnergy);
  const generating = useEngine((s) => s.generating);
  const past = useEngine((s) => s.past);
  const future = useEngine((s) => s.future);
  const { setBpm, setSwing, setDensity, regenerate, mutate, undo, redo, pushSnapshot } = useEngine.getState();

  return (
    <>
      <section className="hero-panel">
        <div className="brand-block">
          <div className="orbital-mark" aria-hidden="true"><span /></div>
          <div>
            <p className="eyebrow">StumpTheSchwab</p>
            <h1>Future studio for beats and impossible textures.</h1>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary-action" onClick={onPlay}>
            {playing ? "Pause" : "Start engine"}
          </button>
          <button className="ghost-action" onClick={regenerate}>Generate world</button>
          <button className="ghost-action" onClick={mutate}>Fracture pattern</button>
          <div className="action-row">
            <button className="ghost-action sm" onClick={onExport}>Export WAV</button>
            <button className="ghost-action sm" onClick={onStop} disabled={!playing}>Stop</button>
          </div>
          <div className="action-row">
            <button className="ghost-action sm" onClick={undo} disabled={past.length === 0}>Undo</button>
            <button className="ghost-action sm" onClick={redo} disabled={future.length === 0}>Redo</button>
          </div>
          {generating && <span className="generating-badge">AI generating...</span>}
        </div>
      </section>

      <section className="command-strip" aria-label="Session controls">
        <div>
          <span>Scene</span>
          <strong>{scene}</strong>
        </div>
        <label>
          <span>BPM</span>
          <input
            type="range" min="72" max="178" value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            onMouseDown={pushSnapshot}
          />
          <strong>{bpm}</strong>
        </label>
        <label>
          <span>Swing</span>
          <input
            type="range" min="0" max="80" value={swing}
            onChange={(e) => setSwing(Number(e.target.value))}
          />
          <strong>{swing}%</strong>
        </label>
        <label>
          <span>Density</span>
          <input
            type="range" min="12" max="96" value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
          />
          <strong>{density}%</strong>
        </label>
        <div>
          <span>Energy</span>
          <strong>{energy}%</strong>
        </div>
      </section>
    </>
  );
}
