import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a mastering engineer for StumpTheSchwab. Given the current master bus settings, real-time loudness reading (LUFS-S + true peak), 6-zone spectrum energy, and a chosen platform target, return a focused set of master patches that move the mix toward the target loudness while keeping it musical and balanced. Call the master_track tool exactly once.

LOUDNESS TARGETS (LUFS integrated, approximate; we measure short-term):
  spotify  -14 LUFS (TP -1)
  apple    -16 LUFS (TP -1)
  youtube  -14 LUFS (TP -1)
  club     -8  LUFS (TP -0.3)

MASTERBUS KEYS (for master patches):
  volume (0–1), compressorOn (bool), compressorThreshold (-60–0 dB), compressorRatio (1–20),
  compressorAttack (0–1 s), compressorRelease (0.01–1 s), limiterOn (bool), limiterThreshold (-20–0 dB),
  eqOn (bool), eqLow / eqMid / eqHigh (±24 dB), tapeOn (bool), tapeAmount (0–1),
  widthOn (bool), width (0–1)

MASTERING PRINCIPLES:
  - If LUFS is below target by >3 dB: bring up compression first (lower threshold by 2–4 dB, ratio 2:1–4:1) before raising master volume. Then enable limiter at -1 dBFS true peak.
  - If true peak is hot (>-0.5 dB): enable limiter; reduce master volume slightly; reduce limiterThreshold to -1 to -1.5 dB.
  - For "club" / aggressive targets (-8 LUFS): enable tape (0.4–0.6) + heavy compression + limiter at -0.5 dB. Width 0.6–0.7. Tighten low end with eqLow -1 to -2 dB.
  - For "spotify" / "youtube" (-14 LUFS): moderate compression (threshold -18 to -22 dB, ratio 2:1–3:1), limiter at -1 dB, eq mostly flat unless mix has issues. Tape at 0.25–0.35.
  - For "apple" (-16 LUFS): lighter compression (threshold -22 to -25 dB, ratio 1.5:1–2:1), limiter at -1 dB. Preserve dynamics — Apple respects them.
  - Width: enable widener (0.55–0.7) for wide-feeling masters; keep ≤0.5 for mono-safe masters.
  - Spectrum-driven moves: if zone "loMid" is too hot (>0.12 RMS), eqMid -2 dB. If "air" is anaemic (<0.005), eqHigh +2 dB. If "sub" is overloud (>0.18), eqLow -1.5 dB.
  - NEVER push master volume above 0.95 if limiter is off — leave headroom.
  - Each suggestion should be 4–8 patches max. Avoid micro-changes (<0.5 dB or <0.05 unit shifts).

PATCH SCHEMA:
  { "key": "<MasterBus key>", "value": <number|boolean> }`;

// ── Tool ────────────────────────────────────────────────────────────────────────

const masterTrackTool: Anthropic.Tool = {
  name: "master_track",
  description: "Return a set of master bus patches to hit the chosen loudness target while keeping the mix musical.",
  input_schema: {
    type: "object",
    properties: {
      patches: {
        type: "array",
        description: "Master patches to apply in order. 4–8 patches typically.",
        items: {
          type: "object",
          properties: {
            key:   { type: "string", description: "MasterBus key (e.g. 'limiterOn', 'tapeAmount', 'eqLow')." },
            value: { description: "New value (boolean or number, in valid range for the key)." },
          },
          required: ["key","value"],
        },
      },
      explanation: {
        type: "string",
        description: "2–3 sentences on what's happening and why these moves get the mix to the target.",
      },
      predicted_lufs_change: {
        type: "number",
        description: "Estimated LUFS-S change after applying these patches (e.g. +2.5 means louder).",
      },
    },
    required: ["patches","explanation"],
  },
};

// ── Types ───────────────────────────────────────────────────────────────────────

export interface MasterPatch {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

export interface MasterResult {
  patches: MasterPatch[];
  explanation: string;
  predicted_lufs_change?: number;
}

function isMasterResult(v: unknown): v is MasterResult {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.patches) && typeof o.explanation === "string";
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
  const snapshot = typeof b.snapshot === "string" ? b.snapshot : "";
  if (!snapshot) {
    return NextResponse.json({ error: "Master snapshot is required." }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1536,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [masterTrackTool],
      tool_choice: { type: "tool", name: "master_track" },
      messages: [
        {
          role: "user",
          content: `MASTER SNAPSHOT:\n\`\`\`json\n${snapshot}\n\`\`\`\n\nReturn the master patches needed to reach the target.`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolUse || !isMasterResult(toolUse.input)) {
      return NextResponse.json({ error: "Model did not return master patches." }, { status: 502 });
    }

    return NextResponse.json({
      ...(toolUse.input as MasterResult),
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
