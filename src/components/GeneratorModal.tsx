"use client";

import { useEngineStore, type GeneratedBeat } from "@/store/engine";
import { useUiStore } from "@/store/ui";
import { useCallback, useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "Moody trap beat at 140 with sparse hi-hats",
  "Lofi study vibe — dusty kick, jazzy bass",
  "Punchy four-on-the-floor house at 124",
  "Boom-bap with ghost notes and a swung snare",
  "Late-night drive — minimal techno with a dark bass",
  "Reggaeton dembow at 95",
  "Frenetic drum & bass break at 174",
  "Amapiano log-drum groove at 110",
];

export function GeneratorModal() {
  const open = useUiStore((s) => s.generatorOpen);
  const setOpen = useUiStore((s) => s.setGeneratorOpen);
  const applyGeneratedBeat = useEngineStore((s) => s.applyGeneratedBeat);

  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    beat: GeneratedBeat;
    cached: boolean;
  } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Focus the textarea when the modal opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Esc closes (when not loading; cancel takes priority during loading)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (loading) {
          abortRef.current?.abort();
        } else {
          setOpen(false);
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, loading, setOpen]);

  const handleGenerate = useCallback(
    async (prompt?: string) => {
      const text = (prompt ?? description).trim();
      if (text.length === 0 || text.length > 500) {
        setError("Description must be 1–500 characters.");
        return;
      }
      setLoading(true);
      setError(null);
      setLastResult(null);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: text }),
          signal: ac.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(
            typeof data.error === "string"
              ? data.error
              : `Request failed (${res.status})`,
          );
          return;
        }

        if (!data.beat) {
          setError("No beat returned from the model.");
          return;
        }

        const beat = data.beat as GeneratedBeat;
        applyGeneratedBeat(beat);
        const cached = (data.usage?.cache_read_input_tokens ?? 0) > 0;
        setLastResult({ beat, cached });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setError("Cancelled.");
        } else {
          setError(
            err instanceof Error ? err.message : "Network error during generation.",
          );
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [description, applyGeneratedBeat],
  );

  const handleSuggestion = useCallback(
    (s: string) => {
      setDescription(s);
      handleGenerate(s);
    },
    [handleGenerate],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => !loading && setOpen(false)}
    >
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-2xl w-[90%] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="text-accent">✦</span>
              Generate Beat with Claude
            </h2>
            <p className="text-xs text-muted mt-1">
              Describe a vibe, genre, or mood. Claude returns a complete pattern
              that drops into your current slot.
            </p>
          </div>
          <button
            onClick={() => !loading && setOpen(false)}
            disabled={loading}
            className="text-muted hover:text-foreground text-xl leading-none px-2 disabled:opacity-30"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Suggestion chips */}
        <div className="mb-3">
          <div className="text-[9px] uppercase tracking-wider text-muted mb-1.5">
            Try one
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                disabled={loading}
                className="px-2 py-1 rounded text-[10px] bg-surface-2 text-muted hover:bg-surface-3 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt input */}
        <textarea
          ref={inputRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          maxLength={500}
          rows={3}
          placeholder="e.g. dusty boom-bap at 92 with ghost-note snare and a deep bass walking through Dm..."
          disabled={loading}
          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent resize-none disabled:opacity-50"
        />
        <div className="flex justify-between items-center mt-1 mb-3">
          <span className="text-[10px] text-muted/70">
            {description.length}/500 · Cmd/Ctrl+Enter to generate
          </span>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] text-muted/60">
            {loading
              ? "Claude is composing…"
              : "Replaces the current pattern. Undoable with Ctrl+Z."}
          </div>
          <div className="flex gap-2">
            {loading && (
              <button
                onClick={() => abortRef.current?.abort()}
                className="px-3 py-1.5 rounded text-xs uppercase tracking-wider bg-surface-2 text-muted hover:bg-surface-3 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => handleGenerate()}
              disabled={loading || description.trim().length === 0}
              className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                loading
                  ? "bg-accent/40 text-white/60 cursor-wait"
                  : "bg-accent hover:bg-accent-hover text-white disabled:bg-surface-2 disabled:text-muted/50 disabled:cursor-not-allowed"
              }`}
            >
              {loading ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>

        {/* Result / error */}
        {error && (
          <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded text-xs text-danger whitespace-pre-wrap">
            {error}
          </div>
        )}

        {lastResult && !error && (
          <div className="mt-4 p-3 bg-accent/10 border border-accent/30 rounded">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-accent">
                ✓ Applied: {lastResult.beat.name}
              </span>
              <span className="text-[9px] text-muted font-mono">
                {lastResult.beat.bpm} BPM · {lastResult.beat.totalSteps} steps
                {lastResult.beat.swing > 0
                  ? ` · ${Math.round(lastResult.beat.swing * 100)}% swing`
                  : ""}
                {lastResult.cached ? " · ⚡ cached" : ""}
              </span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              {lastResult.beat.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
