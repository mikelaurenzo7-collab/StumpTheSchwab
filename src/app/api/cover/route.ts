import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a creative music producer for StumpTheSchwab, building a remix-ready cover of a reference track. You receive a SongDescriptor (BPM, key, sections with energies, 6-zone spectral RMS, dynamic envelope) and must call cover_song to return:
- BPM, swing, totalSteps
- A kit pack (boombap | lofi | trap | synthwave | dnb | house) matching the original's vibe
- 8 patterns covering: intro, verse, build, drop, break, fill, outro, bonus
- A playback chain (8–12 entries)
- Optional sample picks: 1–2 bars from the original to load as samples

KIT — every pattern uses the same 8 voices in slot order:
  0 kick (MembraneSynth, C1)
  1 snare (NoiseSynth)
  2 hihat (MetalSynth)
  3 openhat (MetalSynth)
  4 clap (NoiseSynth)
  5 tom (MembraneSynth, melodic C1–C3)
  6 perc (FMSynth, melodic C4–C6)
  7 bass (MonoSynth, melodic C1–C4)

PATTERN SCHEMA — same as create_beat:
  Each pattern has: name (≤16 chars), tracks{kick..bass: number[totalSteps]},
  melodicNotes{tom,perc,bass: string[totalSteps]}, role, explanation.
  Velocity values: 0, 0.25, 0.5, 0.75, 1.0. ALL arrays must be exactly totalSteps long.

KEY-AWARE NOTE PICKING:
  Use the descriptor's estimatedKey (tonic + mode) for melodic tracks (tom/perc/bass).
  Major key bass: tonic, fifth above (P5), and major third (M3) variations.
  Minor key bass: tonic, fifth above, minor third (m3).
  Perc accents: octave-up of bass notes for clarity, or scale tones for ear candy.

KIT PACK CHOICE:
  - <90 BPM, sub-heavy, low presence  → "lofi" or "boombap"
  - 90-110 BPM, balanced, jazzy       → "boombap"
  - 110-128 BPM, presence-bright, dance → "house" or "synthwave"
  - 128-145 BPM, sub-heavy, sparse    → "trap"
  - 145-180 BPM, busy hats, syncopated → "dnb"
  - >180 BPM                            → "dnb"

GENRE BPM (set bpm to nearest integer, snap to genre conventions if estimate is off by ≤3):
  lofi 70-90, boombap 85-100, house 118-128, trap 130-150, dnb 160-180, synthwave 100-120.

SECTION → ROLE MAPPING:
  Map detected sections to roles in this order: intro → verse → build → drop → break → fill → outro → bonus.
  If fewer than 8 detected, repeat verse/drop. If more than 8, prioritise the highest-energy ones.

PATTERN DESIGN BY ROLE:
  intro    — sparse, no kick or kick on 1 only. Establish key with bass and perc.
  verse    — moderate density. Kick on 1+3, snare on 2+4 (or genre variant). Melodic perc.
  build    — rising energy. Add hi-hat density, raise velocities, less open space.
  drop     — peak. Full kick, full snare, busy bass, accent claps. Heaviest pattern.
  break    — strip back. Often kick-out for first 8 steps; layer perc/snare ghosts.
  fill     — last 4–8 steps are tom/snare rolls; otherwise mirrors the verse.
  outro    — fade-out energy. Sparse like intro, but in the drop's key.
  bonus    — variant: e.g. half-time of drop, or syncopated alt-verse.

SAMPLE PICKS (optional but encouraged):
  Suggest 1–2 entries from the bar_slices list (sorted by RMS). Pick the most distinctive bars
  (often the ones with peak RMS). Load onto track 5 (tom) or 6 (perc) so the sample plays as a
  sequenced layer. Don't load on kick/snare/bass — those should be the synth voice.

CHAIN — return 8–12 entries using slot indices 0–7. A common shape:
  [0,1,1,2,3,3,1,4,3,5,6,7]   intro, verse×2, build, drop×2, verse, break, drop, fill, outro, bonus

BE MUSICAL. The user just dropped in a song they want to remix — match its character closely.`;

// ── Tool ────────────────────────────────────────────────────────────────────────

const SECTION_ROLES = ["intro","verse","build","drop","break","fill","outro","bonus"] as const;
const KIT_PACKS = ["boombap","lofi","trap","synthwave","dnb","house"] as const;

const coverSongTool: Anthropic.Tool = {
  name: "cover_song",
  description: "Return a complete 8-section cover arrangement (StumpTheSchwab voices) of the reference song descriptor.",
  input_schema: {
    type: "object",
    properties: {
      bpm: { type: "integer", minimum: 40, maximum: 240 },
      swing: { type: "number", minimum: 0, maximum: 0.6 },
      totalSteps: { type: "integer", enum: [16, 32] },
      kit_pack: { type: "string", enum: [...KIT_PACKS] },
      patterns: {
        type: "array",
        minItems: 8,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            role: { type: "string", enum: [...SECTION_ROLES] },
            name: { type: "string", description: "Short pattern name ≤16 chars." },
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
            explanation: { type: "string" },
          },
          required: ["role","name","tracks","melodicNotes","explanation"],
        },
      },
      chain: {
        type: "array",
        items: { type: "integer", minimum: 0, maximum: 7 },
        minItems: 4,
        maxItems: 16,
      },
      sample_picks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slot: { type: "integer", minimum: 0, maximum: 7 },
            bar_indices: { type: "array", items: { type: "integer" } },
          },
          required: ["slot","bar_indices"],
        },
      },
      explanation: { type: "string" },
    },
    required: ["bpm","swing","totalSteps","kit_pack","patterns","chain","explanation"],
  },
};

// ── Types ───────────────────────────────────────────────────────────────────────

interface CoverPattern {
  role: typeof SECTION_ROLES[number];
  name: string;
  tracks: Record<"kick"|"snare"|"hihat"|"openhat"|"clap"|"tom"|"perc"|"bass", number[]>;
  melodicNotes: Record<"tom"|"perc"|"bass", string[]>;
  explanation: string;
}

export interface CoverResult {
  bpm: number;
  swing: number;
  totalSteps: 16 | 32;
  kit_pack: typeof KIT_PACKS[number];
  patterns: CoverPattern[];
  chain: number[];
  sample_picks?: Array<{ slot: number; bar_indices: number[] }>;
  explanation: string;
}

function isCoverResult(v: unknown): v is CoverResult {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.bpm === "number" &&
    typeof o.totalSteps === "number" &&
    typeof o.kit_pack === "string" &&
    Array.isArray(o.patterns) && o.patterns.length === 8 &&
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
  const descriptor = typeof b.descriptor === "string" ? b.descriptor : "";
  const barSliceMeta = typeof b.barSlices === "string" ? b.barSlices : "[]";
  const direction = typeof b.direction === "string" ? b.direction : "";

  if (!descriptor) {
    return NextResponse.json({ error: "Song descriptor is required." }, { status: 400 });
  }

  const userPrompt = `SONG DESCRIPTOR:\n\`\`\`json\n${descriptor}\n\`\`\`\n\nBAR SLICES (sorted by RMS — pick the most distinctive for sample_picks):\n\`\`\`json\n${barSliceMeta}\n\`\`\`\n${direction ? `\nUser direction: ${direction}\n` : ""}\nBuild the cover arrangement.`;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8192,
      // Anthropic forbids `thinking` with a forced `tool_choice: { type: "tool" }`.
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [coverSongTool],
      tool_choice: { type: "tool", name: "cover_song" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolUse || !isCoverResult(toolUse.input)) {
      return NextResponse.json({ error: "Model did not return a cover." }, { status: 502 });
    }

    return NextResponse.json({
      ...(toolUse.input as CoverResult),
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
