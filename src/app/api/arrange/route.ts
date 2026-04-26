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

// ── Route ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 503 });
  }

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

    return NextResponse.json({
      ...(toolUse.input as ArrangeResult),
      usage: {
        input_tokens:                response.usage.input_tokens,
        output_tokens:               response.usage.output_tokens,
        cache_read_input_tokens:     response.usage.cache_read_input_tokens   ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Invalid ANTHROPIC_API_KEY." }, { status: 401 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited. Wait a moment." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Anthropic API error: ${error.message}` }, { status: error.status ?? 502 });
    }
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
