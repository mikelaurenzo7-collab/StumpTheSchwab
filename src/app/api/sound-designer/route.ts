import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── System prompt ─────────────────────────────────────────────────────────────
// Teaches Claude every Tone.js synth type and valid constructor params so the
// returned options object passes straight into the hot-swap path.
const SYSTEM_PROMPT = `You are an expert electronic music synthesizer designer for StumpTheSchwab, a web DAW. Your job is to translate a plain-language description of a sound into a precise Tone.js synth configuration by calling the design_sound tool.

AVAILABLE SYNTH TYPES AND THEIR TONE.JS CONSTRUCTOR OPTIONS:

"membrane" — Tone.MembraneSynth (drums, kicks)
  options keys: pitchDecay (0.001–0.5), octaves (0–8), oscillator.type ("sine"|"triangle"|"square"|"sawtooth"), envelope.attack, envelope.decay, envelope.sustain, envelope.release

"noise" — Tone.NoiseSynth (snares, hats, claps)
  options keys: noise.type ("white"|"pink"|"brown"), envelope.attack, envelope.decay, envelope.sustain, envelope.release

"metal" — Tone.MetalSynth (cymbals, bells)
  options keys: frequency (20–8000 Hz), harmonicity (0–10), modulationIndex (0–50), resonance (100–20000 Hz), octaves (0–4), envelope.attack, envelope.decay, envelope.release

"synth" — Tone.Synth (basic oscillator, pads, leads)
  options keys: oscillator.type ("sine"|"triangle"|"square"|"sawtooth"), envelope.attack, envelope.decay, envelope.sustain, envelope.release

"am" — Tone.AMSynth (warmth, organ-ish, keys)
  options keys: harmonicity (0–10), oscillator.type, modulation.type ("sine"|"triangle"|"square"|"sawtooth"), envelope.attack/.decay/.sustain/.release, modulationEnvelope.attack/.decay/.sustain/.release

"fm" — Tone.FMSynth (bells, plucks, electric piano, FM pads)
  options keys: harmonicity (0–10), modulationIndex (0–50), oscillator.type, modulation.type ("sine"|"square"), envelope.attack/.decay/.sustain/.release, modulationEnvelope.attack/.decay/.sustain/.release

"monosynth" — Tone.MonoSynth (bass, leads with filter envelope)
  options keys: oscillator.type, envelope.attack/.decay/.sustain/.release, filter.Q (0–20), filter.type ("lowpass"|"highpass"|"bandpass"), filter.rolloff (-12|-24|-48), filterEnvelope.attack/.decay/.sustain/.release, filterEnvelope.baseFrequency (20–4000 Hz), filterEnvelope.octaves (0–6)

UNIVERSAL VOICE OPTIONS (apply to any oscillator-based voice — synth/am/fm/monosynth/membrane):
  • detune (cents, -100..+100): pitch offset; small values (±5..±15) for warmth, larger for layered character
  • portamento (seconds, 0..0.5; ignored on membrane): glide time between consecutive notes — essential for legato monosynth basslines

NOTE CONVENTIONS:
  Drums/noise: use the default note (kick: "C1", snare: "16n", hihat: "C6", etc.)
  Melodic synths: choose note from the track's typical range
  Bass: usually "C2" to "A2"
  Perc/bells: usually "C5" to "A5"
  Tom: usually "A2" to "E3"

DESIGN PRINCIPLES:
- Short attack = percussive (0.001–0.005 s)
- Long sustain + slow release = pads, held notes
- Fast decay + sustain 0 = plucked, mallet, struck sounds
- For "warm" sounds: use sine or triangle; lower modulation index; filter cutoff low
- For "bright/crisp" sounds: use sawtooth; high presence; slightly longer attack
- For "punchy" sounds: short pitchDecay, 4–5 octaves sweep (membrane); fast attack
- For "sub/deep": monosynth with sine, low baseFrequency (<80 Hz), octaves 2–3
- For "metallic/bell": metal or fm; high harmonicity (4–6); high modulationIndex (8–15)
- Reverb/delay are handled by the FX chain, NOT in the synth options — do not add them here
- Keep option objects minimal: only include keys that differ meaningfully from defaults

NEVER include unknown option keys. NEVER use audio processing terms that aren't Tone.js constructor params.`;

const designSoundTool: Anthropic.Tool = {
  name: "design_sound",
  description: "Return a complete Tone.js synth configuration matching the description.",
  input_schema: {
    type: "object",
    properties: {
      synth: {
        type: "string",
        enum: ["membrane", "noise", "metal", "synth", "am", "fm", "monosynth"],
        description: "The Tone.js synth class to use.",
      },
      note: {
        type: "string",
        description: "Default trigger note in scientific pitch notation (e.g. 'C2', 'A4'). For noise: use a duration like '16n'.",
      },
      noteRange: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 2,
        description: "Optional [low, high] note range for the piano roll (e.g. ['C1','C3']). Omit for non-melodic tracks.",
      },
      options: {
        type: "object",
        description: "Tone.js constructor options for the chosen synth type. Only include keys relevant to this synth.",
      },
      explanation: {
        type: "string",
        description: "1–2 sentences describing the sound design choices: voice type rationale, key parameter decisions, intended character.",
      },
    },
    required: ["synth", "note", "options", "explanation"],
  },
};

interface DesignResult {
  synth: string;
  note: string;
  noteRange?: [string, string];
  options: Record<string, unknown>;
  explanation: string;
}

function isDesignResult(v: unknown): v is DesignResult {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.synth === "string" &&
    typeof o.note === "string" &&
    typeof o.options === "object" &&
    o.options !== null &&
    typeof o.explanation === "string"
  );
}

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
  const description = typeof b.description === "string" ? b.description.trim() : "";
  const trackName   = typeof b.trackName   === "string" ? b.trackName   : "Track";
  const currentSynth = typeof b.currentSynth === "string" ? b.currentSynth : "unknown";

  if (!description || description.length > 300) {
    return NextResponse.json(
      { error: "Description must be a non-empty string under 300 characters." },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      // Note: Anthropic forbids `thinking` together with a forced
      // `tool_choice: { type: "tool", … }`. We force a single tool here, so
      // thinking is omitted to avoid an HTTP 400.
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [designSoundTool],
      tool_choice: { type: "tool", name: "design_sound" },
      messages: [
        {
          role: "user",
          content: `Track: "${trackName}" (currently using ${currentSynth} synth)\nDesired sound: ${description}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolUse || !isDesignResult(toolUse.input)) {
      return NextResponse.json({ error: "Model did not return a design. Try again." }, { status: 502 });
    }

    const result = toolUse.input as DesignResult;
    return NextResponse.json({
      synth: result.synth,
      note: result.note,
      noteRange: result.noteRange ?? null,
      options: result.options,
      explanation: result.explanation,
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
      return NextResponse.json({ error: `Anthropic API error: ${error.message}` }, { status: error.status ?? 502 });
    }
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
