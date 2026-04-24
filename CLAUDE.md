@AGENTS.md

# StumpTheSchwab

Browser-based music production platform. Make it easier to produce higher quality music.

## Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 (dark-only DAW theme)
- Tone.js (Web Audio engine)
- Zustand (state management)

## Architecture
Three-layer separation:
1. **Engine** (`src/engine/`) — Tone.js objects live here, outside React. Never store audio nodes in state.
2. **Store** (`src/store/`) — Zustand holds plain serializable data. Actions call into the engine.
3. **UI** (`src/components/`) — React reads store, dispatches actions. Never imports Tone.js directly.

Tone.js is loaded client-side only via `dynamic()` with `ssr: false` on the root page.

## Commands
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — eslint

## Key Directories
- `src/engine/` — Audio engine (Tone.js wrapper)
- `src/store/` — Zustand DAW store
- `src/components/transport/` — Transport bar
- `src/components/tracks/` — Track lanes
- `src/components/timeline/` — Arrangement view
- `src/components/mixer/` — Mixer panel
- `src/types/` — TypeScript interfaces
