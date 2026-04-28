import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are the AI beat engine inside StumpTheSchwab, a web-based music production studio.

You generate beat patterns for a 16-step sequencer with 6 voices: kick, snare, hat, bass, pluck, pad.
Each pattern is an array of 16 booleans — true means the voice triggers on that 16th-note step.

Musical principles:
- Kick anchors the groove. Four-on-floor (steps 0,4,8,12) for house/techno, sparse syncopation for trap/halftime.
- Snare/clap on beats 2 and 4 (steps 4, 12) is the backbone of most genres. Ghost notes add swing.
- Hi-hats create rhythmic texture. Rolling 16ths for trap, 8ths for house, sparse for ambient.
- Bass follows or counterpoints the kick. Root notes on downbeats, melodic fills between.
- Pluck/keys add melodic interest in the gaps — syncopated, call-and-response with bass.
- Pad provides harmonic bed — usually just downbeats (steps 0, 8) with long sustain.

Genre awareness:
- Trap: 70-85 BPM (or 140-170 half-time), rolling hats, sparse kicks, heavy 808 bass patterns
- House/Tech House: 120-130 BPM, four-on-floor kick, offbeat hats, driving bass
- Drum & Bass / Jungle: 160-178 BPM, breakbeat kicks, fast hats, snare on 4/12
- Lo-fi / Boom Bap: 80-95 BPM, swing feel, relaxed hat patterns, classic boom-bap kick/snare
- Ambient / Downtempo: 72-100 BPM, minimal percussion, emphasis on pad and pluck, lots of space
- UK Garage: 130-140 BPM, shuffled hats, two-step kick patterns, syncopated bass

Level guidelines (0.0 to 1.0):
- Kick: 0.75-0.95 (foundation), Snare: 0.60-0.85, Hat: 0.30-0.65 (support)
- Bass: 0.70-0.90, Pluck: 0.40-0.70, Pad: 0.25-0.55

Always create musically coherent, groovy patterns. Leave space — silence is a sound. Match the BPM to the genre unless the user specifies otherwise.`;

const BEAT_TOOL: Anthropic.Messages.Tool = {
  name: "create_beat",
  description: "Generate a beat pattern for the StumpTheSchwab step sequencer",
  input_schema: {
    type: "object" as const,
    properties: {
      bpm: {
        type: "number",
        description: "Tempo in BPM, matched to the genre (72-178)",
      },
      tracks: {
        type: "array",
        description: "One entry per voice with its 16-step pattern",
        items: {
          type: "object",
          properties: {
            voice: {
              type: "string",
              enum: ["kick", "snare", "hat", "bass", "pluck", "pad"],
            },
            pattern: {
              type: "array",
              items: { type: "boolean" },
              minItems: 16,
              maxItems: 16,
              description: "16 booleans — true = trigger on that step",
            },
            level: {
              type: "number",
              description: "Volume 0.0-1.0",
            },
          },
          required: ["voice", "pattern"],
        },
      },
    },
    required: ["bpm", "tracks"],
  },
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to .env.local to enable AI generation." },
      { status: 500 }
    );
  }

  let body: { prompt?: string; currentBpm?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { prompt, currentBpm } = body;
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-7-20250422",
      max_tokens: 4096,
      thinking: {
        type: "enabled",
        budget_tokens: 2048,
      },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [BEAT_TOOL],
      tool_choice: { type: "tool", name: "create_beat" },
      messages: [
        {
          role: "user",
          content: `Generate a beat: "${prompt}". Current session tempo: ${currentBpm ?? 126} BPM.`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) {
      return NextResponse.json(
        { error: "No beat pattern generated" },
        { status: 500 }
      );
    }

    return NextResponse.json(toolUse.input);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate beat error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
