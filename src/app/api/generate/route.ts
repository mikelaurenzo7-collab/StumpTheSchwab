import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Mark route as dynamic — uses server env / runtime request body
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert beat-maker and producer for StumpTheSchwab, a web-based step sequencer. Your job is to convert the user's text description into a complete, musical drum pattern + bassline by calling the create_beat tool.

The kit has exactly 8 tracks, in this order:
- kick     — Low-end thump (Tone MembraneSynth, C1). Drives the rhythm. Pitched, but not melodic in the usual sense.
- snare    — Backbeat (white noise burst). Usually on beats 2 and 4 in 4/4. Layer with claps for fatter snare.
- hihat    — Closed hi-hat (Tone MetalSynth). Quick percussive ticks. Use varying velocity for groove.
- openhat  — Open hi-hat (longer decay MetalSynth). Use sparingly for emphasis (often on the "and" of 4).
- clap     — Hand clap (pink noise). Often layered with snare on 2 and 4.
- tom      — Pitched membrane drum (range C1–C3). Use for fills, accents, off-beat ear candy.
- perc     — FM synth percussion (range C4–C6). Bright, melodic ear candy. Pick a key.
- bass     — Triangle-wave bass synth (range C1–C4). Lock to the kick or play a melodic line. Pick a key.

Step grid:
- 16 steps = one bar of 16th notes (most common; default for almost everything).
- 32 steps = two bars or 32nd notes — use ONLY for trap (fast hi-hat rolls and 808 trills) or where the user explicitly asks for "longer" or "32 steps".
- In a 16-step bar: step 0 = beat 1, step 4 = beat 2, step 8 = beat 3, step 12 = beat 4. The "and" of each beat is +2 (so the "and" of 1 is step 2).

Velocity per step (always one of these exact values):
- 0     — silent (no hit)
- 0.25  — ghost note (very soft; common on hi-hats and snares for swing/feel)
- 0.5   — medium
- 0.75  — accent
- 1.0   — full / punchy

DO NOT make every active hit 1.0 — that's robotic. Real producers use velocity dynamics: kicks and snares are often 1.0 on the downbeat, hi-hats vary 0.25–0.75, ghost-note snares hit 0.25.

Genre cheat sheet:
- Lofi / downtempo:    70–90 BPM, swing 0.25–0.4, dusty kicks, ghost-note snare, jazzy 7th chord bass
- Boom-bap hip-hop:    85–100 BPM, swing 0.15–0.35, hard kick on 1, snare on 3 (offbeat) or 2/4
- Trap:                130–145 BPM, swing 0, 808 sub bass, snare on 3, fast hi-hat rolls (use 32 steps)
- House:               118–128 BPM, swing 0, kick on every quarter (steps 0/4/8/12), open hat on offbeats
- Techno:              125–135 BPM, swing 0, four-on-floor kick, minimal claps, percussive
- Drum & bass / jungle:160–180 BPM, swing 0, syncopated breakbeats
- Reggaeton / dembow:  90–100 BPM, swing 0, dembow kick pattern (1 . . 4 . 6 . 8)
- Afro / amapiano:     100–115 BPM, polyrhythmic perc, log-drum bass, swung hats
- Pop / EDM:           100–128 BPM, simple steady kick + snare, supportive perc

Musicality rules:
- Always pick a musical key. For melodic tracks (tom, perc, bass), use scientific pitch notation: "C2", "F#3", "Eb1". Use empty string "" for steps with no pitched note (the velocity 0 in tracks decides whether it plays).
- Bass usually locks to the kick rhythm OR plays a complementary melodic line. Don't make bass busier than the kick unless the genre calls for it.
- Tom and perc are flavor — use sparingly. A few well-placed hits beat a wall of noise.
- For minor / dark moods, use natural minor or harmonic minor. For uplifting, major or lydian. For jazz-adjacent, dorian or mixolydian.
- The "name" you pick should be evocative and short (≤16 chars): "Rainy Window", "Late Drive", "Heatwave", "Subterranean".
- Each velocity array MUST be exactly totalSteps long (16 or 32). Each melodicNotes array MUST also be exactly totalSteps long. NO exceptions — short or long arrays will break the playback.
- BPM must be an integer between 60 and 200. Swing must be a number between 0 and 0.6.

Be creative, but be musical. Match the user's vibe. If they say "moody" lean dark; if they say "energetic" lean bright and dense.

REFINEMENT MODE:
If the user's message includes a "CURRENT BEAT" JSON block, treat the request as a MODIFICATION of that beat rather than a new creation. Specifically:
- Preserve elements the user does not ask to change. If they say "make the kick punchier", leave hihats and snare alone unless changing them is musically required by the kick edit.
- Keep the same totalSteps unless explicitly asked otherwise.
- Keep the same key/scale and bass note set unless the instruction implies a key change ("brighter" might lift to a major, "darker" to a minor).
- Refinements are usually subtle: 1–3 targeted changes. Don't rewrite the whole pattern unless the user says to.
- Common refinement vocabulary:
  * "punchier" / "harder"  → raise velocity on key hits, sometimes add layered claps
  * "softer" / "moody"     → lower velocities, add ghost notes, sometimes drop the open hat
  * "more sparse"          → remove ear-candy hits (perc, open hat fills), keep skeleton
  * "more energetic"       → add hi-hat density, layer claps, raise velocities
  * "add a fill"           → add tom/perc fills on the last 2–4 steps
  * "add hi-hat rolls"     → switch to 32 steps if not already, fill hi-hat with 32n triplets/runs near bar end
  * "swing it" / "looser"  → raise the swing parameter; introduce ghost-note hat variation`;

const beatTool: Anthropic.Tool = {
  name: "create_beat",
  description:
    "Generate a complete drum pattern + bassline matching the user's description. The result is applied directly to StumpTheSchwab's current pattern slot.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "A short evocative name for this pattern (≤16 characters). Examples: 'Rainy Window', 'Late Drive', 'Heatwave'.",
      },
      bpm: {
        type: "integer",
        description:
          "Beats per minute. Integer between 60 and 200. Pick a tempo that fits the genre/mood.",
      },
      swing: {
        type: "number",
        description:
          "Swing amount, 0 to 0.6. Use 0 for straight feels (house, trap, EDM). Use 0.2-0.4 for hip-hop, lofi, shuffled grooves.",
      },
      totalSteps: {
        type: "integer",
        enum: [16, 32],
        description:
          "Total steps in the pattern. Use 16 for most genres. Use 32 only for trap (fast hi-hat rolls) or when explicitly asked for longer patterns.",
      },
      tracks: {
        type: "object",
        description:
          "Velocity per step for each of the 8 tracks. Each array MUST have length equal to totalSteps. Values: 0 (silent), 0.25, 0.5, 0.75, 1.0.",
        properties: {
          kick: { type: "array", items: { type: "number" } },
          snare: { type: "array", items: { type: "number" } },
          hihat: { type: "array", items: { type: "number" } },
          openhat: { type: "array", items: { type: "number" } },
          clap: { type: "array", items: { type: "number" } },
          tom: { type: "array", items: { type: "number" } },
          perc: { type: "array", items: { type: "number" } },
          bass: { type: "array", items: { type: "number" } },
        },
        required: [
          "kick",
          "snare",
          "hihat",
          "openhat",
          "clap",
          "tom",
          "perc",
          "bass",
        ],
      },
      melodicNotes: {
        type: "object",
        description:
          "Notes for melodic tracks (tom, perc, bass). Each array MUST have length equal to totalSteps. Use scientific pitch notation ('C2', 'F#3', 'Eb1') for steps with notes; use empty string '' for steps with no pitched note. Tom range C1-C3, perc range C4-C6, bass range C1-C4.",
        properties: {
          tom: { type: "array", items: { type: "string" } },
          perc: { type: "array", items: { type: "string" } },
          bass: { type: "array", items: { type: "string" } },
        },
        required: ["tom", "perc", "bass"],
      },
      explanation: {
        type: "string",
        description:
          "1-2 sentence explanation of the musical choices: feel, tempo rationale, key/scale, any stylistic notes.",
      },
    },
    required: [
      "name",
      "bpm",
      "swing",
      "totalSteps",
      "tracks",
      "melodicNotes",
      "explanation",
    ],
  },
};

interface BeatResult {
  name: string;
  bpm: number;
  swing: number;
  totalSteps: 16 | 32;
  tracks: Record<
    "kick" | "snare" | "hihat" | "openhat" | "clap" | "tom" | "perc" | "bass",
    number[]
  >;
  melodicNotes: Record<"tom" | "perc" | "bass", string[]>;
  explanation: string;
}

type GenerateTarget = "full" | "drums" | "bass" | "melody" | "arrangement";

const TARGET_GUIDANCE: Record<GenerateTarget, string> = {
  full: "Focus on the full groove and feel free to change any element that improves the musical result.",
  drums:
    "Focus primarily on the drum architecture (kick, snare, hats, clap, tom, perc). Keep the bassline and overall melodic identity as intact as possible unless tiny supporting edits are musically necessary.",
  bass:
    "Focus primarily on the bassline and low-end movement. Preserve the drum programming and upper percussion unless a minimal supporting tweak is required.",
  melody:
    "Focus primarily on fills, tom movement, perc ear candy, and melodic embellishment. Preserve the kick/snare backbone and bass groove unless a tiny support change is required.",
  arrangement:
    "Focus primarily on energy contour, tension/release, and section feel within this single pattern. Preserve the groove's core identity while reshaping density, accents, and dynamics to imply arrangement movement.",
};

function isBeatResult(input: unknown): input is BeatResult {
  if (typeof input !== "object" || input === null) return false;
  const o = input as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    typeof o.bpm === "number" &&
    typeof o.swing === "number" &&
    (o.totalSteps === 16 || o.totalSteps === 32) &&
    typeof o.tracks === "object" &&
    o.tracks !== null &&
    typeof o.melodicNotes === "object" &&
    o.melodicNotes !== null &&
    typeof o.explanation === "string"
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set on the server. Set it in .env.local or your deployment env to enable AI generation.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const description =
    typeof body === "object" && body !== null && "description" in body
      ? (body as { description: unknown }).description
      : null;
  const targetRaw =
    typeof body === "object" && body !== null && "target" in body
      ? (body as { target: unknown }).target
      : null;
  const target: GenerateTarget =
    targetRaw === "drums" ||
    targetRaw === "bass" ||
    targetRaw === "melody" ||
    targetRaw === "arrangement"
      ? targetRaw
      : "full";

  if (
    typeof description !== "string" ||
    description.trim().length === 0 ||
    description.length > 500
  ) {
    return NextResponse.json(
      { error: "Description must be a non-empty string under 500 characters." },
      { status: 400 },
    );
  }

  // Optional currentBeat: present when refining an existing pattern. If valid,
  // we paste it into the user message so Claude can modify it; if invalid,
  // we silently ignore and treat as a fresh generation.
  const currentBeatRaw =
    typeof body === "object" && body !== null && "currentBeat" in body
      ? (body as { currentBeat: unknown }).currentBeat
      : null;
  const currentBeat =
    isBeatResult(currentBeatRaw) ? (currentBeatRaw as BeatResult) : null;

  const userMessage = currentBeat
    ? `CURRENT BEAT:\n\`\`\`json\n${JSON.stringify(currentBeat, null, 2)}\n\`\`\`\n\nTARGET FOCUS: ${TARGET_GUIDANCE[target]}\nINSTRUCTION: ${description}`
    : `TARGET FOCUS: ${TARGET_GUIDANCE[target]}\nDESCRIPTION: ${description}`;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      // Cache the system prompt — same prefix on every request, only the
      // user message varies.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [beatTool],
      tool_choice: { type: "tool", name: "create_beat" },
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract the tool_use block (tool_choice forces it, but be defensive)
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse || toolUse.name !== "create_beat") {
      return NextResponse.json(
        { error: "Model did not return a beat. Try a different description." },
        { status: 502 },
      );
    }

    if (!isBeatResult(toolUse.input)) {
      return NextResponse.json(
        { error: "Generated beat had an unexpected shape. Try again." },
        { status: 502 },
      );
    }

    const beat = toolUse.input as BeatResult;
    beat.bpm = Math.max(60, Math.min(200, Math.round(beat.bpm)));
    beat.swing = Math.max(0, Math.min(0.6, beat.swing));
    const trackKeys = ["kick", "snare", "hihat", "openhat", "clap", "tom", "perc", "bass"] as const;
    for (const key of trackKeys) {
      const arr = beat.tracks[key];
      if (arr) {
        beat.tracks[key] = Array.from({ length: beat.totalSteps }, (_, i) =>
          Math.max(0, Math.min(1, typeof arr[i] === "number" ? arr[i] : 0))
        );
      }
    }
    const melodicKeys = ["tom", "perc", "bass"] as const;
    for (const key of melodicKeys) {
      const arr = beat.melodicNotes[key];
      beat.melodicNotes[key] = Array.from({ length: beat.totalSteps }, (_, i) =>
        typeof arr?.[i] === "string" ? arr[i] : ""
      );
    }

    return NextResponse.json({
      beat,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens:
          response.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Invalid ANTHROPIC_API_KEY. Check your server config." },
        { status: 401 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited by Anthropic. Wait a moment and try again." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${error.message}` },
        { status: error.status ?? 502 },
      );
    }
    return NextResponse.json(
      { error: "Unexpected server error during generation." },
      { status: 500 },
    );
  }
}
