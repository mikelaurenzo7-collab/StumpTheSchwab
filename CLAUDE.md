# StumpTheSchwab

Web-based music production platform. Make better music, faster.

## Tech Stack
- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Audio**: Tone.js (Web Audio API)
- **State**: Zustand v5

## Project Structure
```
src/
  app/           # Next.js pages + layout
  components/    # UI components (Transport, StepSequencer, Mixer)
  store/         # Zustand stores (engine.ts = core state)
  lib/           # Audio engine hook, sound definitions
```

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run eslint

## Architecture Notes
- Audio engine runs client-side only via `useAudioEngine` hook
- Tone.js requires user interaction before `Tone.start()` — handled by transport play button
- Zustand store is the single source of truth for sequencer state, playback, and mixer
- Synths are created once on init and reused; gain nodes handle per-track volume/mute/solo
- Step sequencer reads latest store state each tick for real-time responsiveness
- Undo/redo uses snapshot-based history stack in Zustand (discrete actions push immediately, continuous controls throttle at 500ms)
- WAV export uses `Tone.Offline` to render the pattern offline, then converts to 16-bit PCM WAV
- Step probability: each step has a 0–100% trigger chance, rolled per tick during playback and export

## Design Tokens
Dark theme defined in `globals.css` — accent purple (#8b5cf6), track colors per instrument in `lib/sounds.ts`.
