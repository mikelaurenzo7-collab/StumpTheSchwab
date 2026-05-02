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
  app/           # Next.js pages + layout
  components/    # UI components (Transport, StepSequencer, SynthPanel)
  store/         # Zustand store (engine.ts = single source of truth)
  lib/           # Audio engine hook, sound definitions, WAV encoder
```

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run eslint

## Architecture Notes
- Audio engine runs client-side only via `useAudioEngine` hook (dynamic import of Tone.js)
- Tone.js requires user interaction before `Tone.start()` — handled by transport play button
- `Tone.Sequence` provides sample-accurate scheduling (replaces `setInterval`)
- Zustand store (`store/engine.ts`) is the single source of truth for sequencer state, playback, mixer, and macros
- Synths are created once on init and reused; per-track `Gain` nodes handle volume
- Sequence callback reads latest Zustand state each tick for real-time responsiveness
- Undo/redo uses snapshot-based history stack (50-deep); discrete actions push immediately, continuous controls push on pointer down
- WAV export uses `Tone.Offline` to render the pattern offline, then `lib/wav.ts` encodes to 16-bit PCM WAV
- Macros control real-time audio effects: bloom (filter cutoff), gravity (scale rotation), shimmer (delay send), fracture (distortion)
- Mute/solo per track: solo overrides mute; when any track is soloed, only soloed tracks play
- Keyboard shortcuts: Space (play/pause), R (generate), F (fracture), C (clear), E (export), Ctrl+Z/Cmd+Z (undo), Ctrl+Shift+Z/Cmd+Shift+Z (redo), Escape (stop)

## Design Tokens
Dark theme defined in `globals.css` — accent purple (#8b5cf6), track colors per instrument in `lib/sounds.ts`.
