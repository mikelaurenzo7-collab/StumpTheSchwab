import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lightweight system prompt — Haiku, low max_tokens, no thinking. Goal:
// every N bars, return ONE micro-patch on a track FX param to keep the live
// performance breathing. Quick + cheap, never destructive.
const SYSTEM_PROMPT = `You are an AI co-performer in StumpTheSchwab's live mode. Every few bars you receive a snapshot of the live mix and return ONE micro-patch on a track FX parameter via the improv_micro tool. Your job: keep the mix alive — small, musical micro-shifts that the ear notices but doesn't break the groove.

ALLOWED TARGETS (one per call):
  - { type: "trackEffect", trackId: 0..7, key: "delayWet", value: 0..0.4 }
  - { type: "trackEffect", trackId: 0..7, key: "reverbWet", value: 0..0.4 }
  - { type: "trackEffect", trackId: 0..7, key: "filterFreq", value: 200..15000 }
  - { type: "trackEffect", trackId: 0..7, key: "driveAmount", value: 0..0.5 }

RULES:
  - Pick ONE patch per turn. Never multiple.
  - Magnitude: small. Treat the current value as a baseline; nudge ±10-30% of the parameter range.
  - Avoid the kick (track 0) — too central. Prefer perc (6), tom (5), bass (7), openhat (3).
  - If the previous patch already moved a parameter, prefer ramping it back toward neutral on the next turn.
  - Be sparse. If nothing musical comes to mind, return a no-op patch (key: "noop", value: 0) — it's allowed.

KEEP IT TASTEFUL. Subtle is better than spectacular for live mode.`;

const improvTool: Anthropic.Tool = {
  name: "improv_micro",
  description: "Return one micro-patch for the live mix — or a no-op.",
  input_schema: {
    type: "object",
    properties: {
      trackId: { type: "integer", minimum: 0, maximum: 7, description: "Required for non-noop patches." },
      key: {
        type: "string",
        enum: ["delayWet", "reverbWet", "filterFreq", "driveAmount", "noop"],
      },
      value: { description: "New parameter value (number)." },
      reason: { type: "string", description: "1 short clause — what you heard, why this nudge." },
    },
    required: ["key", "reason"],
  },
};

export interface ImprovMicro {
  trackId?: number;
  key: "delayWet" | "reverbWet" | "filterFreq" | "driveAmount" | "noop";
  value?: number;
  reason: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const snapshot = typeof b.snapshot === "string" ? b.snapshot : "";
  if (!snapshot) {
    return NextResponse.json({ error: "Live snapshot is required." }, { status: 400 });
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [improvTool],
      tool_choice: { type: "tool", name: "improv_micro" },
      messages: [{ role: "user", content: `LIVE SNAPSHOT:\n\`\`\`json\n${snapshot}\n\`\`\`` }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) {
      return NextResponse.json({ error: "No micro-patch returned." }, { status: 502 });
    }
    return NextResponse.json(toolUse.input as ImprovMicro);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 502 });
    }
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
