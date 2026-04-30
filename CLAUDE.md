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
  app/              # Next.js pages + layout
    api/generate/   # AI beat generator route handler
  components/       # UI components (Transport, StepSequencer, Mixer, MacroPanel, AIGenerator, Visualizer)
  store/            # Zustand store (engine.ts = core state, undo/redo, patterns)
  lib/              # Audio engine hook (useAudioEngine.ts), sound/track definitions (sounds.ts)
```

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run eslint

## Environment
- `ANTHROPIC_API_KEY` — required for the AI beat generator (Generate button / `G` key). Set in `.env.local` for development. The key is server-only — the route handler at `src/app/api/generate/route.ts` is the only place that touches it.

## Architecture Notes
- Audio engine runs client-side only via `useAudioEngine` hook (src/lib/useAudioEngine.ts)
- Tone.js requires user interaction before `Tone.start()` — handled by transport play button
- Tone.js Transport + Sequence provides sample-accurate scheduling (no setInterval drift)
- Zustand store with `subscribeWithSelector` middleware is the single source of truth for all state
- 8 tracks: kick, snare, hat, clap, bass, pluck, perc, pad — each with dedicated Tone.js synth voices
- 4 pattern slots — switch between patterns with number keys 1-4
- Synths are created once on init and reused; Tone.Channel handles per-track volume/pan
- FeedbackDelay + Reverb as send effects, controlled by the Shimmer macro
- Step sequencer reads latest store state each tick via `useEngine.getState()` for real-time responsiveness
- Undo/redo uses snapshot-based history stack in Zustand (max 64 snapshots)
- WAV export uses `Tone.Offline` to render the pattern offline, then converts to 16-bit PCM WAV
- Step probability: each step has a 0–100% trigger chance, rolled per tick during playback and export
- Mute/Solo per track — solo is exclusive (only soloed tracks play when any track is soloed)
- Keyboard shortcuts: Space (play/pause), Esc (stop), 1-4 (patterns), Ctrl+Z/Y (undo/redo), Ctrl+E (export)
- AI beat generator: server route `/api/generate` uses Claude (Opus 4.7 + tool use with strict schema) to convert a text prompt into a `GeneratedBeat`, which `applyGeneratedBeat` writes into the current pattern slot. System prompt is cached (`cache_control: ephemeral`)

## Design Tokens
Dark theme defined in `globals.css` — accent purple (#8b5cf6), track colors per instrument in `lib/sounds.ts`.
