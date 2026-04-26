import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an AI co-producer embedded in StumpTheSchwab, a web DAW. You can see the full project state and control the DAW directly via tools. Think of yourself as a skilled producer sitting alongside the user.

TRACK LAYOUT (0-indexed):
  0 kick    — MembraneSynth (C1) — low-end thump, drives the rhythm
  1 snare   — NoiseSynth — backbeat, usually beats 2 and 4
  2 hihat   — MetalSynth (C6) — closed hi-hat ticks
  3 openhat — MetalSynth (C5) — open hi-hat, use sparingly
  4 clap    — NoiseSynth — hand clap, layers with snare
  5 tom     — MembraneSynth, melodic C1–C3 — fills and accents
  6 perc    — FMSynth, melodic C4–C6 — bright ear candy
  7 bass    — MonoSynth, melodic C1–C4 — lock to kick or melodic line

KIT PACKS: boombap | lofi | trap | synthwave | dnb | house

SYNTH TYPES: membrane | noise | metal | synth | am | fm | monosynth

MASTERBUS KEYS (for set_master_fx):
  volume (0–1), compressorOn (bool), compressorThreshold (-60–0 dB), compressorRatio (1–20),
  compressorAttack (0–1), compressorRelease (0.01–1), limiterOn (bool), limiterThreshold (-20–0),
  eqOn (bool), eqLow / eqMid / eqHigh (±24 dB), tapeOn (bool), tapeAmount (0–1),
  widthOn (bool), width (0–1), loudnessTarget ("off"|"spotify"|"apple"|"youtube"|"club")

TRACK FX KEYS (for apply_mix_patches → trackEffect):
  filterOn/filterType/filterFreq/filterQ, driveOn/driveAmount,
  delayOn/delayTime/delayFeedback/delayWet, reverbOn/reverbDecay/reverbWet

TOOL SELECTION GUIDE:
  "new beat / different groove / change rhythm" → create_beat
  "make [track] sound like / change the voice of" → design_sound
  "turn up/down [track] / add reverb / filter the snare" → apply_mix_patches
  "change BPM / faster / slower / swing more" → set_transport
  "turn on tape / add stereo width / compress more" → set_master_fx
  "load the trap kit / try boom bap" → load_kit_pack

PROJECT MEMORY:
  Each turn includes a [MEMORY] block listing what you've learned about this user across sessions. Reference it implicitly — don't quote memory entries back. Use the remember tool sparingly when you observe a durable pattern (e.g. user always wants kicks tuned darker, always works at 90 BPM, prefers minor keys). Do NOT remember single-shot requests, timestamps, or volatile state.

RULES:
  - ALWAYS use a tool if the user requests a musical change. Never just describe.
  - You may chain multiple tools per turn (e.g. set BPM → create a matching beat).
  - After applying tools, describe your choices in 1–2 crisp sentences.
  - Be direct and musical. Skip filler. Trust your ears (and the data).`;

// ── Tool definitions ────────────────────────────────────────────────────────────

const createBeatTool: Anthropic.Tool = {
  name: "create_beat",
  description: "Generate or rewrite the current pattern: drum programming + bassline + melodic perc.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short evocative pattern name (≤16 chars)." },
      bpm: { type: "integer", description: "Tempo in BPM (60–200)." },
      swing: { type: "number", description: "Swing amount 0–0.6 (0 = straight, 0.35 = hip-hop feel)." },
      totalSteps: { type: "integer", enum: [16, 32], description: "16 for most genres; 32 for trap or explicit request." },
      tracks: {
        type: "object",
        description: "Velocity per step for all 8 tracks. Each array MUST be totalSteps long. Values: 0, 0.25, 0.5, 0.75, 1.0.",
        properties: {
          kick:    { type: "array", items: { type: "number" } },
          snare:   { type: "array", items: { type: "number" } },
          hihat:   { type: "array", items: { type: "number" } },
          openhat: { type: "array", items: { type: "number" } },
          clap:    { type: "array", items: { type: "number" } },
          tom:     { type: "array", items: { type: "number" } },
          perc:    { type: "array", items: { type: "number" } },
          bass:    { type: "array", items: { type: "number" } },
        },
        required: ["kick","snare","hihat","openhat","clap","tom","perc","bass"],
      },
      melodicNotes: {
        type: "object",
        description: "Notes for melodic tracks. Each array MUST be totalSteps long. Use '' for silent steps.",
        properties: {
          tom:  { type: "array", items: { type: "string" } },
          perc: { type: "array", items: { type: "string" } },
          bass: { type: "array", items: { type: "string" } },
        },
        required: ["tom","perc","bass"],
      },
      explanation: { type: "string", description: "1-2 sentences on feel, tempo, key, stylistic choices." },
    },
    required: ["name","bpm","swing","totalSteps","tracks","melodicNotes","explanation"],
  },
};

const applyMixPatchesTool: Anthropic.Tool = {
  name: "apply_mix_patches",
  description: "Apply targeted mix adjustments: track volumes, pans, FX settings, and master bus parameters.",
  input_schema: {
    type: "object",
    properties: {
      patches: {
        type: "array",
        description: "List of patches to apply in order.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["trackVolume","trackPan","trackEffect","master"],
              description: "Patch target.",
            },
            trackId: { type: "integer", minimum: 0, maximum: 7, description: "Required for trackVolume/trackPan/trackEffect." },
            key: { type: "string", description: "Parameter key (e.g. 'reverbWet', 'volume', 'eqLow')." },
            value: { description: "New value. Number for most params; boolean for On/Off toggles." },
            enable: { type: "string", description: "Optional companion key to set true (e.g. 'reverbOn' when setting reverbWet)." },
          },
          required: ["type","key","value"],
        },
      },
    },
    required: ["patches"],
  },
};

const designSoundTool: Anthropic.Tool = {
  name: "design_sound",
  description: "Design a new Tone.js synth voice for a specific track. Use when the user wants to change what a track fundamentally sounds like.",
  input_schema: {
    type: "object",
    properties: {
      trackId: {
        type: "integer",
        minimum: 0,
        maximum: 7,
        description: "Track index (0=kick, 1=snare, 2=hihat, 3=openhat, 4=clap, 5=tom, 6=perc, 7=bass).",
      },
      synth: {
        type: "string",
        enum: ["membrane","noise","metal","synth","am","fm","monosynth"],
        description: "Tone.js synth class.",
      },
      note: {
        type: "string",
        description: "Default trigger note ('C1', 'A4') or duration for noise ('16n').",
      },
      options: {
        type: "object",
        description: "Tone.js constructor options for the chosen synth. Only keys valid for that synth type.",
      },
      explanation: {
        type: "string",
        description: "1-2 sentences on sound design rationale.",
      },
    },
    required: ["trackId","synth","note","options","explanation"],
  },
};

const setTransportTool: Anthropic.Tool = {
  name: "set_transport",
  description: "Set BPM, swing, song mode, or step count.",
  input_schema: {
    type: "object",
    properties: {
      bpm:        { type: "integer", minimum: 30, maximum: 300, description: "Beats per minute." },
      swing:      { type: "number",  minimum: 0,  maximum: 0.6, description: "Swing amount (0 = straight)." },
      songMode:   { type: "boolean", description: "Enable/disable song chain playback." },
      totalSteps: { type: "integer", enum: [16, 32], description: "Steps per pattern." },
    },
  },
};

const setMasterFxTool: Anthropic.Tool = {
  name: "set_master_fx",
  description: "Set a single master bus parameter by key.",
  input_schema: {
    type: "object",
    properties: {
      key:   { type: "string", description: "MasterBus key (e.g. 'tapeOn', 'width', 'eqLow')." },
      value: { description: "New value (boolean or number)." },
    },
    required: ["key","value"],
  },
};

const loadKitPackTool: Anthropic.Tool = {
  name: "load_kit_pack",
  description: "Swap the entire kit to a factory preset.",
  input_schema: {
    type: "object",
    properties: {
      packId: {
        type: "string",
        enum: ["boombap","lofi","trap","synthwave","dnb","house"],
        description: "Kit preset ID.",
      },
      applyTempo: {
        type: "boolean",
        description: "If true, also set BPM and swing to the kit's defaults.",
      },
    },
    required: ["packId"],
  },
};

const rememberTool: Anthropic.Tool = {
  name: "remember",
  description: "Persist a useful learning about this user / their style / their current project for future sessions. Use sparingly — only for facts likely to remain relevant. Examples: 'Prefers 90 BPM boom-bap', 'Working on a moody EP', 'Always sidechains bass to kick'.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The learning, ≤240 chars, written in third person ('User prefers...', 'Likes...').",
      },
      category: {
        type: "string",
        enum: ["preference","style","context","skill","fact"],
        description: "preference=workflow defaults; style=sonic tendencies; context=current project; skill=area of focus; fact=miscellaneous.",
      },
    },
    required: ["text","category"],
  },
};

const TOOLS: Anthropic.Tool[] = [
  createBeatTool,
  applyMixPatchesTool,
  designSoundTool,
  setTransportTool,
  setMasterFxTool,
  loadKitPackTool,
  rememberTool,
];

// ── Route ──────────────────────────────────────────────────────────────────────

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

function sseError(message: string, status = 500): Response {
  const body = `data: ${JSON.stringify({ type: "error", message })}\n\n`;
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return sseError("ANTHROPIC_API_KEY is not set.", 503);
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return sseError("Invalid JSON body.", 400); }

  const b = body as Record<string, unknown>;
  const rawHistory = Array.isArray(b.messages) ? (b.messages as ConversationMessage[]) : [];
  const projectState = typeof b.projectState === "string" ? b.projectState : "{}";
  const memoryBlock = typeof b.memory === "string" ? b.memory : "";

  if (rawHistory.length === 0 || rawHistory[rawHistory.length - 1]?.role !== "user") {
    return sseError("Last message must be from user.", 400);
  }

  // Inject project state + memory into the last user message only
  const lastIndex = rawHistory.length - 1;
  const memorySection = memoryBlock.trim()
    ? `[MEMORY]\n${memoryBlock}\n\n`
    : "";
  const messages: Anthropic.MessageParam[] = rawHistory.map((m, i) => ({
    role: m.role,
    content:
      i === lastIndex
        ? `${memorySection}[PROJECT STATE]\n\`\`\`json\n${projectState}\n\`\`\`\n\n${m.content}`
        : m.content,
  }));

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller closed — ignore
        }
      };

      const msgStream = client.messages.stream({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools: TOOLS,
        messages,
      });

      msgStream.on("text", (delta: string) => {
        enqueue({ type: "text_delta", text: delta });
      });

      msgStream.on("finalMessage", (message: Anthropic.Message) => {
        const fullText = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");

        for (const block of message.content) {
          if (block.type === "tool_use") {
            enqueue({ type: "tool_use", name: block.name, input: block.input });
          }
        }

        enqueue({ type: "done", fullText });
        controller.close();
      });

      msgStream.on("error", (err: Error) => {
        enqueue({ type: "error", message: err.message });
        controller.close();
      });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
