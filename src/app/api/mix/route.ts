import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Types for the request body ────────────────────────────────────────────────
interface TrackAnalysis {
  id: number;
  name: string;
  volume: number;    // 0..1 (linear)
  pan: number;       // -1..1
  muted: boolean;
  eqOn: boolean;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  driveOn: boolean;
  driveAmount: number;
  filterOn: boolean;
  filterType: string;
  filterFreq: number;
  reverbOn: boolean;
  delayOn: boolean;
  sidechainOn: boolean;
  sidechainSource: number | null;
  activeSteps: number;  // how many steps are non-zero
  totalSteps: number;
}

interface MixAnalysis {
  bpm: number;
  swing: number;
  tracks: TrackAnalysis[];
  lufs: number | null;          // null = not playing
  truePeak: number | null;
  conflicts: Record<string, string[]>;  // zoneIndex → [trackName, ...]
  masterEqOn: boolean;
  masterEqLow: number;
  masterEqMid: number;
  masterEqHigh: number;
  masterCompOn: boolean;
  masterLimiterOn: boolean;
  masterLimiterCeiling: number;
  masterWarmthOn: boolean;
  masterWarmth: number;
  loudnessTarget: string;
}

// ── Suggestion shape (matches MixDoctorPanel's expected type) ────────────────
interface MixSuggestion {
  title: string;
  explanation: string;
  category: "eq" | "volume" | "fx" | "master" | "arrangement" | "praise";
  urgency: "critical" | "recommended" | "optional";
  patches: MixPatch[];
}

interface MixPatch {
  type: "trackEffect" | "trackVolume" | "trackPan" | "master";
  trackId?: number;
  key: string;
  value: number | boolean | string;
}

// ── Cached system prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a world-class mix engineer and producer reviewing a session in StumpTheSchwab, a web-based step sequencer / DAW. Your role is to give honest, specific, actionable mixing advice — like a mentor sitting at the desk next to someone.

You will receive a JSON object describing the current mix: tracks, their EQ settings, FX, volume levels, loudness readings, and frequency zone conflicts detected by the Sonic X-Ray visualizer.

Call the analyze_mix tool to return up to 5 suggestions. Rules:
- Be SPECIFIC. Don't say "consider using EQ" — say "cut 4dB at the Mid band on the Bass; its 1.5kHz content is masking the Snare attack."
- Match the urgency to the actual problem. A clipping master is CRITICAL. A slightly loud hi-hat is OPTIONAL.
- Include at least one "praise" suggestion if something is done well — this is a teaching tool, positive reinforcement matters.
- Each suggestion can include patches — state mutations to apply if the user clicks "Apply". These must map to valid store actions.
- Teach WHY, not just WHAT. One sentence of explanation should reveal a principle: "Kick and bass fighting in the 60–250Hz zone causes a muddy low-end — one of them needs to own that space."
- Loudness guidance: Spotify = -14 LUFS, Apple = -16, Club = -8. True peak should stay under -1 dBTP for streaming.
- EQ guidance: the tracks use fixed crossover points — 250Hz (Low shelf), 1.5kHz (Mid peak), 6kHz (High shelf). Reference these in your advice.
- Volume units: the store uses 0..1 linear (0.75 = roughly -2.5 dB). Be concrete: suggest specific values.
- Available patches types:
  - trackEffect: {type:"trackEffect", trackId:N, key:"trackEqOn"|"trackEqLow"|"trackEqMid"|"trackEqHigh"|"driveOn"|"driveAmount"|"reverbOn"|"reverbDecay"|"reverbWet"|"delayOn"|"delayWet"|"filterOn"|"filterFreq"|"filterType"|"sidechainOn"|"sidechainSource"|"warmthOn"|"warmth", value:...}
  - trackVolume: {type:"trackVolume", trackId:N, key:"volume", value:0..1}
  - master: {type:"master", key:"eqLow"|"eqMid"|"eqHigh"|"eqOn"|"compressorOn"|"compressorThreshold"|"limiterThreshold"|"warmthOn"|"warmth", value:...}

Track IDs are 0=Kick, 1=Snare, 2=Hi-Hat, 3=Open Hat, 4=Clap, 5=Tom, 6=Perc, 7=Bass.

If the mix is completely empty (all tracks at 0 active steps), say so gently and encourage the user to generate or draw a beat first.`;

const analyzeTool: Anthropic.Tool = {
  name: "analyze_mix",
  description: "Return up to 5 specific, actionable mixing suggestions for the current session.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestions: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short title (≤60 chars)" },
            explanation: {
              type: "string",
              description: "2-3 sentences explaining the problem/opportunity and the principle behind the fix.",
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
              description: "State mutations to apply on one-click. May be empty.",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["trackEffect", "trackVolume", "trackPan", "master"] },
                  trackId: { type: "number" },
                  key: { type: "string" },
                  value: {},
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

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const analysis = (body as { analysis?: unknown }).analysis as MixAnalysis | undefined;
  if (!analysis || typeof analysis !== "object") {
    return NextResponse.json({ error: "Missing analysis." }, { status: 400 });
  }

  const userMessage = `Here is the current mix state:\n\`\`\`json\n${JSON.stringify(analysis, null, 2)}\n\`\`\`\n\nPlease analyze this mix and return up to 5 specific, actionable suggestions.`;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [analyzeTool],
      tool_choice: { type: "tool", name: "analyze_mix" },
      messages: [{ role: "user", content: userMessage }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse || toolUse.name !== "analyze_mix") {
      return NextResponse.json(
        { error: "Model did not return suggestions." },
        { status: 502 }
      );
    }

    const result = toolUse.input as { suggestions: MixSuggestion[] };
    return NextResponse.json({ suggestions: result.suggestions ?? [] });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited. Try again shortly." }, { status: 429 });
    }
    return NextResponse.json(
      { error: "Unexpected error from AI." },
      { status: 500 }
    );
  }
}
