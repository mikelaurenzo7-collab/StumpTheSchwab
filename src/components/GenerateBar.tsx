"use client";

import { useEngine } from "@/store/engine";
import { useCallback } from "react";

export function GenerateBar() {
  const prompt = useEngine((s) => s.generatePrompt);
  const generating = useEngine((s) => s.generating);
  const setPrompt = useEngine((s) => s.setGeneratePrompt);
  const setGenerating = useEngine((s) => s.setGenerating);
  const applyBeat = useEngine((s) => s.applyGeneratedBeat);

  const generate = useCallback(async () => {
    if (generating || !prompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }
      const beat = await res.json();
      applyBeat(beat);
    } catch (err) {
      console.error("Generate failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [prompt, generating, setGenerating, applyBeat]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        generate();
      }
    },
    [generate]
  );

  return (
    <div className="generate-bar">
      <div className="generate-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1v4M8 11v4M1 8h4M11 8h4M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" />
        </svg>
      </div>
      <input
        className="generate-input"
        type="text"
        placeholder="Describe a beat... (e.g. &quot;dark trap with rolling hats&quot;)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKey}
        disabled={generating}
        maxLength={500}
      />
      <button
        className={`generate-btn ${generating ? "is-generating" : ""}`}
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
  );
}
