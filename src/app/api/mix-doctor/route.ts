import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Mix-Doctor system prompt ──────────────────────────────────────────────────
// Teaches Claude the kit layout, effect ranges, and mixing conventions so its
// patch suggestions land in the right parameter space.
const SYSTEM_PROMPT = `You are an expert mixing engineer for StumpTheSchwab, a web-based step sequencer / DAW. Your job is to analyze a mix snapshot and return actionable patch suggestions by calling the analyze_mix tool.

TRACK LAYOUT (indexed 0–7, matching slot order):
  0  Kick     — sub/low punch, drives the rhythm
  1  Snare    — backbeat at 2 and 4
  2  Hi-Hat   — rhythmic texture, high frequencies
  3  Open Hat — longer shimmer, use sparingly
  4  Clap     — layered with snare for fatness
  5  Tom      — fills, melodic accent
  6  Perc     — FM ear candy, bright
  7  Bass     — low-frequency melodic content; must not fight the kick

PARAMETER RANGES — only suggest values within these bounds:
  volume            0.0–1.0  (0 = silence, 1 = full)
  pan               -1.0–1.0 (−1 = hard left, 0 = center, 1 = hard right)
  filterFreq        20–20000 Hz
  filterQ           0.1–18
  driveAmount       0.0–1.0
  delayTime         0.05–1.0 s
  delayFeedback     0.0–0.95
  delayWet          0.0–1.0
  reverbDecay       0.2–10.0 s
  reverbWet         0.0–1.0
  sidechainDepth    0.0–1.0
  sidechainRelease  0.01–1.0 s
  master.volume     0.0–1.0
  master.eqLow      -24–+24 dB
  master.eqMid      -24–+24 dB
  master.eqHigh     -24–+24 dB
  master.compressorThreshold  -60–0 dB
  master.compressorRatio      1–20
  master.limiterThreshold     -30–0 dB
  master.tapeAmount           0.0–1.0
  master.width                0.0–1.0

FREQUENCY ZONES (for reference when reading spectrum energy):
  sub     20–60 Hz    kick fundamentals, 808s — cut everything else here
  bass    60–250 Hz   body of kick, weight of bass — kings of the mix
  lo-mid  250–500 Hz  mud zone — small cut at ~300 Hz often clears a mix
  mid     500–2000 Hz leads, vocals, snare body
  presence 2000–6000 Hz bite of snare, attack of synths — boost for clarity
  air     6000–20000 Hz cymbals, breathiness, sparkle

MIXING RULES:
- Only suggest changes with clear musical reason. Never add "should do X" without explaining why.
- Kick and bass must NOT share the same volume/frequency space — one must yield. Classic fix: high-pass bass above 80 Hz, sidechain bass to kick.
- Mud (250–500 Hz buildup) is the most common problem in crowded mixes. A -2 dB notch at 300 Hz on the bass or lo-mid-heavy tracks often solves it.
- Category "praise" is for things that already sound great — include at least one if the mix is strong.
- Never suggest more than 6 patches per suggestion (batching keeps undo history clean).
- Never suggest a reverb on kick. Never suggest hard-pan (> 0.8) on kick or bass.
- If LUFS is above the target, suggest master volume or compressor threshold reduction — not just "turn everything down."
- If the mix has no problems, say so clearly in one praise suggestion. Don't invent issues.

URGENCY definitions:
  critical    — audible problem that will hurt the mix on any system (clipping, muddy low end, masked kick)
  recommended — clear improvement the producer will appreciate
  optional    — subtle polish; the mix works fine without it`;

// ── Tool schema ───────────────────────────────────────────────────────────────
const analyzeMixTool: Anthropic.Tool = {
  name: "analyze_mix",
  description:
    "Return a ranked list of mix suggestions with concrete parameter patches.",
  input_schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        description: "Ordered list of mix suggestions, most urgent first.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short label (≤32 chars)" },
            explanation: {
              type: "string",
              description: "1–2 sentence explanation of why this change improves the mix.",
            },
            category: {
              type: "string",
              enum: ["eq", "volume", "fx", "master", "arrangement", "praise"],
            },
            urgency: {
              type: "string",
              enum: ["critical", "recommended", "optional"],
            },
            patches: {
              type: "array",
              description: "Concrete parameter changes (max 6 per suggestion).",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["trackEffect", "trackVolume", "trackPan", "master"],
                  },
                  trackId: {
                    type: "integer",
                    description: "0-indexed track id (omit for type=master)",
                  },
                  key: {
                    type: "string",
                    description:
                      "Parameter key (e.g. 'volume', 'filterFreq', 'reverbWet', 'eqLow')",
                  },
                  value: {
                    description: "New parameter value",
                  },
                  enable: {
                    type: "string",
                    description:
                      "Optional: FX toggle key to enable alongside (e.g. 'filterOn', 'reverbOn')",
                  },
                },
                required: ["type", "key", "value"],
              },
            },
          },
          required: ["title", "explanation", "category", "urgency", "patches"],
        },
      },
    },
    required: ["suggestions"],
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MixPatch {
  type: "trackEffect" | "trackVolume" | "trackPan" | "master";
  trackId?: number;
  key: string;
  value: number | boolean | string;
  enable?: string;
}

export interface MixSuggestion {
  title: string;
  explanation: string;
  category: "eq" | "volume" | "fx" | "master" | "arrangement" | "praise";
  urgency: "critical" | "recommended" | "optional";
  patches: MixPatch[];
}

interface AnalyzeMixResult {
  suggestions: MixSuggestion[];
}

function isAnalyzeMixResult(v: unknown): v is AnalyzeMixResult {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.suggestions);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("snapshot" in body)) {
    return NextResponse.json(
      { error: "Request must include a 'snapshot' field." },
      { status: 400 },
    );
  }

  const snapshot = (body as { snapshot: unknown }).snapshot;
  const rawSpectrumImage = (body as Record<string, unknown>).spectrumImage;
  const spectrumImage = typeof rawSpectrumImage === "string" ? rawSpectrumImage : null;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      // Anthropic forbids `thinking` with a forced `tool_choice: { type: "tool" }`.
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [analyzeMixTool],
      tool_choice: { type: "tool", name: "analyze_mix" },
      messages: [
        {
          role: "user",
          content: spectrumImage
            ? [
                {
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const,
                    data: spectrumImage.replace(/^data:image\/png;base64,/, ""),
                  },
                },
                {
                  type: "text" as const,
                  text: `Analyze this mix and return improvement suggestions. The image shows the live master spectrum (X-Ray on) — use the visual zone shape alongside the numeric snapshot to spot masking, missing range, or harshness.\n\nMIX SNAPSHOT:\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``,
                },
              ]
            : `Analyze this mix and return improvement suggestions.\n\nMIX SNAPSHOT:\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolUse || !isAnalyzeMixResult(toolUse.input)) {
      return NextResponse.json(
        { error: "Model did not return mix analysis. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      suggestions: toolUse.input.suggestions,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
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
      return NextResponse.json(
        { error: `Anthropic API error: ${error.message}` },
        { status: error.status ?? 502 },
      );
    }
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
