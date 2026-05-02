# StumpTheSchwab

A web-based music production platform — a single-page **radial studio** that
composes, sequences, plays, and renders electronic music in the browser.

## What's in the box

- **Radial 16-step sequencer** — six concentric rings, one per voice
  (kick / snare / hat / bass / pluck / pad). Click cells to edit; the playhead
  spins from the center.
- **Tone.js audio engine** — synthesized voices with a full master chain:
  bloom filter, section sweep, EQ3, Chebyshev "tape" saturator, distortion,
  multiband compressor, stereo widener, brick-wall limiter, and a kick-driven
  ducker for sidechain pump.
- **Song mode** — a fixed 7-section arrangement (intro → verse → build →
  drop → break → drop2 → outro, 48 bars). The engine handles section
  transitions: build sweep + pink-noise riser, drop impact (sub-bass boom +
  filter reset), break filter dip, snare-roll fill on the last bar of the
  build.
- **Compose with Claude** — describe a vibe in plain English and the
  `/api/generate` route returns a full song spec (key, mode, 4-chord
  progression, 16-step pluck and bass motifs, BPM, swing, macros).
- **WAV render** — `Tone.Offline` renders the full song offline and
  downloads a 16-bit stereo WAV.
- **Four macros** — bloom (master brightness), gravity (sub-bass weight),
  shimmer (reverb send), fracture (master distortion).

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), hit **ignite** (or
press `Space`), and the orb spins up.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** for the dark cosmos theme
- **Tone.js** for everything audio
- **Anthropic SDK** (`@anthropic-ai/sdk`) for the composer

## Project structure

```
src/
  app/
    page.tsx                  # the studio (audio graph + UI in one file)
    layout.tsx
    globals.css               # design tokens + cosmos theme
    api/generate/route.ts     # Claude-powered song composer
```

## Environment

Set `ANTHROPIC_API_KEY` in `.env.local` for the **compose** button. The key is
server-only — the route handler at `src/app/api/generate/route.ts` is the only
place that touches it.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — run eslint

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
