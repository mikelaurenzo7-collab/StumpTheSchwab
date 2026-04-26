import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert arranger and producer for StumpTheSchwab. Given a single seed pattern (pattern A) and a section role list, return seven derivative patterns that together form a complete song arrangement (intro → verse → build → drop → break → fill → outro). Call the arrange_song tool exactly once.

KIT — every pattern uses the same 8 voices in slot order:
  0 kick (MembraneSynth, C1)
  1 snare (NoiseSynth)
  2 hihat (MetalSynth)
  3 openhat (MetalSynth)
  4 clap (NoiseSynth)
  5 tom (MembraneSynth, melodic C1–C3)
  6 perc (FMSynth, melodic C4–C6)
  7 bass (MonoSynth, melodic C1–C4)

PATTERN SCHEMA — each pattern is the same as the create_beat schema:
  name (≤16 chars), tracks{kick..bass: number[]}, melodicNotes{tom,perc,bass: string[]}, explanation
  Velocity values: 0, 0.25, 0.5, 0.75, 1.0. Each velocity array MUST be exactly totalSteps long.

ROLE GUIDANCE:
  intro     — sparse, atmospheric. Often half-density of pattern A; remove kick or simplify it. Establish key/mood.
  verse     — close to A, slight variation. Vibe: A's groove minus 1–2 ear-candy hits, slight perc movement.
  build     — rising tension. Add hi-hat density, raise snare/clap, introduce risers (use perc track high). Keep kick steady, less low-end variation.
  drop      — peak energy. Heaviest version of A. Add bass density, full kick, accent open hats. This is the loudest section.
  break     — strip back. Often kick out for 2–4 bars, leaving snare/hat/melody. Re-introduce kick on the last bar.
  fill      — final 2–4 steps are tom/snare rolls; otherwise mirrors A. Use as a transition fill.
  outro     — fade-out energy. Sparse like intro, but with the harmonic content of the drop. Tail off the bass.

CONSTRAINTS:
  - All seven patterns MUST share the same totalSteps as the seed (passed in the user message). Do not change BPM/swing/key.
  - All patterns share the same key as A. Bass note set: stay within the seed's key/scale unless the role demands movement.
  - Velocity arrays MUST be exactly totalSteps long. Melodic note arrays MUST be exactly totalSteps long.
  - Names should be short and evocative ("Intro", "Drop", "Break", "Fill", or stylistic variants like "Heaven", "Crash", "Float").

CHAIN — return a chain array (pattern slot indices in playback order) that uses A and the new patterns musically. A typical 16-bar arrangement:
  [0, 1, 1, 2, 3, 3, 1, 4, 3, 5, 6]    ← A intro, A verse x2, build, drop, drop, verse, break, drop, fill, outro
  Or simpler [0, 1, 2, 3, 4, 5, 6, 7]   ← straight A→B→C→…→H walkthrough.
  Use slot indices 0 (=A=seed) through 7 (the last new pattern). Aim for 8–12 chain entries.`;

// ── Tool ────────────────────────────────────────────────────────────────────────

const SECTION_ROLES = ["intro","verse","build","drop","break","fill","outro"] as const;
const TRACK_KEYS = ["kick","snare","hihat","openhat","clap","tom","perc","bass"] as const;
const MELODIC_KEYS = ["tom","perc","bass"] as const;
const BEATS_PER_BAR = 4;
const PATTERN_NAME_MAX_LENGTH = 16;
const MAX_CHAIN_LENGTH = 16;
// Claude/local arranger chain IDs use 0 for the seed pattern and 1..7 for arranged sections.
const ARRANGE_CHAIN_SLOT_COUNT = SECTION_ROLES.length + 1;
const BUILD_HIHAT_DOWNBEAT_VELOCITY = 0.5;
const BUILD_HIHAT_OFFBEAT_VELOCITY = 0.25;

const arrangeSongTool: Anthropic.Tool = {
  name: "arrange_song",
  description: "Return a complete 7-section song arrangement built from the seed pattern A.",
  input_schema: {
    type: "object",
    properties: {
      patterns: {
        type: "array",
        description: "Seven pattern variants in section order: intro, verse, build, drop, break, fill, outro.",
        minItems: 7,
        maxItems: 7,
        items: {
          type: "object",
          properties: {
            role: { type: "string", enum: [...SECTION_ROLES] },
            name: { type: "string", description: "Short name ≤16 chars." },
            tracks: {
              type: "object",
              properties: {
                kick:    { type: "array", items: { type: "number" } },
                snare:   { type: "array", items: { type: "number" } },
                hihat:   { type: "array", items: { type: "number" } },
                openhat: { type: "array", items: { type: "number" } },
                clap:    { type: "array", items: { type: "number" } },
                tom:     { type: "array", items: { type: "number" } },
                perc:    { type: "array", items: { type: "number" } },
                bass:    { type: "array", items: { type: "number" } },
              },
              required: ["kick","snare","hihat","openhat","clap","tom","perc","bass"],
            },
            melodicNotes: {
              type: "object",
              properties: {
                tom:  { type: "array", items: { type: "string" } },
                perc: { type: "array", items: { type: "string" } },
                bass: { type: "array", items: { type: "string" } },
              },
              required: ["tom","perc","bass"],
            },
            explanation: { type: "string", description: "1 sentence on this section's role." },
          },
          required: ["role","name","tracks","melodicNotes","explanation"],
        },
      },
      chain: {
        type: "array",
        description: "Pattern slot indices (0=seed A, 1..7 = the seven new patterns) in playback order. 8–12 entries.",
        items: { type: "integer", minimum: 0, maximum: 7 },
        minItems: 4,
        maxItems: 16,
      },
      explanation: {
        type: "string",
        description: "1–2 sentences on the overall arrangement: how energy moves and what the chain narrates.",
      },
    },
    required: ["patterns","chain","explanation"],
  },
};

// ── Types ───────────────────────────────────────────────────────────────────────

interface ArrangedPattern {
  role: typeof SECTION_ROLES[number];
  name: string;
  tracks: Record<"kick"|"snare"|"hihat"|"openhat"|"clap"|"tom"|"perc"|"bass", number[]>;
  melodicNotes: Record<"tom"|"perc"|"bass", string[]>;
  explanation: string;
}

export interface ArrangeResult {
  patterns: ArrangedPattern[];
  chain: number[];
  explanation: string;
}

function isArrangeResult(v: unknown): v is ArrangeResult {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    Array.isArray(o.patterns) &&
    o.patterns.length === 7 &&
    Array.isArray(o.chain) &&
    typeof o.explanation === "string"
  );
}

type TrackKey = typeof TRACK_KEYS[number];
type MelodicKey = typeof MELODIC_KEYS[number];

interface SeedBeat {
  name?: string;
  tracks: Record<TrackKey, number[]>;
  melodicNotes: Record<MelodicKey, string[]>;
}

function clampVelocity(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(1, n));
}

function resize<T>(src: T[] | undefined, length: number, fill: T): T[] {
  return Array.from({ length }, (_, i) => (src?.[i] !== undefined ? src[i] : fill));
}

function parseSeed(seedJson: string, totalSteps: number): SeedBeat | null {
  try {
    const raw = JSON.parse(seedJson) as Record<string, unknown>;
    const tracksRaw = raw.tracks as Partial<Record<TrackKey, unknown[]>> | undefined;
    const notesRaw = raw.melodicNotes as Partial<Record<MelodicKey, unknown[]>> | undefined;
    if (!tracksRaw || typeof tracksRaw !== "object") return null;

    const tracks = Object.fromEntries(
      TRACK_KEYS.map((key) => [
        key,
        resize(tracksRaw[key], totalSteps, 0).map(clampVelocity),
      ]),
    ) as Record<TrackKey, number[]>;
    const melodicNotes = Object.fromEntries(
      MELODIC_KEYS.map((key) => [
        key,
        resize(notesRaw?.[key], totalSteps, "").map((note) =>
          typeof note === "string" ? note : "",
        ),
      ]),
    ) as Record<MelodicKey, string[]>;

    return {
      name: typeof raw.name === "string" ? raw.name : undefined,
      tracks,
      melodicNotes,
    };
  } catch {
    return null;
  }
}

function quantizeVelocity(v: number): number {
  if (v <= 0) return 0;
  if (v < 0.375) return 0.25;
  if (v < 0.625) return 0.5;
  if (v < 0.875) return 0.75;
  return 1;
}

function scaleTrack(track: number[], factor: number, every = 1): number[] {
  return track.map((v, i) => {
    if (v <= 0 || i % every !== 0) return 0;
    return quantizeVelocity(v * factor);
  });
}

function accent(track: number[], positions: number[], velocity = 0.75): number[] {
  const next = [...track];
  positions.forEach((pos) => {
    const idx = ((pos % next.length) + next.length) % next.length;
    next[idx] = Math.max(next[idx], velocity);
  });
  return next;
}

function buildFallbackArrangement(seed: SeedBeat, totalSteps: number): ArrangeResult {
  const downbeats = Array.from(
    { length: Math.max(1, Math.floor(totalSteps / BEATS_PER_BAR)) },
    (_, i) => i * BEATS_PER_BAR,
  );
  const backbeats = [
    Math.floor(totalSteps / BEATS_PER_BAR),
    Math.floor((totalSteps * 3) / BEATS_PER_BAR),
  ];
  const lastBar = Array.from(
    { length: Math.min(BEATS_PER_BAR, totalSteps) },
    (_, i) => totalSteps - 1 - i,
  );

  const make = (
    role: ArrangedPattern["role"],
    name: string,
    mutate: (tracks: SeedBeat["tracks"]) => SeedBeat["tracks"],
    explanation: string,
  ): ArrangedPattern => ({
    role,
    name,
    tracks: mutate(seed.tracks),
    melodicNotes: {
      tom: [...seed.melodicNotes.tom],
      perc: [...seed.melodicNotes.perc],
      bass: [...seed.melodicNotes.bass],
    },
    explanation,
  });

  const patterns: ArrangedPattern[] = [
    make("intro", "Intro", (t) => ({
      ...t,
      kick: scaleTrack(t.kick, 0.5, 2),
      snare: scaleTrack(t.snare, 0.5, 2),
      hihat: scaleTrack(t.hihat, 0.45, 2),
      openhat: scaleTrack(t.openhat, 0.4, 2),
      bass: scaleTrack(t.bass, 0.45, 2),
    }), "Sparse opener that keeps the seed's identity while leaving space."),
    make("verse", "Verse", (t) => ({
      ...t,
      openhat: scaleTrack(t.openhat, 0.6, 2),
      perc: scaleTrack(t.perc, 0.7, 2),
    }), "Close seed variation for the main groove."),
    make("build", "Build", (t) => ({
      ...t,
      kick: accent(t.kick, downbeats, 0.85),
      snare: accent(t.snare, backbeats, 0.9),
      hihat: t.hihat.map((v, i) =>
        quantizeVelocity(Math.max(v, i % 2 === 0 ? BUILD_HIHAT_DOWNBEAT_VELOCITY : BUILD_HIHAT_OFFBEAT_VELOCITY))
      ),
      perc: accent(t.perc, lastBar, 0.75),
    }), "Adds hat motion and end-bar tension before the drop."),
    make("drop", "Drop", (t) => ({
      ...t,
      kick: accent(t.kick, downbeats, 1),
      snare: accent(t.snare, backbeats, 1),
      clap: accent(t.clap, backbeats, 0.85),
      openhat: accent(t.openhat, downbeats.map((d) => d + 2), 0.75),
      bass: accent(t.bass, downbeats, 0.9),
    }), "Peak-energy section with reinforced drums and bass."),
    make("break", "Break", (t) => ({
      ...t,
      kick: scaleTrack(t.kick, 0.4, 4),
      bass: scaleTrack(t.bass, 0.5, 2),
      hihat: scaleTrack(t.hihat, 0.6, 2),
      perc: accent(scaleTrack(t.perc, 0.7, 2), [totalSteps - 2], 0.7),
    }), "Stripped break that breathes before the groove returns."),
    make("fill", "Fill", (t) => ({
      ...t,
      snare: accent(t.snare, lastBar, 0.75),
      tom: accent(t.tom, lastBar, 0.8),
      perc: accent(t.perc, lastBar, 0.7),
    }), "Transition fill with last-bar movement."),
    make("outro", "Outro", (t) => ({
      ...t,
      kick: scaleTrack(t.kick, 0.45, 2),
      snare: scaleTrack(t.snare, 0.45, 2),
      hihat: scaleTrack(t.hihat, 0.35, 2),
      openhat: scaleTrack(t.openhat, 0.35, 4),
      bass: scaleTrack(t.bass, 0.35, 4),
    }), "Low-density ending that tails the arrangement off cleanly."),
  ];

  return {
    patterns,
    // Seed → verse x2 → build → drop x2 → break → drop → fill → outro.
    chain: [0, 1, 1, 2, 3, 3, 4, 3, 5, 6, 7],
    explanation: "Local arranger built a complete intro-to-outro chain from the seed pattern, with energy rising into the drop and resolving through fill and outro.",
  };
}

function normalizeArrangeResult(input: ArrangeResult, totalSteps: number): ArrangeResult {
  return {
    patterns: input.patterns.slice(0, SECTION_ROLES.length).map((pattern, index) => ({
      role: SECTION_ROLES.includes(pattern.role) ? pattern.role : SECTION_ROLES[index],
      name: (pattern.name || SECTION_ROLES[index]).slice(0, PATTERN_NAME_MAX_LENGTH),
      tracks: Object.fromEntries(
        TRACK_KEYS.map((key) => [
          key,
          resize(pattern.tracks?.[key], totalSteps, 0).map(clampVelocity),
        ]),
      ) as ArrangedPattern["tracks"],
      melodicNotes: Object.fromEntries(
        MELODIC_KEYS.map((key) => [
          key,
          resize(pattern.melodicNotes?.[key], totalSteps, "").map((note) =>
            typeof note === "string" ? note : "",
          ),
        ]),
      ) as ArrangedPattern["melodicNotes"],
      explanation: pattern.explanation || `${SECTION_ROLES[index]} variation.`,
    })),
    chain: input.chain
      .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < ARRANGE_CHAIN_SLOT_COUNT)
      .slice(0, MAX_CHAIN_LENGTH),
    explanation: input.explanation || "Arrangement generated.",
  };
}

// ── Route ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be an object." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const seedJson    = typeof b.seed        === "string"  ? b.seed        : "";
  const totalSteps  = typeof b.totalSteps  === "number"  ? b.totalSteps  : 16;
  const bpm         = typeof b.bpm         === "number"  ? b.bpm         : 120;
  const description = typeof b.description === "string"  ? b.description : "";

  if (!seedJson) {
    return NextResponse.json({ error: "Seed beat (pattern A) is required." }, { status: 400 });
  }
  const seed = parseSeed(seedJson, totalSteps);
  if (!seed) {
    return NextResponse.json({ error: "Seed beat could not be parsed." }, { status: 400 });
  }

  const fallback = buildFallbackArrangement(seed, totalSteps);
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warning: "ANTHROPIC_API_KEY is not set, so a local arrangement was generated.",
    });
  }

  const client = new Anthropic();

  const userPrompt = `SEED (pattern A):\n\`\`\`json\n${seedJson}\n\`\`\`\n\nBPM: ${bpm}\nTotalSteps per pattern: ${totalSteps}\n${description ? `\nUser direction: ${description}\n` : ""}\nGenerate the seven derivative patterns and a playback chain.`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [arrangeSongTool],
      tool_choice: { type: "tool", name: "arrange_song" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolUse || !isArrangeResult(toolUse.input)) {
      return NextResponse.json({ error: "Model did not return an arrangement." }, { status: 502 });
    }

    const normalized = normalizeArrangeResult(toolUse.input as ArrangeResult, totalSteps);
    if (normalized.patterns.length !== 7 || normalized.chain.length === 0) {
      return NextResponse.json({ ...fallback, fallback: true });
    }

    return NextResponse.json({
      ...normalized,
      usage: {
        input_tokens:                response.usage.input_tokens,
        output_tokens:               response.usage.output_tokens,
        cache_read_input_tokens:     response.usage.cache_read_input_tokens   ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (error) {
    const warning =
      error instanceof Anthropic.APIError
        ? `Anthropic API error: ${error.message}`
        : "Unexpected server error.";
    return NextResponse.json({ ...fallback, fallback: true, warning });
  }
}
