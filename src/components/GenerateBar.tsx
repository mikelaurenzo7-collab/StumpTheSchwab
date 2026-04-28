"use client";

import { useCallback, useRef, useState } from "react";
import { useEngineStore, type GeneratedBeat } from "@/store/engine";

export default function GenerateBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const generating = useEngineStore((s) => s.generating);
  const generateError = useEngineStore((s) => s.generateError);
  const bpm = useEngineStore((s) => s.bpm);

  const generate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || generating) return;

    useEngineStore.getState().setGenerating(true);
    useEngineStore.getState().setGenerateError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, currentBpm: bpm }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const beat: GeneratedBeat = await res.json();
      useEngineStore.getState().applyGeneratedBeat(beat);
      setPrompt("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      useEngineStore.getState().setGenerateError(msg);
    } finally {
      useEngineStore.getState().setGenerating(false);
    }
  }, [prompt, generating, bpm]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      generate();
    }
  };

  return (
    <section className="generate-bar">
      <div className="generate-inner">
        <label className="generate-label">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
            <path d="M8 1l1.5 3.2L13 5.5l-2.5 2.3.6 3.7L8 9.8 4.9 11.5l.6-3.7L3 5.5l3.5-1.3z" />
          </svg>
          <span>AI Generate</span>
        </label>
        <div className="generate-input-wrap">
          <input
            ref={inputRef}
            className="generate-input"
            type="text"
            placeholder="trap beat with rolling hats..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKey}
            disabled={generating}
            data-generate-input
          />
          <button
            className="generate-btn"
            onClick={generate}
            disabled={generating || !prompt.trim()}
          >
            {generating ? (
              <span className="generate-spinner" />
            ) : (
              "Generate"
            )}
          </button>
        </div>
        {generateError && (
          <p className="generate-error">{generateError}</p>
        )}
      </div>
      <kbd className="shortcut-hint">G</kbd>
    </section>
  );
}
