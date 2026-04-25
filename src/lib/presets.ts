// ── Pattern Presets ────────────────────────────────────────────
// Each preset is a 2D array: [trackIndex][stepIndex] = velocity (0 or 0.25–1.0)
// All presets are 16 steps. When loaded into a different step count,
// they repeat or truncate as needed.

export interface PatternPreset {
  name: string;
  bpm: number;
  swing: number;
  steps: number; // totalSteps this pattern is designed for
  // tracks[trackIndex][stepIndex] = velocity
  // Track order: Kick, Snare, Hi-Hat, Open Hat, Clap, Tom, Perc, Bass
  tracks: number[][];
}

const _ = 0;
const F = 1.0;   // Full
const H = 0.75;  // High
const M = 0.5;   // Med
const S = 0.25;  // Soft

export const PRESETS: PatternPreset[] = [
  {
    name: "Basic Rock",
    bpm: 120,
    swing: 0,
    steps: 16,
    tracks: [
      // Kick:     1 . . . | . . . . | 1 . . . | . . . .
      [F,_,_,_,  _,_,_,_,  F,_,_,_,  _,_,_,_],
      // Snare:    . . . . | 1 . . . | . . . . | 1 . . .
      [_,_,_,_,  F,_,_,_,  _,_,_,_,  F,_,_,_],
      // Hi-Hat:   1 . 1 . | 1 . 1 . | 1 . 1 . | 1 . 1 .
      [H,_,M,_,  H,_,M,_,  H,_,M,_,  H,_,M,_],
      // Open Hat: . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Clap:     . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Tom:      . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Perc:     . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Bass:     1 . . . | . . 1 . | 1 . . . | . . . .
      [F,_,_,_,  _,_,H,_,  F,_,_,_,  _,_,_,_],
    ],
  },
  {
    name: "Boom Bap",
    bpm: 90,
    swing: 0.35,
    steps: 16,
    tracks: [
      // Kick:     1 . . . | . . . . | . . 1 . | . . . .
      [F,_,_,_,  _,_,_,_,  _,_,F,_,  _,_,_,_],
      // Snare:    . . . . | 1 . . . | . . . . | 1 . . .
      [_,_,_,_,  F,_,_,_,  _,_,_,_,  F,_,_,_],
      // Hi-Hat:   1 . 1 . | 1 . 1 . | 1 . 1 . | 1 . 1 .
      [H,_,S,_,  H,_,S,_,  H,_,S,_,  H,_,S,_],
      // Open Hat: . . . . | . . . 1 | . . . . | . . . .
      [_,_,_,_,  _,_,_,H,  _,_,_,_,  _,_,_,_],
      // Clap:     . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Tom:      . . . . | . . . . | . . . . | . . . S
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,S],
      // Perc:     . . . . | . . . . | . M . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,M,_,_,  _,_,_,_],
      // Bass:     1 . . . | . . . . | . . 1 . | . . . H
      [F,_,_,_,  _,_,_,_,  _,_,H,_,  _,_,_,M],
    ],
  },
  {
    name: "Four on the Floor",
    bpm: 128,
    swing: 0,
    steps: 16,
    tracks: [
      // Kick:     1 . . . | 1 . . . | 1 . . . | 1 . . .
      [F,_,_,_,  F,_,_,_,  F,_,_,_,  F,_,_,_],
      // Snare:    . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Hi-Hat:   1 . 1 . | 1 . 1 . | 1 . 1 . | 1 . 1 .
      [H,_,H,_,  H,_,H,_,  H,_,H,_,  H,_,H,_],
      // Open Hat: . . . . | . . . 1 | . . . . | . . . 1
      [_,_,_,_,  _,_,_,H,  _,_,_,_,  _,_,_,H],
      // Clap:     . . . . | 1 . . . | . . . . | 1 . . .
      [_,_,_,_,  F,_,_,_,  _,_,_,_,  F,_,_,_],
      // Tom:      . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Perc:     . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Bass:     1 . . . | . . . . | 1 . . . | . . 1 .
      [F,_,_,_,  _,_,_,_,  F,_,_,_,  _,_,H,_],
    ],
  },
  {
    name: "Trap",
    bpm: 140,
    swing: 0,
    steps: 32,
    tracks: [
      // Kick — heavy 808 pattern
      [F,_,_,_,_,_,_,_,  _,_,_,_,F,_,_,_,  _,_,_,_,_,_,F,_,  _,_,_,_,_,_,_,_],
      // Snare — on the 3
      [_,_,_,_,_,_,_,_,  F,_,_,_,_,_,_,_,  _,_,_,_,_,_,_,_,  F,_,_,_,_,_,_,_],
      // Hi-Hat — rapid rolls
      [H,_,H,_,H,_,H,_,  H,_,H,S,H,S,H,S,  H,_,H,_,H,_,H,_,  H,S,H,S,H,S,H,S],
      // Open Hat
      [_,_,_,_,_,_,_,_,  _,_,_,_,_,_,_,_,  _,_,_,_,_,_,_,_,  _,_,_,_,_,_,_,H],
      // Clap — layered with snare
      [_,_,_,_,_,_,_,_,  F,_,_,_,_,_,_,_,  _,_,_,_,_,_,_,_,  F,_,_,_,_,_,_,_],
      // Tom
      [_,_,_,_,_,_,_,_,  _,_,_,_,_,_,_,_,  _,_,_,_,_,_,_,_,  _,_,_,_,_,_,_,_],
      // Perc — sparse
      [_,_,_,_,_,_,_,_,  _,_,_,_,_,_,M,_,  _,_,_,_,_,_,_,_,  _,_,_,_,_,_,M,_],
      // Bass — 808 bass
      [F,_,_,_,_,_,_,_,  _,_,_,_,F,_,_,_,  _,_,_,_,_,_,H,_,  _,_,_,_,_,_,_,_],
    ],
  },
  {
    name: "Breakbeat",
    bpm: 135,
    swing: 0.15,
    steps: 16,
    tracks: [
      // Kick:     1 . . . | . . . . | . . 1 . | 1 . . .
      [F,_,_,_,  _,_,_,_,  _,_,F,_,  F,_,_,_],
      // Snare:    . . . . | 1 . . . | . . . . | 1 . . H
      [_,_,_,_,  F,_,_,_,  _,_,_,_,  F,_,_,H],
      // Hi-Hat:   1 1 1 1 | 1 1 1 1 | 1 1 1 1 | 1 1 1 1
      [H,M,H,M,  H,S,H,M,  H,M,H,M,  H,S,H,M],
      // Open Hat: . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Clap:     . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Tom:      . . . . | . . . . | . . . . | . . M .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,M,_],
      // Perc:     . . M . | . . . . | . . M . | . . . .
      [_,_,M,_,  _,_,_,_,  _,_,M,_,  _,_,_,_],
      // Bass:     1 . . . | . . . H | . . 1 . | . . . .
      [F,_,_,_,  _,_,_,H,  _,_,F,_,  _,_,_,_],
    ],
  },
  {
    name: "Reggaeton",
    bpm: 95,
    swing: 0,
    steps: 16,
    tracks: [
      // Kick:     1 . . 1 | . . . . | 1 . . 1 | . . . .
      [F,_,_,H,  _,_,_,_,  F,_,_,H,  _,_,_,_],
      // Snare:    . . . . | 1 . . . | . . . . | 1 . . .
      [_,_,_,_,  F,_,_,_,  _,_,_,_,  F,_,_,_],
      // Hi-Hat:   1 . 1 . | 1 . 1 . | 1 . 1 . | 1 . 1 .
      [H,_,M,_,  H,_,M,_,  H,_,M,_,  H,_,M,_],
      // Open Hat: . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Clap:     . . . . | 1 . . . | . . . . | 1 . . .
      [_,_,_,_,  F,_,_,_,  _,_,_,_,  F,_,_,_],
      // Tom:      . . . . | . . . . | . . . . | . . . .
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Perc:     . . . . | . . M . | . . . . | . . M .
      [_,_,_,_,  _,_,M,_,  _,_,_,_,  _,_,M,_],
      // Bass:     1 . . H | . . . . | 1 . . H | . . . .
      [F,_,_,H,  _,_,_,_,  F,_,_,H,  _,_,_,_],
    ],
  },
  {
    name: "Lo-fi Chill",
    bpm: 78,
    swing: 0.35,
    steps: 16,
    tracks: [
      // Kick — lazy, behind the beat
      [F,_,_,_,  _,_,_,_,  _,_,F,_,  _,_,_,_],
      // Snare — soft, ghosty
      [_,_,_,S,  F,_,_,_,  _,S,_,_,  H,_,_,S],
      // Hi-Hat — swung 8ths with ghost notes
      [H,_,S,_,  M,_,S,_,  H,_,S,_,  M,_,S,_],
      // Open Hat
      [_,_,_,_,  _,_,_,S,  _,_,_,_,  _,_,_,_],
      // Clap
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Tom — subtle fill at bar end
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,S,M],
      // Perc — vinyl crackle flavor
      [_,_,_,_,  _,_,S,_,  _,_,_,_,  _,S,_,_],
      // Bass — jazzy minor 7th walk
      [H,_,_,_,  _,_,M,_,  _,_,H,_,  _,_,_,M],
    ],
  },
  {
    name: "Deep House",
    bpm: 122,
    swing: 0,
    steps: 16,
    tracks: [
      // Kick — 4 on floor
      [F,_,_,_,  F,_,_,_,  F,_,_,_,  F,_,_,_],
      // Snare
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Hi-Hat — steady 16ths with velocity dynamics
      [M,S,M,S,  H,S,M,S,  M,S,M,S,  H,S,M,S],
      // Open Hat — off-beat pulse
      [_,_,_,_,  _,_,_,H,  _,_,_,_,  _,_,_,H],
      // Clap — on 2 and 4
      [_,_,_,_,  F,_,_,_,  _,_,_,_,  F,_,_,_],
      // Tom
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Perc — shaker-style 16ths
      [S,_,S,_,  S,_,S,_,  S,_,S,_,  S,_,S,M],
      // Bass — rolling bassline
      [H,_,_,M,  _,_,H,_,  _,M,_,_,  H,_,_,_],
    ],
  },
  {
    name: "Techno",
    bpm: 130,
    swing: 0,
    steps: 16,
    tracks: [
      // Kick — driving 4/4
      [F,_,_,_,  F,_,_,_,  F,_,_,_,  F,_,_,_],
      // Snare — rimshot on offbeats
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,M,_],
      // Hi-Hat — relentless 16ths
      [H,M,H,M,  H,M,H,M,  H,M,H,M,  H,M,H,M],
      // Open Hat
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Clap — sparse, on 2 and 4
      [_,_,_,_,  F,_,_,_,  _,_,_,_,  F,_,_,_],
      // Tom — industrial accent
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,M,_,_],
      // Perc — metallic stab
      [_,_,M,_,  _,_,_,_,  _,_,M,_,  _,_,_,_],
      // Bass — pulsing root note
      [F,_,_,_,  _,_,F,_,  F,_,_,_,  _,_,F,_],
    ],
  },
  {
    name: "Drum & Bass",
    bpm: 174,
    swing: 0,
    steps: 16,
    tracks: [
      // Kick — syncopated Amen-style
      [F,_,_,_,  _,_,_,_,  _,_,F,_,  _,_,_,_],
      // Snare — classic DnB backbeat
      [_,_,_,_,  F,_,_,H,  _,_,_,_,  F,_,_,_],
      // Hi-Hat — fast 16ths
      [H,M,H,M,  H,M,H,M,  H,M,H,M,  H,M,H,M],
      // Open Hat
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,H],
      // Clap
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Tom — fill accents
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,M,_,M],
      // Perc — neuro stab
      [_,_,M,_,  _,_,_,_,  _,_,_,S,  _,_,_,_],
      // Bass — reese sub
      [F,_,_,_,  _,_,_,_,  _,_,H,_,  _,_,_,M],
    ],
  },
  {
    name: "Afrobeat",
    bpm: 108,
    swing: 0.15,
    steps: 16,
    tracks: [
      // Kick — polyrhythmic pattern
      [F,_,_,_,  _,_,H,_,  _,_,F,_,  _,_,_,_],
      // Snare — cross-stick ghost notes
      [_,_,S,_,  F,_,_,S,  _,_,S,_,  F,_,_,_],
      // Hi-Hat — bell-like pattern
      [H,_,H,S,  H,_,H,S,  H,_,H,S,  H,_,H,S],
      // Open Hat
      [_,_,_,_,  _,_,_,H,  _,_,_,_,  _,_,_,_],
      // Clap — accent on 2/4
      [_,_,_,_,  H,_,_,_,  _,_,_,_,  H,_,_,_],
      // Tom — talking drum fills
      [_,_,_,M,  _,_,_,_,  _,M,_,_,  _,_,M,_],
      // Perc — shekere pattern
      [M,_,S,_,  M,S,_,_,  M,_,S,_,  M,S,_,S],
      // Bass — afro bass groove
      [F,_,_,_,  _,_,H,_,  _,_,F,_,  _,M,_,_],
    ],
  },
  {
    name: "Ambient",
    bpm: 72,
    swing: 0.2,
    steps: 16,
    tracks: [
      // Kick — minimal
      [M,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Snare
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Hi-Hat — sparse whispers
      [_,_,_,_,  S,_,_,_,  _,_,_,_,  _,_,S,_],
      // Open Hat
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Clap
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Tom — spacious hits
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,S],
      // Perc — bell-like tones
      [_,_,_,S,  _,_,_,_,  _,S,_,_,  _,_,_,_],
      // Bass — slow pad
      [M,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
    ],
  },
  {
    name: "Funk",
    bpm: 110,
    swing: 0.2,
    steps: 16,
    tracks: [
      // Kick — syncopated funk
      [F,_,_,_,  _,_,_,_,  _,_,F,_,  _,F,_,_],
      // Snare — backbeat with ghosts
      [_,_,S,_,  F,_,_,S,  _,S,_,_,  F,_,_,_],
      // Hi-Hat — 16th funk groove
      [H,S,H,S,  H,S,H,S,  H,S,H,S,  H,S,H,S],
      // Open Hat
      [_,_,_,_,  _,_,_,H,  _,_,_,_,  _,_,_,_],
      // Clap — layered snare
      [_,_,_,_,  H,_,_,_,  _,_,_,_,  H,_,_,_],
      // Tom
      [_,_,_,_,  _,_,_,_,  _,_,_,_,  _,_,_,_],
      // Perc — clavinet stab
      [_,_,M,_,  _,_,_,M,  _,_,M,_,  _,_,_,_],
      // Bass — slap bass line
      [F,_,_,M,  _,_,H,_,  _,M,F,_,  _,H,_,M],
    ],
  },
];
