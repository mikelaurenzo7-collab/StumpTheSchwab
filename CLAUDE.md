# StumpTheSchwab

Web-based music production platform. Make better music, faster.

## Tech Stack
- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Audio**: Tone.js (Web Audio API)
- **State**: Zustand v5
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) for the beat generator

## Project Structure
```
src/
  app/                 # Next.js pages + layout
    api/generate/      # AI beat generator route (Claude tool use)
  components/          # UI components (Transport, StepSequencer, MacroPanel)
  store/engine.ts      # Zustand store — single source of truth
  lib/
    sounds.ts          # Types, voice definitions, default tracks
    useAudioEngine.ts  # Tone.js Transport + synths + WAV export
```

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run eslint

## Environment
- `ANTHROPIC_API_KEY` — required for the AI beat generator (Generate button / `G` key). Set in `.env.local` for development. The key is server-only — the route handler at `src/app/api/generate/route.ts` is the only place that touches it.

## Architecture Notes
- Audio engine runs client-side only via `useAudioEngine` hook (lazy-inits Tone.js on first play)
- Tone.js Transport provides sample-accurate step scheduling (replaces setInterval)
- Tone.js `Draw` syncs visual step indicator to audio clock via requestAnimationFrame
- Zustand store (with `subscribeWithSelector`) is the single source of truth for sequencer state, playback, and mixer
- Per-voice Tone.js synths: MembraneSynth (kick), NoiseSynth (snare), MetalSynth (hat), MonoSynth (bass), Synth (pluck), FMSynth (pad)
- Signal chain: Synth → Filter → Channel → Compressor → Limiter → Destination, with parallel sends to FeedbackDelay and Reverb
- Store subscriptions sync BPM/swing → Transport, track levels → Channel volumes, macros → filter cutoffs and FX wet amounts in real time
- Mute/solo logic: if any track is soloed, only soloed tracks are audible; otherwise muted tracks are silenced
- Undo/redo uses snapshot-based history stack in Zustand (discrete actions push immediately, continuous controls snapshot on mousedown)
- WAV export uses `Tone.Offline` to render the pattern offline, then converts to 16-bit PCM WAV
- AI beat generator: server route `/api/generate` uses Claude (Opus 4.7 + tool use with forced tool choice) to convert a text prompt into a `GeneratedBeat`, which `applyGeneratedBeat` writes into the active pattern. System prompt is cached (`cache_control: ephemeral`)
- Keyboard shortcuts: Space (play/pause), Escape (stop), R (regenerate), M (mutate), E (export), G (generate), Ctrl+Z / Ctrl+Shift+Z (undo/redo)
- Macros control synthesis in real time: bloom → filter cutoff, shimmer → delay/reverb send, gravity → pitch modulation, fracture → mutation probability

## Design Tokens
Dark theme defined in `globals.css` — accent purple (#8b5cf6), track colors per instrument in `lib/sounds.ts`.
