"use client";

import {
  useEngineStore,
  GENERATED_TRACK_KEYS,
  type GeneratedBeat,
} from "@/store/engine";
import { useUiStore } from "@/store/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type GeneratorMode = "create" | "refine";
type GenerateTarget = "full" | "drums" | "bass" | "melody" | "arrangement";
type CompareSlot = "A" | "B";

interface HistoryEntry {
  id: string;
  version: number;
  prompt: string;
  target: GenerateTarget;
  refined: boolean;
  beat: GeneratedBeat;
  createdAt: string; // ISO timestamp for stable local persistence / replay ordering.
}

interface CreativeProfile {
  id: string;
  name: string;
  prompt: string;
  mode: GeneratorMode;
  target: GenerateTarget;
}

const TARGET_OPTIONS: Array<{
  value: GenerateTarget;
  label: string;
  hint: string;
}> = [
  { value: "full", label: "Full groove", hint: "Whole pattern" },
  { value: "drums", label: "Drums", hint: "Kick, snare, hats, perc" },
  { value: "bass", label: "Bass", hint: "Low-end movement" },
  { value: "melody", label: "Fills / melody", hint: "Tom, perc, ear candy" },
  { value: "arrangement", label: "Energy", hint: "Section contour" },
];

const SURPRISE_PACKS: Array<{
  label: string;
  prompt: string;
  target: GenerateTarget;
}> = [
  {
    label: "Neon tunnel",
    prompt:
      "Midnight city sprint — glossy synthwave drums, gated snare, pulsing bass, cool tension",
    target: "full",
  },
  {
    label: "Warehouse smoke",
    prompt:
      "Dark warehouse techno at 132 with relentless kick, hypnotic hats, and a menacing bass pulse",
    target: "full",
  },
  {
    label: "Basement tape",
    prompt:
      "Dusty late-90s basement beat with crunchy drums, lazy swing, and a bassline that feels half-asleep",
    target: "drums",
  },
  {
    label: "Sunrise lift",
    prompt:
      "An uplifting final-lap house groove that blooms brighter every bar without losing the pocket",
    target: "arrangement",
  },
  {
    label: "Alien low-end",
    prompt:
      "Design a strange sub-heavy bass pattern with tension, movement, and a few empty spaces to breathe",
    target: "bass",
  },
];

const HISTORY_STORAGE_KEY = "sts_generator_history_v1";
const PROFILE_STORAGE_KEY = "sts_generator_profiles_v1";
const MAX_HISTORY = 10;
const MAX_PROFILES = 6;
const OPEN_DRUMS_THRESHOLD_DIVISOR = 4;
const MIN_FILL_HITS = 3;
const POCKET_KICK_THRESHOLD = 4;
const LOW_SWING_THRESHOLD = 0.08;
const HISTORY_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function shortLabel(text: string, fallback: string) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return fallback;
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}…` : cleaned;
}

function extractProfileName(prompt: string, fallback: string) {
  const firstPhrase = prompt.split(/[—,:.]/)[0] || prompt;
  return shortLabel(firstPhrase, fallback);
}

function targetLabel(target: GenerateTarget) {
  return (
    TARGET_OPTIONS.find((option) => option.value === target)?.label ?? "Full groove"
  );
}

// Build a GeneratedBeat from the live engine state so refinements operate on
// whatever the user is currently hearing — including manual edits made after
// the last generation.
function snapshotCurrentBeat(): GeneratedBeat | null {
  const s = useEngineStore.getState();
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
  const tracks = useEngineStore((s) => s.tracks);
  const totalSteps = useEngineStore((s) => s.totalSteps);
  const songMode = useEngineStore((s) => s.songMode);
  const chainLength = useEngineStore((s) => s.chain.length);
  const swing = useEngineStore((s) => s.swing);

  const [mode, setMode] = useState<GeneratorMode>("create");
  const [target, setTarget] = useState<GenerateTarget>("full");
  const [description, setDescription] = useState("");
  const [refineDraft, setRefineDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    beat: GeneratedBeat;
    cached: boolean;
    refined: boolean;
    target: GenerateTarget;
    version: number;
  } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [profiles, setProfiles] = useState<CreativeProfile[]>([]);
  const [compareSlots, setCompareSlots] = useState<Record<CompareSlot, HistoryEntry | null>>({
    A: null,
    B: null,
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const refineInputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setHistory(safeRead<HistoryEntry[]>(HISTORY_STORAGE_KEY, []));
    setProfiles(safeRead<CreativeProfile[]>(PROFILE_STORAGE_KEY, []));
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      // Ignore storage quota or availability issues.
    }
  }, [history, profiles]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") inputRef.current?.focus();
    else refineInputRef.current?.focus();
  }, [open, mode]);

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
  }, [loading, open, setOpen]);

  const nextMoves = useMemo(() => {
    const kickHits = tracks[0]?.steps.filter((step) => step > 0).length ?? 0;
    const hatHits = tracks[2]?.steps.filter((step) => step > 0).length ?? 0;
    const bassHits = tracks[7]?.steps.filter((step) => step > 0).length ?? 0;
    const melodicHits =
      (tracks[5]?.steps.filter((step) => step > 0).length ?? 0) +
      (tracks[6]?.steps.filter((step) => step > 0).length ?? 0);

    const moves: Array<{
      label: string;
      prompt: string;
      target: GenerateTarget;
    }> = [];

    if (bassHits === 0) {
      moves.push({
        label: "Add bass motion",
        prompt:
          "Write a bassline that locks to the kick but leaves small pockets of silence.",
        target: "bass",
      });
    }
    if (hatHits < Math.ceil(totalSteps / OPEN_DRUMS_THRESHOLD_DIVISOR)) {
      moves.push({
        label: "Open the drums",
        prompt:
          "Add more hi-hat motion and ghost-note detail without making the groove feel busy.",
        target: "drums",
      });
    }
    if (melodicHits < MIN_FILL_HITS) {
      moves.push({
        label: "Add a fill",
        prompt:
          "Create a tasteful last-bar fill with tom or perc hits that sets up the loop restart.",
        target: "melody",
      });
    }
    if (!songMode || chainLength === 0) {
      moves.push({
        label: "Shape the energy",
        prompt:
          "Turn this groove into a stronger intro-to-drop energy contour while keeping the core rhythm recognizable.",
        target: "arrangement",
      });
    }
    if (kickHits >= POCKET_KICK_THRESHOLD && swing < LOW_SWING_THRESHOLD) {
      moves.push({
        label: "Loosen the pocket",
        prompt:
          "Keep the groove intact but make the drums feel slightly looser and more human.",
        target: "drums",
      });
    }
    if (moves.length === 0) {
      moves.push({
        label: "Push it darker",
        prompt:
          "Make the groove darker and more cinematic while keeping the best parts untouched.",
        target: "full",
      });
    }

    return moves.slice(0, 3);
  }, [chainLength, songMode, swing, totalSteps, tracks]);

  const applyHistoryEntry = useCallback(
    (entry: HistoryEntry) => {
      applyGeneratedBeat(entry.beat);
      setMode(entry.refined ? "refine" : "create");
      setTarget(entry.target);
      if (entry.refined) {
        setRefineDraft(entry.prompt);
      } else {
        setDescription(entry.prompt);
      }
      setError(null);
      setLastResult({
        beat: entry.beat,
        cached: false,
        refined: entry.refined,
        target: entry.target,
        version: entry.version,
      });
    },
    [applyGeneratedBeat],
  );

  const assignCompareSlot = useCallback((slot: CompareSlot, entry: HistoryEntry) => {
    setCompareSlots((current) => ({ ...current, [slot]: entry }));
  }, []);

  const loadIntoComposer = useCallback((entry: HistoryEntry) => {
    setMode(entry.refined ? "refine" : "create");
    setTarget(entry.target);
    if (entry.refined) {
      setRefineDraft(entry.prompt);
    } else {
      setDescription(entry.prompt);
    }
  }, []);

  const handleSaveProfile = useCallback(() => {
    const prompt = (mode === "create" ? description : refineDraft).trim();
    if (!prompt) return;
    setProfiles((current) =>
      [
        {
          id: createId(),
          name: extractProfileName(prompt, `Profile ${current.length + 1}`),
          prompt,
          mode,
          target,
        },
        ...current.filter(
          (item) =>
            !(
              item.prompt === prompt &&
              item.mode === mode &&
              item.target === target
            ),
        ),
      ].slice(0, MAX_PROFILES),
    );
  }, [description, mode, refineDraft, target]);

  const handleLoadProfile = useCallback((profile: CreativeProfile) => {
    setMode(profile.mode);
    setTarget(profile.target);
    if (profile.mode === "create") {
      setDescription(profile.prompt);
    } else {
      setRefineDraft(profile.prompt);
    }
  }, []);

  const handleGenerate = useCallback(
    async (opts: {
      prompt: string;
      refine: boolean;
      target: GenerateTarget;
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
        const body: Record<string, unknown> = {
          description: text,
          target: opts.target,
        };
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
        const version = (history[0]?.version ?? 0) + 1;
        const entry: HistoryEntry = {
          id: createId(),
          version,
          prompt: text,
          target: opts.target,
          refined: opts.refine,
          beat,
          createdAt: new Date().toISOString(),
        };

        applyGeneratedBeat(beat);
        const cached = (data.usage?.cache_read_input_tokens ?? 0) > 0;
        setHistory((current) => [entry, ...current].slice(0, MAX_HISTORY));
        setLastResult({
          beat,
          cached,
          refined: opts.refine,
          target: opts.target,
          version,
        });
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
    [applyGeneratedBeat, history],
  );

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      setMode("create");
      setTarget("full");
      setDescription(suggestion);
      handleGenerate({ prompt: suggestion, refine: false, target: "full" });
    },
    [handleGenerate],
  );

  const handleRefineChip = useCallback(
    (suggestion: string) => {
      setMode("refine");
      setRefineDraft(suggestion);
      handleGenerate({ prompt: suggestion, refine: true, target });
    },
    [handleGenerate, target],
  );

  const handleSurprise = useCallback(
    (pack?: (typeof SURPRISE_PACKS)[number]) => {
      const choice =
        pack ?? SURPRISE_PACKS[Math.floor(Math.random() * SURPRISE_PACKS.length)];
      setMode("create");
      setTarget(choice.target);
      setDescription(choice.prompt);
      handleGenerate({ prompt: choice.prompt, refine: false, target: choice.target });
    },
    [handleGenerate],
  );

  if (!open) return null;

  const currentPromptText = mode === "create" ? description : refineDraft;
  const latestHistoryEntry = history[0] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      onClick={() => !loading && setOpen(false)}
    >
      <div
        className="panel relative max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_10%_0%,rgba(155,92,255,0.18),transparent_18rem)]" />
        <div className="relative">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-cyan">
                Creative instrument
              </p>
              <h2 className="flex items-center gap-2 text-2xl font-black tracking-[-0.04em] text-white">
                <span className="text-accent">✦</span>
                {mode === "create" ? "Generate a groove" : "Mutate the current groove"}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {mode === "create"
                  ? "Turn prompts into grooves, keep versions, and compare bold directions without losing the pocket."
                  : "Refine the live pattern with scoped moves, next-step suggestions, and A/B auditioning."}
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.95fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.22em] text-muted">
                    Target the move
                  </div>
                  <button
                    onClick={() => handleSurprise()}
                    disabled={loading}
                    className="rounded-full bg-accent/15 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-accent hover:bg-accent hover:text-white disabled:opacity-40"
                  >
                    Surprise me
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {TARGET_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTarget(option.value)}
                      disabled={loading}
                      className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                        target === option.value
                          ? "border-accent/60 bg-accent/15 text-white"
                          : "border-white/8 bg-black/20 text-muted hover:border-white/15 hover:text-foreground"
                      }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.2em]">
                        {option.label}
                      </div>
                      <div className="mt-1 text-[11px] text-inherit/80">{option.hint}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SURPRISE_PACKS.map((pack) => (
                    <button
                      key={pack.label}
                      onClick={() => handleSurprise(pack)}
                      disabled={loading}
                      className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[10px] text-muted transition-colors hover:bg-white/[0.13] hover:text-foreground disabled:opacity-30"
                    >
                      {pack.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.22em] text-muted">
                    Creative profiles
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading || currentPromptText.trim().length === 0}
                    className="rounded-full bg-white/[0.06] px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-muted hover:bg-white/[0.12] hover:text-foreground disabled:opacity-30"
                  >
                    Save current
                  </button>
                </div>
                {profiles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center gap-1 rounded-full bg-white/[0.05] pr-1"
                      >
                        <button
                          onClick={() => handleLoadProfile(profile)}
                          className="rounded-full px-3 py-1.5 text-[10px] text-muted hover:text-foreground"
                        >
                          {profile.name}
                        </button>
                        <button
                          onClick={() =>
                            setProfiles((current) =>
                              current.filter((item) => item.id !== profile.id),
                            )
                          }
                          className="rounded-full px-1.5 py-1 text-[10px] text-muted hover:text-danger"
                          title={`Remove ${profile.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted/70">
                    Save prompt + target combinations you want to revisit fast.
                  </p>
                )}
              </div>

              {mode === "create" ? (
                <>
                  <div className="mb-3">
                    <div className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted">
                      Starting points
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleSuggestion(suggestion)}
                          disabled={loading}
                          className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[10px] text-muted transition-colors hover:bg-white/[0.13] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    ref={inputRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    aria-describedby="generator-create-help"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleGenerate({ prompt: description, refine: false, target });
                      }
                    }}
                    maxLength={500}
                    rows={4}
                    placeholder="e.g. dusty boom-bap at 92 with ghost-note snare and a deep bass walking through Dm..."
                    disabled={loading}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none disabled:opacity-50"
                  />
                  <div id="generator-create-help" className="mt-1 mb-3 flex justify-between">
                    <span className="text-[10px] text-muted/70">
                      {description.length}/500 · Cmd/Ctrl+Enter to generate · target {targetLabel(target).toLowerCase()}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <div className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted">
                      Creative moves
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {REFINE_CHIPS.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleRefineChip(suggestion)}
                          disabled={loading}
                          className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[10px] text-muted transition-colors hover:bg-white/[0.13] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    ref={refineInputRef}
                    value={refineDraft}
                    onChange={(e) => setRefineDraft(e.target.value)}
                    aria-describedby="generator-refine-help"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleGenerate({ prompt: refineDraft, refine: true, target });
                      }
                    }}
                    maxLength={500}
                    rows={3}
                    placeholder="e.g. drop the open hat, add a tom fill on steps 13-16, raise kick velocity"
                    disabled={loading}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none disabled:opacity-50"
                  />
                  <div id="generator-refine-help" className="mt-1 mb-3 flex justify-between">
                    <span className="text-[10px] text-muted/70">
                      {refineDraft.length}/500 · Cmd/Ctrl+Enter to mutate · target {targetLabel(target).toLowerCase()}
                    </span>
                  </div>
                </>
              )}

              <div className="rounded-2xl border border-cyan/15 bg-cyan/5 p-3">
                <div className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-cyan">
                  Next moves from this groove
                </div>
                <div className="flex flex-wrap gap-2">
                  {nextMoves.map((move) => (
                    <button
                      key={move.label}
                      onClick={() => {
                        setMode("refine");
                        setTarget(move.target);
                        setRefineDraft(move.prompt);
                      }}
                      className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[10px] text-muted transition-colors hover:bg-white/[0.13] hover:text-foreground"
                    >
                      {move.label}
                    </button>
                  ))}
                </div>
              </div>

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
                        target,
                      })
                    }
                    disabled={loading || currentPromptText.trim().length === 0}
                    className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.18em] transition-colors ${
                      loading
                        ? "cursor-wait bg-accent/40 text-white/60"
                        : "bg-accent text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-muted/50"
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

              {error && (
                <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs whitespace-pre-wrap text-danger">
                  {error}
                </div>
              )}

              {lastResult && !error && (
                <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-accent">
                      {lastResult.refined ? "✦ Mutated:" : "✓ Applied:"} v{lastResult.version} · {lastResult.beat.name}
                    </span>
                    <span className="text-[9px] font-mono text-muted">
                      {lastResult.beat.bpm} BPM · {lastResult.beat.totalSteps} steps
                      {lastResult.beat.swing > 0
                        ? ` · ${Math.round(lastResult.beat.swing * 100)}% swing`
                        : ""}
                      {` · ${targetLabel(lastResult.target)}`}
                      {lastResult.cached ? " · ⚡ cached" : ""}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted">
                    {lastResult.beat.explanation}
                  </p>
                  {latestHistoryEntry && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["A", "B"] as CompareSlot[]).map((slot) => (
                        <button
                          key={slot}
                          onClick={() => assignCompareSlot(slot, latestHistoryEntry)}
                          className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted hover:bg-white/[0.14] hover:text-foreground"
                        >
                          Pin to {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {(compareSlots.A || compareSlots.B) && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-muted">
                      A/B compare
                    </div>
                    {compareSlots.A && compareSlots.B && (
                      <div className="text-[10px] text-muted/70">
                        {compareSlots.A.beat.name} ↔ {compareSlots.B.beat.name}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                    {(["A", "B"] as CompareSlot[]).map((slot) => {
                      const entry = compareSlots[slot];
                      return (
                        <div
                          key={slot}
                          className="rounded-2xl border border-white/8 bg-black/20 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">
                              Slot {slot}
                            </span>
                            {entry && (
                              <button
                                onClick={() =>
                                  setCompareSlots((current) => ({ ...current, [slot]: null }))
                                }
                                className="text-[10px] text-muted hover:text-danger"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          {entry ? (
                            <>
                              <div className="text-sm font-bold text-white">
                                v{entry.version} · {entry.beat.name}
                              </div>
                              <div className="mt-1 text-[10px] text-muted/80">
                                {targetLabel(entry.target)} · {entry.beat.bpm} BPM · {entry.beat.totalSteps} steps
                              </div>
                              <p className="mt-2 text-[11px] leading-relaxed text-muted/80">
                                {shortLabel(entry.prompt, "Untitled move")}
                              </p>
                              <button
                                onClick={() => applyHistoryEntry(entry)}
                                className="mt-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-black hover:bg-accent-hover hover:text-white"
                              >
                                Apply {slot}
                              </button>
                            </>
                          ) : (
                            <p className="text-[11px] text-muted/70">
                              Pin a history version here to audition alternate directions.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {history.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-muted">
                      Prompt history
                    </div>
                    <span className="text-[10px] text-muted/70">
                      {history.length} saved direction{history.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-white/8 bg-black/20 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white">
                              v{entry.version} · {entry.beat.name}
                            </div>
                            <div className="mt-1 text-[10px] text-muted/80">
                              {entry.refined ? "Mutate" : "Generate"} · {targetLabel(entry.target)} · {HISTORY_TIME_FORMATTER.format(new Date(entry.createdAt))}
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed text-muted/80">
                              {entry.prompt}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            <button
                              onClick={() => applyHistoryEntry(entry)}
                              className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted hover:bg-white/[0.14] hover:text-foreground"
                            >
                              Apply
                            </button>
                            <button
                              onClick={() => loadIntoComposer(entry)}
                              className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted hover:bg-white/[0.14] hover:text-foreground"
                            >
                              Load
                            </button>
                            {(["A", "B"] as CompareSlot[]).map((slot) => (
                              <button
                                key={slot}
                                onClick={() => assignCompareSlot(slot, entry)}
                                className="rounded-full bg-white/[0.08] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted hover:bg-white/[0.14] hover:text-foreground"
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
