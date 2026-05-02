# StumpTheSchwab

Web-based music production platform. Make better music, faster.

## Tech Stack
- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Audio**: Tone.js (Web Audio API)
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) for the song composer

## Project Structure
```
src/
  app/
    page.tsx                  # the studio: audio graph, sequencer, UI (one file)
    layout.tsx
    globals.css               # design tokens + cosmos theme
    api/generate/route.ts     # Claude-powered song composer (server-only)
```

The studio is a deliberate single-file app — audio graph, song arrangement,
React UI, and the offline WAV renderer all live in `src/app/page.tsx`. There
is no separate component / store / lib layer.

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run eslint

## Environment
- `ANTHROPIC_API_KEY` — required for the compose-with-Claude button. Set in
  `.env.local` for development. The key is server-only — the route handler at
  `src/app/api/generate/route.ts` is the only place that touches it.

## Architecture Notes

### Audio engine
- Tone.js requires user interaction before `Tone.start()` — handled by the
  ignite button (and the `Space` keyboard shortcut), which calls
  `ensureAudio` before flipping the playing flag.
- `buildAudioGraph()` constructs all synths + the master chain once and
  returns three handles: `voices`, `chain`, `sends`. Refs hold the live
  graph; React state drives parameter ramps via `useEffect`.
- Master chain order: `filter → sweepFilter → highpass → eq → saturator
  (Chebyshev order 2, "tape" warmth) → distortion → compressor → widener →
  limiter → destination`.
- Per-track routing: every voice fans out dry → ducker (kick is post-ducker so
  it doesn't pump itself) and reverb send → reverb → compressor. Pluck has
  its own ping-pong delay send.
- Pink-noise riser feeds the ducker so it pumps with the kick during builds.
- Pad signal path: `PolySynth(Synth, fatsawtooth) → padFilter (LFO-modulated
  cutoff) → chorus → widener → master`. Synth (not AMSynth) keeps CPU sane
  under chord-heavy load.
- Drum velocity: `stepAccent(voice, stepIdx)` produces per-step accent
  curves (kick: beat 1 strongest; snare: backbeat vs ghost; hat: quarter > 8th
  > 16th). Multiplied by track-level fader before triggering.
- Hat humanization: pitch cycles through 4 close notes + ±8% deterministic
  velocity wobble + soft pan drift, all keyed on a per-render `hatState.count`
  (so offline render is bit-reproducible).
- Snare humanization: body tone micro-detunes ±~25 cents around G2 with ±8%
  velocity wobble across noise/body/crack, keyed deterministically on
  `harmonyMeasure + stepIdx` (bit-reproducible across live + offline).
- Bass note duration adapts to the next-step gap: `16n` when the next 16th is
  also active, `8n` with one rest, `4n` with two or more rests.

### Song mode + arrangement
- `ARRANGEMENT` is a fixed 48-bar form: intro 4 / verse 8 / build 4 / drop 16
  / break 4 / drop2 8 / outro 4. Each section declares per-voice `{active,
  pattern}`.
- `applySectionTransition()` automates the master sweep filter and riser at
  section boundaries: intro swells from 3.5 kHz to 18 kHz across the 4-bar
  intro, build sweeps up + raises a pink-noise riser, drop slams to 18 kHz
  and zeroes the riser, break dips to 3.5 kHz, outro mirrors the intro by
  closing from 18 kHz down to 1.5 kHz over its 4 bars.
- `PAD_HOLD` triggers once per measure with a `1n` note length so chord
  changes cleanly re-attack the pad without stacking voices on the
  PolySynth's 5-voice ceiling.
- The last bar of every build replaces the snare pattern with all-16ths to
  produce the snare-roll fill, and the first kick of the drop fires an
  `isImpact` flag that adds a sub-bass boom on the chord root.

### Composer (`/api/generate`)
- Uses Claude (`claude-opus-4-7`) with `tool_choice: { type: "tool",
  name: "compose_song" }` to force structured output via a strict JSON schema.
- Note: `thinking` cannot be combined with forced `tool_choice` (the API
  rejects it with HTTP 400). Don't add it back.
- The system prompt is cached with `cache_control: ephemeral`.
- Returned spec drives `setSong` (key/mode/progression/pluckMotif/bassMotif)
  plus optional bpm / swing / macros / rationale.

### WAV export
- `Tone.Offline` renders the full arrangement + a 4-second tail offline at
  the current bpm/swing/macros snapshot. The result is converted to 16-bit
  PCM WAV in `audioBufferToWav` and downloaded directly.

### Keyboard
- `Space` toggles play/pause (ignored when focus is in `INPUT` / `TEXTAREA` /
  contentEditable so the compose textarea can contain spaces).

## Design Tokens
Dark cosmos theme defined in `globals.css` — accent purple (#8b5cf6) and
per-voice hue tokens on each track (`pulse` 270 / `glass` 318 / `dust` 190 /
`sub` 154 / `keys` 42 / `aura` 226).
