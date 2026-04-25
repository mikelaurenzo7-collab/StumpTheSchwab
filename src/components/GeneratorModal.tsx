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
  "Mutate: make it darker",
  "Simplify: more sparse",
  "Punch: stronger kick",
  "Fill: last-bar turnaround",
  "Fill: add hi-hat rolls",
  "Humanize: swing it more",
  "Expand: brighter B-section",
  "Simplify: strip it down",
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      onClick={() => !loading && setOpen(false)}
    >
      <div
        className="panel relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_10%_0%,rgba(155,92,255,0.18),transparent_18rem)]" />
        <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-cyan">
              Creative instrument
            </p>
            <h2 className="text-2xl font-black tracking-[-0.04em] text-white flex items-center gap-2">
              <span className="text-accent">✦</span>
              {mode === "create" ? "Generate a groove" : "Mutate the current groove"}
            </h2>
            <p className="text-xs text-muted mt-1">
              {mode === "create"
                ? "Describe a vibe, genre, or mood. A complete pattern drops into the current slot."
                : "Push the live pattern toward a direction: mutate, expand, simplify, fill, or arrange while keeping what works."}
            </p>
          </div>
          <button
            onClick={() => !loading && setOpen(false)}
            disabled={loading}
            className="rounded-full px-3 py-1 text-2xl leading-none text-muted hover:bg-white/[0.08] hover:text-foreground disabled:opacity-30"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Mode tabs */}
        <div className="mb-5 flex gap-2 rounded-2xl bg-white/[0.05] p-1">
          <button
            onClick={() => !loading && setMode("create")}
            className={`flex-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
              mode === "create"
                ? "bg-accent text-white"
                : "text-muted hover:bg-white/[0.06] hover:text-foreground"
            }`}
          >
            Generate
          </button>
          <button
            onClick={() => !loading && setMode("refine")}
            className={`flex-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
              mode === "refine"
                ? "bg-accent text-white"
                : "text-muted hover:bg-white/[0.06] hover:text-foreground"
            }`}
          >
            Mutate
          </button>
        </div>

        {mode === "create" ? (
          <>
            {/* Suggestion chips */}
            <div className="mb-3">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-muted mb-2">
                Starting points
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    disabled={loading}
                    className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[10px] text-muted transition-colors hover:bg-white/[0.13] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
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
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none disabled:opacity-50"
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
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-muted mb-2">
                Creative moves
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REFINE_CHIPS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleRefineChip(s)}
                    disabled={loading}
                    className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[10px] text-muted transition-colors hover:bg-white/[0.13] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
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
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <div className="flex justify-between items-center mt-1 mb-3">
              <span className="text-[10px] text-muted/70">
                {refineDraft.length}/500 · Cmd/Ctrl+Enter to mutate · operates on the live pattern
              </span>
            </div>
          </>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] text-muted/60">
            {loading
              ? "Shaping the groove…"
              : "Replaces the current pattern. Undoable with Ctrl+Z."}
          </div>
          <div className="flex gap-2">
            {loading && (
              <button
                onClick={() => abortRef.current?.abort()}
                 className="rounded-full bg-white/[0.08] px-4 py-2 text-xs uppercase tracking-wider text-muted transition-colors hover:bg-white/[0.14]"
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
              className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.18em] transition-colors ${
                loading
                  ? "bg-accent/40 text-white/60 cursor-wait"
                  : "bg-accent hover:bg-accent-hover text-white disabled:bg-white/[0.06] disabled:text-muted/50 disabled:cursor-not-allowed"
              }`}
            >
              {loading
                ? mode === "refine"
                   ? "Mutating…"
                  : "Generating…"
                : mode === "refine"
                   ? "Mutate"
                  : "Generate"}
            </button>
          </div>
        </div>

        {/* Result / error */}
        {error && (
          <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger whitespace-pre-wrap">
            {error}
          </div>
        )}

        {lastResult && !error && (
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-accent">
                 {lastResult.refined ? "✦ Mutated: " : "✓ Applied: "}
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
    </div>
  );
}
