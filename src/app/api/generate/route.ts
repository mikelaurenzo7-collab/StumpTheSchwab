import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const VOICES = ["kick", "snare", "hat", "clap", "bass", "pluck", "perc", "pad"] as const;

const systemPrompt = `You are an elite beat programmer and music producer. You create drum patterns and melodic sequences for a step sequencer.

The sequencer has 8 tracks, each 16 steps long:
- kick: 4-on-the-floor, trap, breakbeat, etc.
- snare: backbeat, ghost notes, rolls
- hat: open/closed patterns, rides
- clap: accents, layered with snare
- bass: sub bass lines following musical scales
- pluck: melodic plucked synth patterns
- perc: auxiliary percussion (shakers, rimshots, etc.)
- pad: sustained atmospheric chords

Each step is either on (true) or off (false). Patterns should be musically coherent and match the requested genre/style/mood.

You MUST respond with ONLY a valid JSON object using the generate_beat tool.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  let body: { prompt: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.prompt || typeof body.prompt !== "string" || body.prompt.length > 500) {
    return NextResponse.json({ error: "Prompt required (max 500 chars)" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7-20250415",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: "generate_beat",
          description: "Generate a beat pattern for the step sequencer",
          input_schema: {
            type: "object" as const,
            properties: {
              bpm: { type: "number", description: "Tempo in BPM (40-220)", minimum: 40, maximum: 220 },
              swing: { type: "number", description: "Swing amount (0-100)", minimum: 0, maximum: 100 },
              tracks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    voice: { type: "string", enum: [...VOICES] },
                    steps: { type: "array", items: { type: "boolean" }, minItems: 16, maxItems: 16 },
                    level: { type: "number", description: "Volume 0-1", minimum: 0, maximum: 1 },
                    pitch: { type: "number", description: "Base frequency in Hz" },
                  },
                  required: ["voice", "steps"],
                },
                minItems: 1,
                maxItems: 8,
              },
            },
            required: ["bpm", "tracks"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "generate_beat" },
      messages: [
        {
          role: "user",
          content: `Create a beat pattern for: ${body.prompt}`,
        },
      ],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "No pattern generated" }, { status: 500 });
    }

    const beat = toolUse.input as {
      bpm?: number;
      swing?: number;
      tracks: { voice: string; steps: boolean[]; level?: number; pitch?: number }[];
    };

    if (beat.bpm) beat.bpm = Math.max(40, Math.min(220, Math.round(beat.bpm)));
    if (beat.swing !== undefined) beat.swing = Math.max(0, Math.min(100, Math.round(beat.swing)));
    beat.tracks = beat.tracks.filter((t) => VOICES.includes(t.voice as (typeof VOICES)[number]));
    beat.tracks.forEach((t) => {
      if (t.steps.length !== 16) t.steps = t.steps.slice(0, 16).concat(Array(Math.max(0, 16 - t.steps.length)).fill(false));
      if (t.level !== undefined) t.level = Math.max(0, Math.min(1, t.level));
    });

    return NextResponse.json(beat);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
