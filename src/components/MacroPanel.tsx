"use client";

import { useState } from "react";
import { useEngine } from "../store/engine";
import { type Macro } from "../lib/sounds";

export default function MacroPanel() {
  const macros = useEngine((s) => s.macros);
  const tracks = useEngine((s) => s.tracks);
  const generating = useEngine((s) => s.generating);
  const generatePrompt = useEngine((s) => s.generatePrompt);
  const { setMacro, pushSnapshot, setGeneratePrompt, setGenerating, applyGeneratedBeat } = useEngine.getState();
  const [genError, setGenError] = useState<string | null>(null);

  const generate = async () => {
    const prompt = generatePrompt.trim();
    if (!prompt || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Generation failed (${res.status})`);
      }
      const beat = await res.json();
      applyGeneratedBeat(beat);
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

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
            type="range" min="0" max="100"
            value={macros[key]}
            onChange={(e) => setMacro(key, Number(e.target.value))}
            onMouseDown={pushSnapshot}
          />
          <strong>{macros[key]}</strong>
        </label>
      ))}

      <div className="visualizer" aria-label="Generative studio visualizer">
        {tracks.map((track, index) => (
          <span
            key={track.id}
            style={{
              "--track-hue": track.hue,
              "--height": `${18 + track.pattern.filter(Boolean).length * 5 + index * 4}%`,
              opacity: track.muted ? 0.25 : 1,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="ai-card">
        <p>AI beat generator</p>
        <strong>Describe a vibe. Claude builds the pattern.</strong>
        <textarea
          className="generate-input"
          placeholder="e.g. dark minimal techno with off-grid hats..."
          value={generatePrompt}
          onChange={(e) => setGeneratePrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); } }}
          rows={2}
        />
        <button
          className="primary-action generate-btn"
          onClick={generate}
          disabled={generating || !generatePrompt.trim()}
        >
          {generating ? "Generating..." : "Generate"}
        </button>
        {genError && <span className="gen-error">{genError}</span>}
      </div>

      <div className="shortcut-hint">
        <p>Keyboard</p>
        <span>Space play/pause &middot; Esc stop &middot; R regenerate &middot; M mutate &middot; E export &middot; Ctrl+Z undo &middot; G generate</span>
      </div>
    </aside>
  );
}
