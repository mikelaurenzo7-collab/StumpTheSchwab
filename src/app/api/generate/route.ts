import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert music producer and beat programmer. You create patterns for an 8-track, 16-step drum machine / synthesizer.

The tracks are (in order):
1. kick — Bass drum. Drives the rhythm. Common patterns: four-on-the-floor, half-time, syncopated.
2. snare — Snare drum. Backbeat and accents. Usually on beats 2 and 4.
3. hat — Hi-hat. Provides texture and drive. 8th notes, 16th notes, open/closed patterns.
4. clap — Handclap. Often layered with snare or used for fills.
5. bass — Bass synthesizer. Melodic low end. Follows the kick or plays counter-rhythms.
6. pluck — Pluck/stab synth. Short melodic hits. Arpeggios, stabs, counter-melodies.
7. pad — Pad/atmosphere. Long sustained tones. Usually sparse — on beat 1, sometimes beat 9.
8. perc — Percussion. Shakers, rimshots, wood blocks. Fills gaps and adds groove.

Each track has:
- pattern: array of 16 booleans (true = trigger, false = rest). Index 0 = beat 1, index 4 = beat 2, etc.
- level: 0-1 (volume). Kick/snare/bass usually 0.7-0.9, hats/perc 0.4-0.6, pads 0.3-0.5.
- probability (optional): array of 16 numbers 0-100. 100 = always triggers. Use <100 for ghost notes, humanization, variation.

Think about genre, groove, and musicality. Consider how tracks interact — kick and bass should complement, not clash. Hats drive the energy. Snare placement defines the feel. Use probability for ghost notes and humanization.`;

const TOOL_SCHEMA: Anthropic.Tool = {
  name: "create_beat",
  description: "Create a beat pattern for the step sequencer",
  input_schema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "Short creative name for this beat (2-4 words)",
      },
      bpm: {
        type: "number",
        description: "Tempo in BPM (30-300). Choose based on genre.",
      },
      tracks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            voice: {
              type: "string",
              enum: ["kick", "snare", "hat", "clap", "bass", "pluck", "pad", "perc"],
            },
            pattern: {
              type: "array",
              items: { type: "boolean" },
              minItems: 16,
              maxItems: 16,
            },
            level: { type: "number", minimum: 0, maximum: 1 },
            probability: {
              type: "array",
              items: { type: "number", minimum: 0, maximum: 100 },
              minItems: 16,
              maxItems: 16,
            },
          },
          required: ["voice", "pattern", "level"],
        },
        minItems: 8,
        maxItems: 8,
      },
    },
    required: ["name", "bpm", "tracks"],
  },
};

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string" || prompt.length > 1000) {
      return Response.json({ error: "Invalid prompt" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-7-20250415",
      max_tokens: 8096,
      thinking: {
        type: "enabled",
        budget_tokens: 4096,
      },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "create_beat" },
      messages: [
        {
          role: "user",
          content: `Create a beat based on this description: "${prompt}"

Use the create_beat tool to output the pattern. Be creative and genre-appropriate.`,
        },
      ],
    });

    const toolBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolBlock) {
      return Response.json({ error: "No beat generated" }, { status: 500 });
    }

    return Response.json(toolBlock.input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
