"use client";

import {
  useEngineStore,
  GENERATED_TRACK_KEYS,
  type GeneratedBeat,
} from "@/store/engine";
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

const REFINE_CHIPS = [
  "Make it darker",
  "More sparse",
  "Punchier kick",
  "Add a fill on the last bar",
  "Add hi-hat rolls",
  "Swing it more",
  "Brighter / more uplifting",
  "Stripped-down version",
];

// Build a GeneratedBeat from the live engine state so refinements operate on
// whatever the user is currently hearing — including manual edits made after
// the last generation.
function snapshotCurrentBeat(): GeneratedBeat | null {
  const s = useEngineStore.getState();
  // Refinement only meaningfully works at 16 or 32 steps (matching the tool schema)
  if (s.totalSteps !== 16 && s.totalSteps !== 32) return null;
  const tracks: GeneratedBeat["tracks"] = {
    kick: [],
    snare: [],
    hihat: [],
    openhat: [],
    clap: [],
    tom: [],
    perc: [],
    bass: [],
  };
  const melodicNotes: GeneratedBeat["melodicNotes"] = {
    tom: [],
    perc: [],
    bass: [],
  };
  s.tracks.forEach((t, i) => {
    const key = GENERATED_TRACK_KEYS[i];
    if (!key) return;
    tracks[key] = [...t.steps];
    if (key === "tom" || key === "perc" || key === "bass") {
      melodicNotes[key] = [...t.notes];
    }
  });
  const currentName = s.patterns[s.currentPattern]?.name ?? "Current";
  return {
    name: currentName,
    bpm: s.bpm,
    swing: s.swing,
    totalSteps: s.totalSteps as 16 | 32,
    tracks,
    melodicNotes,
    explanation: "(user's current pattern)",
  };
}

export function GeneratorModal() {
  const open = useUiStore((s) => s.generatorOpen);
  const setOpen = useUiStore((s) => s.setGeneratorOpen);
  const applyGeneratedBeat = useEngineStore((s) => s.applyGeneratedBeat);

  const [mode, setMode] = useState<"create" | "refine">("create");
  const [description, setDescription] = useState("");
  const [refineDraft, setRefineDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    beat: GeneratedBeat;
    cached: boolean;
    refined: boolean;
  } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const refineInputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Focus the textarea when the modal opens or the mode changes
  useEffect(() => {
    if (!open) return;
    if (mode === "create") inputRef.current?.focus();
    else refineInputRef.current?.focus();
  }, [open, mode]);

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
    async (opts: {
      prompt: string;
      refine: boolean;
    }) => {
      const text = opts.prompt.trim();
      if (text.length === 0 || text.length > 500) {
        setError("Prompt must be 1–500 characters.");
        return;
      }
      setLoading(true);
      setError(null);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const body: Record<string, unknown> = { description: text };
        if (opts.refine) {
          const snapshot = snapshotCurrentBeat();
          if (snapshot) body.currentBeat = snapshot;
        }

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
        setLastResult({ beat, cached, refined: opts.refine });
        // After a successful create, leave the user in refine mode for follow-ups
        if (!opts.refine) setMode("refine");
        if (opts.refine) setRefineDraft("");
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
    [applyGeneratedBeat],
  );

  const handleSuggestion = useCallback(
    (s: string) => {
      setDescription(s);
      handleGenerate({ prompt: s, refine: false });
    },
    [handleGenerate],
  );

  const handleRefineChip = useCallback(
    (s: string) => {
      setRefineDraft(s);
      handleGenerate({ prompt: s, refine: true });
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
        className="bg-surface border border-border/60 rounded-2xl shadow-2xl p-6 max-w-2xl w-[90%] max-h-[85vh] overflow-y-auto"
        style={{ animation: "fade-in-up 0.22s cubic-bezier(0.22,1,0.36,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span
                className={`text-lg leading-none transition-all ${loading ? "animate-pulse" : ""}`}
                style={{ color: "var(--accent)", filter: loading ? "drop-shadow(0 0 6px var(--accent-glow))" : "none" }}
              >
                ✦
              </span>
              {mode === "create" ? "Generate Beat" : "Refine Beat"}
              <span className="text-[10px] font-normal text-muted/70 ml-1 tracking-normal">powered by Claude</span>
            </h2>
            <p className="text-xs text-muted mt-1">
              {mode === "create"
                ? "Describe a vibe, genre, or mood. Claude returns a complete pattern that drops into your current slot."
                : "Tell Claude how to evolve the current pattern. Targeted edits — kick, snare, fills, swing, key — keep what's working."}
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

        {/* Mode tabs */}
        <div className="flex gap-1 mb-4 border-b border-border">
          <button
            onClick={() => !loading && setMode("create")}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              mode === "create"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            Create
          </button>
          <button
            onClick={() => !loading && setMode("refine")}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              mode === "refine"
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            Refine
          </button>
        </div>

        {mode === "create" ? (
          <>
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
                    className="px-2.5 py-1 rounded-full text-[10px] border border-border/40 bg-surface-2 text-muted hover:border-accent/40 hover:text-foreground hover:bg-surface-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
                  handleGenerate({ prompt: description, refine: false });
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
          </>
        ) : (
          <>
            {/* Refinement chips */}
            <div className="mb-3">
              <div className="text-[9px] uppercase tracking-wider text-muted mb-1.5">
                Quick refinements
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REFINE_CHIPS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleRefineChip(s)}
                    disabled={loading}
                    className="px-2.5 py-1 rounded-full text-[10px] border border-border/40 bg-surface-2 text-muted hover:border-accent/40 hover:text-foreground hover:bg-surface-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Refine input */}
            <textarea
              ref={refineInputRef}
              value={refineDraft}
              onChange={(e) => setRefineDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate({ prompt: refineDraft, refine: true });
                }
              }}
              maxLength={500}
              rows={2}
              placeholder="e.g. drop the open hat, add a tom fill on steps 13-16, raise kick velocity"
              disabled={loading}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent resize-none disabled:opacity-50"
            />
            <div className="flex justify-between items-center mt-1 mb-3">
              <span className="text-[10px] text-muted/70">
                {refineDraft.length}/500 · Cmd/Ctrl+Enter to refine · operates on the LIVE pattern
              </span>
            </div>
          </>
        )}

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
              onClick={() =>
                handleGenerate({
                  prompt: mode === "create" ? description : refineDraft,
                  refine: mode === "refine",
                })
              }
              disabled={
                loading ||
                (mode === "create"
                  ? description.trim().length === 0
                  : refineDraft.trim().length === 0)
              }
              className={`px-5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                loading
                  ? "bg-accent/30 text-white/60 cursor-wait"
                  : "bg-gradient-to-r from-accent to-accent-hover text-white disabled:from-surface-2 disabled:to-surface-2 disabled:text-muted/50 disabled:cursor-not-allowed hover:shadow-lg"
              }`}
              style={!loading && !(mode === "create" ? description.trim().length === 0 : refineDraft.trim().length === 0)
                ? { boxShadow: "0 0 16px var(--accent-glow)" } : undefined}
            >
              {loading
                ? mode === "refine"
                  ? "Refining…"
                  : "Generating…"
                : mode === "refine"
                  ? "Refine"
                  : "Generate"}
            </button>
          </div>
        </div>

        {/* Result / error */}
        {error && (
          <div className="mt-4 p-3 bg-danger/8 border border-danger/25 rounded-xl text-xs text-danger whitespace-pre-wrap">
            {error}
          </div>
        )}

        {lastResult && !error && (
          <div className="mt-4 p-3.5 bg-accent/8 border border-accent/25 rounded-xl" style={{ animation: "fade-in-up 0.2s ease-out both" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-accent">
                {lastResult.refined ? "✦ Refined: " : "✓ Applied: "}
                {lastResult.beat.name}
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
