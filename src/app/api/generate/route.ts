import Anthropic from "@anthropic-ai/sdk";
import { type NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert music producer and beat programmer. You design step-sequencer patterns for a 16-step drum machine with 6 voice tracks:

- kick: 4-on-the-floor foundation. Pitch ~46 Hz.
- snare: backbeats and ghost notes.
- hat: hi-hat patterns from simple 8ths to complex polyrhythmic rides.
- bass: sub-bass patterns. Pitch ~55 Hz.
- pluck: melodic pluck hits. Pitch ~330 Hz.
- pad: atmospheric sustain hits. Pitch ~110 Hz.

Each track has a boolean[16] pattern (true = hit, false = silent), a level (0–1), and there are 4 macro controls:
- bloom (0–100): filter openness
- gravity (0–100): pitch modulation / transposition amount
- shimmer (0–100): delay/reverb send
- fracture (0–100): distortion / rhythmic chaos

Design patterns that are musically compelling: use syncopation, ghost notes, polyrhythms, negative space. Match the mood/genre the user describes. Always create something that grooves.`;

const BEAT_TOOL = {
  name: "create_beat" as const,
  description: "Create a complete beat pattern for the step sequencer",
  input_schema: {
    type: "object" as const,
    properties: {
      bpm: { type: "number" as const, description: "Tempo in BPM (72–178)" },
      tracks: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            voice: { type: "string" as const, enum: ["kick", "snare", "hat", "bass", "pluck", "pad"] },
            pattern: {
              type: "array" as const,
              items: { type: "boolean" as const },
              minItems: 16,
              maxItems: 16,
              description: "16-step boolean pattern",
            },
            level: { type: "number" as const, description: "Volume 0–1" },
          },
          required: ["voice", "pattern", "level"],
        },
      },
      macros: {
        type: "object" as const,
        properties: {
          bloom: { type: "number" as const },
          gravity: { type: "number" as const },
          shimmer: { type: "number" as const },
          fracture: { type: "number" as const },
        },
      },
    },
    required: ["bpm", "tracks"],
  },
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  let prompt: string;
  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7-20250415",
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [BEAT_TOOL],
      tool_choice: { type: "tool", name: "create_beat" },
      messages: [
        { role: "user", content: `Create a beat that matches this description: ${prompt}` },
      ],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return NextResponse.json({ error: "No beat generated" }, { status: 500 });
    }

    return NextResponse.json(toolBlock.input);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
