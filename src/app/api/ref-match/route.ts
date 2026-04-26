import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ReferenceDescriptor } from "@/lib/refAnalyzer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a mastering and mix engineer for StumpTheSchwab, a web DAW. Your job is to analyse a computed audio descriptor for a reference track and suggest how the current project's mix should be adjusted to match the reference's tonal character, energy, and tempo.

UNDERSTANDING THE REFERENCE DESCRIPTOR:
- estimatedBpm: Detected tempo in BPM (may be ± a few BPM off). null if detection failed.
- peakLinear: Highest absolute sample value (0–1). >0.9 = nearly clipping; <0.3 = quiet master.
- overallRms: Full-range loudness proxy (linear, 0–1). Typical mastered track: 0.1–0.35.
- zones: Spectral energy per band (linear RMS, 0–1). Interpret in context:
    sub (20-80 Hz)       — kick weight, sub bass. High = heavy low end
    bass (80-250 Hz)     — bass body, bass guitar, kick punch
    loMid (250-800 Hz)   — warmth / mud. High = boomy; low = thin
    mid (800-2500 Hz)    — presence, snare attack, vocal range
    presence (2.5-8kHz)  — crispness, hi-hats, top-end snap
    air (8-20kHz)        — air, shimmer, reverb tails
- envelope: RMS per quarter of the reference (q1–q4). Rising = builds; flat = consistent.

REFERENCE ZONE BENCHMARKS (typical dance/electronic music):
  sub:      0.05–0.15 (dance), 0.02–0.08 (indie/pop)
  bass:     0.08–0.20
  loMid:    0.04–0.12
  mid:      0.02–0.08
  presence: 0.02–0.06
  air:      0.005–0.03

CURRENT PROJECT STATE FORMAT (included in request):
  bpm, swing, activeKitPackId, tracks[0..7] with volumes/pans, master settings.

PATCH TYPES AND KEYS (mix_patches):
  trackVolume   — key: "volume",   value: 0–1   (trackId required, 0=kick..7=bass)
  trackPan      — key: "pan",      value: -1..1 (trackId required)
  trackEffect   — key: effect param (e.g. "reverbWet", "filterFreq"), value: number/bool (trackId required)
                  add enable key (e.g. "reverbOn") if you're turning on a previously-off FX
  master        — key: MasterBus field (eqLow/eqMid/eqHigh/tapeOn/tapeAmount/widthOn/width/
                  compressorOn/compressorThreshold/limiterOn etc.), value: number/bool

GUIDANCE:
  - Compare reference zones to a "flat" mix at nominal levels to understand what to push/pull.
  - Heavy sub reference → raise kick volume (track 0) and bass volume (track 7).
  - Thin low-end → pull back bass or apply eqLow boost.
  - Harsh presence → suggest presence filtering on brighter tracks or eqHigh cut.
  - Dark reference (low air) → suggest eqHigh = -2 to -4 on master.
  - Bright reference → eqHigh +2 to +4, or presence filter cuts on tracks.
  - Warm / muddy reference → eqMid -2 to -4 on master, or loMid filter on bass/perc.
  - If reference BPM differs from project by >5 BPM, suggest the reference BPM.
  - Suggest a kit_suggestion if the BPM + spectral profile strongly matches a style.
  - Keep patches minimal (3–7 targeted adjustments). Focus on what creates the most impact.
  - Never suggest patches that would clip (volume > 1.0) or create impossible values.
  - Avoid adding reverb or delay unless the reference clearly has a very wet sound.`;

// ── Tool ────────────────────────────────────────────────────────────────────────

const matchReferenceTool: Anthropic.Tool = {
  name: "match_reference",
  description: "Return targeted mix patches and suggestions to shift the current project toward the reference track's character.",
  input_schema: {
    type: "object",
    properties: {
      mix_patches: {
        type: "array",
        description: "Mix adjustments to apply. Aim for 3–7 targeted patches.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["trackVolume","trackPan","trackEffect","master"],
            },
            trackId: {
              type: "integer",
              minimum: 0,
              maximum: 7,
              description: "Required for trackVolume/trackPan/trackEffect.",
            },
            key:    { type: "string",  description: "Parameter key." },
            value:  { description: "New value (number or boolean)." },
            enable: { type: "string",  description: "Optional companion enable key (e.g. 'reverbOn')." },
          },
          required: ["type","key","value"],
        },
      },
      kit_suggestion: {
        type: "string",
        enum: ["boombap","lofi","trap","synthwave","dnb","house"],
        description: "Optional kit that best matches the reference style. Omit if current kit fits.",
      },
      bpm: {
        type: "integer",
        description: "Suggested project BPM based on reference. Omit if current BPM is close (<5 BPM away).",
      },
      swing: {
        type: "number",
        description: "Suggested swing amount based on reference feel. Omit if no clear change is needed.",
      },
      explanation: {
        type: "string",
        description: "2–3 sentences describing the reference's character and what the patches aim to match.",
      },
    },
    required: ["mix_patches","explanation"],
  },
};

// ── Types ───────────────────────────────────────────────────────────────────────

export interface RefMatchResult {
  mix_patches: Array<{
    type: "trackVolume" | "trackPan" | "trackEffect" | "master";
    trackId?: number;
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
    enable?: string;
  }>;
  kit_suggestion?: string;
  bpm?: number;
  swing?: number;
  explanation: string;
}

function isRefMatchResult(v: unknown): v is RefMatchResult {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.mix_patches) && typeof o.explanation === "string";
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
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const reference = b.reference as ReferenceDescriptor | undefined;
  const projectStateJson = typeof b.projectState === "string" ? b.projectState : "{}";

  if (!reference || typeof reference.overallRms !== "number") {
    return NextResponse.json({ error: "Missing or invalid reference descriptor." }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [matchReferenceTool],
      tool_choice: { type: "tool", name: "match_reference" },
      messages: [
        {
          role: "user",
          content: `REFERENCE TRACK DESCRIPTOR:\n\`\`\`json\n${JSON.stringify(reference, null, 2)}\n\`\`\`\n\nCURRENT PROJECT STATE:\n\`\`\`json\n${projectStateJson}\n\`\`\`\n\nAnalyse the reference and return mix patches to bring the current project closer to the reference's character.`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolUse || !isRefMatchResult(toolUse.input)) {
      return NextResponse.json({ error: "Model did not return a result. Try again." }, { status: 502 });
    }

    const result = toolUse.input as RefMatchResult;
    return NextResponse.json({
      ...result,
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
