import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You compose 4-bar electronic music progressions for a 6-voice radial sequencer studio.

The studio has these voices, each on its own track of a 16-step (sixteenth-note) grid:
  • kick (C1, MembraneSynth + click)
  • snare (NoiseSynth bandpass body + sine crack + 8kHz HP sizzle)
  • hat (MetalSynth, alternating stereo pan)
  • bass (MonoSynth saw + sub sine, follows chord roots)
  • pluck (PluckSynth, 1/8-dotted ping-pong delay)
  • pad (PolySynth/AMSynth fatsawtooth + chorus, plays full chord)

The arrangement is fixed: intro 4 bars / verse 8 / build 4 / drop 16 / break 4 / drop2 8 / outro 4.
Your job is to produce the SONG that plays through that arrangement: key, mode, a 4-chord progression
(one chord per bar; loops 12 times across the 48 bars), the per-step pluck motif (chord-tone indices
0=root, 1=3rd, 2=5th, 3=7th if present, or null for rest — a single 16-entry array used every bar),
and the per-step bass motif (one of "root" / "third" / "fifth" / "octave" — also a single 16-entry array).
Also pick BPM (72–178), swing (0–0.6), and starting macro values.

Composition principles you must follow:
1. Pick a key + mode that matches the user's mood/genre prompt. Default to minor for dark, dorian for
   moody-but-not-sad, phrygian for cinematic/exotic, major for bright, mixolydian for funk/rock.
2. The progression should resolve. Strong choices: i-VI-III-VII (Andalusian minor),
   I-V-vi-IV (pop), vi-IV-I-V, ii-V-I-IV (jazzy), i-iv-VII-III. Avoid four chords that all sit on the
   same scale degree or move only by step.
3. Quality choice — most chords should be triads (maj/min). Use min7/maj7/dom7 for jazz/lounge,
   sus2/sus4 for ambient/dreamy. Diminished is rare — only for tension chords.
4. The pluck motif should make sense as a melody played over moving chords. Land on root or 5th
   on the strong beats (steps 0, 4, 8, 12); use the 3rd or 7th on weak beats. Include rests (null) —
   silence is a melodic choice. Repeat sub-motifs (e.g., the same 4-step shape 4 times with one
   variation in the last repeat) so it feels intentional, not random.
5. Bass motif — root on step 0 of every measure is non-negotiable. Decorate with fifth on syncopated
   16ths, octave on the "and" of beat 4 for lift. "third" is used sparingly.
6. BPM/swing should match the genre. House/techno 120–128, lo-fi/hip-hop 80–95, drum&bass 170–178,
   trap/halftime 70–85 (write at half-speed BPM), ambient 60–80, future bass 140–155. Add swing
   0.15–0.35 for hip-hop / lo-fi / trap; keep swing 0–0.1 for techno / drum&bass / ambient.
7. Macros (0–100): bloom = master brightness (low for dark, 70+ for airy),
   gravity = sub-bass weight (high for trap/dub, low for ambient),
   shimmer = reverb send (low for tight/punchy, high for ambient/cinematic),
   fracture = master distortion (0 for clean, 30+ for grit/trap, 60+ for industrial).
8. Name the song evocatively (2-3 words, no em-dashes, title case).

Use the compose_song tool to return the result. Do not return prose.`;

const COMPOSE_TOOL: Anthropic.Tool = {
  name: "compose_song",
  description: "Output a complete song spec for the radial sequencer studio.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "Title-case song name, 2-4 words." },
      key: {
        type: "string",
        enum: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
      },
      mode: { type: "string", enum: ["minor", "major", "dorian", "phrygian", "mixolydian"] },
      progression: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        description: "Exactly 4 chords; one per measure. Cycles across the song.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            degree: { type: "integer", minimum: 1, maximum: 7 },
            quality: {
              type: "string",
              enum: ["maj", "min", "dim", "maj7", "min7", "dom7", "sus2", "sus4"],
            },
          },
          required: ["degree", "quality"],
        },
      },
      pluckMotif: {
        type: "array",
        minItems: 16,
        maxItems: 16,
        description: "16 chord-tone indices (0=root, 1=3rd, 2=5th, 3=7th if present) or null for rest.",
        items: { type: ["integer", "null"], minimum: 0, maximum: 3 },
      },
      bassMotif: {
        type: "array",
        minItems: 16,
        maxItems: 16,
        items: { type: "string", enum: ["root", "third", "fifth", "octave"] },
      },
      bpm: { type: "integer", minimum: 72, maximum: 178 },
      swing: { type: "number", minimum: 0, maximum: 0.6 },
      macros: {
        type: "object",
        additionalProperties: false,
        properties: {
          bloom: { type: "integer", minimum: 0, maximum: 100 },
          gravity: { type: "integer", minimum: 0, maximum: 100 },
          shimmer: { type: "integer", minimum: 0, maximum: 100 },
          fracture: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["bloom", "gravity", "shimmer", "fracture"],
      },
      rationale: {
        type: "string",
        description: "1-2 sentences explaining the musical choices for this prompt.",
      },
    },
    required: ["name", "key", "mode", "progression", "pluckMotif", "bassMotif", "bpm", "swing", "macros", "rationale"],
  },
};

const client = new Anthropic();

export async function POST(req: Request) {
  let prompt: string;
  try {
    const body = await req.json();
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: "missing prompt" }, { status: 400 });
  }
  if (prompt.length > 1200) {
    return Response.json({ error: "prompt too long (max 1200 chars)" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured on the server" },
      { status: 500 },
    );
  }

  try {
    // Note: cannot combine `thinking` with `tool_choice: {type: "tool"}` —
    // the API rejects that combination. Forced tool choice gives us
    // guaranteed structured output without needing extended reasoning.
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [COMPOSE_TOOL],
      tool_choice: { type: "tool", name: "compose_song" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "compose_song",
    );
    if (!toolUse) {
      return Response.json(
        { error: "model did not call compose_song", stop_reason: response.stop_reason },
        { status: 502 },
      );
    }

    return Response.json({ song: toolUse.input });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "invalid ANTHROPIC_API_KEY" }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "rate limited — try again shortly" }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `Anthropic API ${err.status}: ${err.message}` }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
