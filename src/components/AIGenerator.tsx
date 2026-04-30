"use client";

import { useState } from "react";
import { useEngine } from "@/store/engine";

export function AIGenerator() {
  const prompt = useEngine((s) => s.prompt);
  const generating = useEngine((s) => s.generating);
  const setPrompt = useEngine((s) => s.setPrompt);
  const setGenerating = useEngine((s) => s.setGenerating);
  const applyGeneratedBeat = useEngine((s) => s.applyGeneratedBeat);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Generation failed (${res.status})`);
      }

      const beat = await res.json();
      applyGeneratedBeat(beat);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="ai-generator">
      <div className="section-heading">
        <div>
          <p>AI Beat Lab</p>
          <h2>Describe your beat.</h2>
        </div>
      </div>
      <div className="ai-input-row">
        <input
          type="text"
          className="ai-prompt-input"
          placeholder="dark trap beat with heavy 808s..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          disabled={generating}
        />
        <button
          className="action-btn generate-btn ai-go"
          onClick={generate}
          disabled={generating || !prompt.trim()}
        >
          {generating ? (
            <span className="ai-spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 1v4M8 11v4M1 8h4M11 8h4M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" />
            </svg>
          )}
          {generating ? "Generating..." : "Generate"}
        </button>
      </div>
      {error && <p className="ai-error">{error}</p>}
    </div>
  );
}
