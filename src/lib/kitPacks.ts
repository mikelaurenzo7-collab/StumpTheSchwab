// ── Kit Packs ────────────────────────────────────────────────────────────────
// Each pack is a curated 8-voice drum + bass kit, hand-tuned via Tone.js
// synth params. The order MATCHES the default kit slots so a pack swap is a
// per-track sound replacement (kick → kick, snare → snare, …) without
// disturbing patterns or melodic notes already programmed.
//
// Sound-design notes per pack:
//   • Boom Bap     — woody kick, dusty snap, swung jazz hats, walking bass
//   • Lo-Fi Tape   — soft kick, brushed snare, rolled-off hats, mellow keys
//   • Trap 808     — sub-heavy kick, sharp clap, rolling hats, sustained 808
//   • Synthwave    — analog kick, gated snare, bright hats, FM bell, saw bass
//   • DnB Punch    — punchy kick, snare crack, ride-style hats, square reese
//   • House Drive  — tight kick, clap-snare, shuffled hats, sub-bass

import type { TrackSound } from "./sounds";

export interface KitPack {
  id: string;
  name: string;
  vibe: string;     // one-line mood line shown in picker
  bpm: number;      // recommended BPM (informational)
  swing: number;    // recommended swing
  sounds: TrackSound[]; // 8-voice kit, slot order matches DEFAULT_KIT
}

// Slot order across every pack (must match DEFAULT_KIT's first 8 entries):
//   0 Kick · 1 Snare · 2 Hi-Hat · 3 Open Hat · 4 Clap · 5 Tom · 6 Perc · 7 Bass

export const KIT_PACKS: KitPack[] = [
  {
    id: "boombap",
    name: "Boom Bap",
    vibe: "Dusty 90s sampler, woody kick, swung pocket",
    bpm: 90,
    swing: 0.35,
    sounds: [
      { name: "Kick", color: "#ef4444", synth: "membrane", note: "C1", melodic: false,
        // Wider pitch sweep + slightly longer body = vintage sampled-kick thump
        options: { pitchDecay: 0.06, octaves: 5, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.55, sustain: 0, release: 0.45 } } },
      { name: "Snare", color: "#f59e0b", synth: "noise", note: "8n", melodic: false,
        // Slightly longer decay = body, pink noise for warmer character.
        options: { noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.18 } } },
      { name: "Hi-Hat", color: "#22c55e", synth: "metal", note: "C6", melodic: false,
        // Lower harmonicity + lower mod index = darker hat ("brushed")
        options: { frequency: 220, envelope: { attack: 0.001, decay: 0.04, release: 0.012 }, harmonicity: 3.4, modulationIndex: 12, resonance: 5800, octaves: 1 } },
      { name: "Open Hat", color: "#06b6d4", synth: "metal", note: "C6", melodic: false,
        options: { frequency: 220, envelope: { attack: 0.001, decay: 0.32, release: 0.18 }, harmonicity: 3.4, modulationIndex: 12, resonance: 5800, octaves: 1 } },
      { name: "Clap", color: "#8b5cf6", synth: "noise", note: "32n", melodic: false,
        options: { noise: { type: "pink" }, envelope: { attack: 0.003, decay: 0.18, sustain: 0, release: 0.13 } } },
      { name: "Tom", color: "#ec4899", synth: "membrane", note: "G2", melodic: true, noteRange: ["C1", "C3"],
        options: { pitchDecay: 0.08, octaves: 3, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.25 } } },
      { name: "Rhodes", color: "#14b8a6", synth: "fm", note: "C5", melodic: true, noteRange: ["C3", "C6"],
        // Bell-Rhodes hybrid: triangle modulator gives that warm electric-piano vibe.
        options: { harmonicity: 3, modulationIndex: 6, envelope: { attack: 0.005, decay: 0.6, sustain: 0.2, release: 0.5 }, modulation: { type: "triangle" }, modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.2, release: 0.4 } } },
      { name: "Upright", color: "#6366f1", synth: "monosynth", note: "C2", melodic: true, noteRange: ["C1", "C3"],
        // Walking-bass tone: triangle, fast filter close = woody upright pluck.
        options: { oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.3 }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.3, baseFrequency: 80, octaves: 2.5 }, filter: { Q: 2, type: "lowpass", rolloff: -24 } } },
    ],
  },
  {
    id: "lofi",
    name: "Lo-Fi Tape",
    vibe: "Rainy day, dusty cassette, brushed snare",
    bpm: 78,
    swing: 0.4,
    sounds: [
      { name: "Kick", color: "#ef4444", synth: "membrane", note: "C1", melodic: false,
        // Soft, bandlimited kick — short pitch sweep, slow release.
        options: { pitchDecay: 0.08, octaves: 3, oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.55 } } },
      { name: "Snare", color: "#f59e0b", synth: "noise", note: "16n", melodic: false,
        options: { noise: { type: "brown" }, envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.2 } } },
      { name: "Hi-Hat", color: "#22c55e", synth: "metal", note: "C6", melodic: false,
        // Heavily rolled-off hats — that "tape lid closed" softness.
        options: { frequency: 180, envelope: { attack: 0.001, decay: 0.025, release: 0.008 }, harmonicity: 2.5, modulationIndex: 8, resonance: 4200, octaves: 1 } },
      { name: "Open Hat", color: "#06b6d4", synth: "metal", note: "C6", melodic: false,
        options: { frequency: 180, envelope: { attack: 0.001, decay: 0.25, release: 0.15 }, harmonicity: 2.5, modulationIndex: 8, resonance: 4200, octaves: 1 } },
      { name: "Clap", color: "#8b5cf6", synth: "noise", note: "32n", melodic: false,
        options: { noise: { type: "brown" }, envelope: { attack: 0.005, decay: 0.13, sustain: 0, release: 0.12 } } },
      { name: "Tom", color: "#ec4899", synth: "membrane", note: "F2", melodic: true, noteRange: ["C1", "C3"],
        options: { pitchDecay: 0.1, octaves: 2.5, oscillator: { type: "sine" }, envelope: { attack: 0.003, decay: 0.4, sustain: 0, release: 0.3 } } },
      { name: "Keys", color: "#14b8a6", synth: "am", note: "C5", melodic: true, noteRange: ["C3", "C6"],
        // AMSynth with sine carrier gives a soft, dusty Wurli-ish keyboard.
        options: { harmonicity: 2, oscillator: { type: "sine" }, modulation: { type: "sine" }, envelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 0.5 }, modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.4 } } },
      { name: "Sub", color: "#6366f1", synth: "monosynth", note: "C2", melodic: true, noteRange: ["C1", "C3"],
        // Sine bass with very low cutoff — felt-not-heard sub.
        options: { oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.4, sustain: 0.6, release: 0.5 }, filterEnvelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4, baseFrequency: 50, octaves: 2 }, filter: { Q: 1.5, type: "lowpass", rolloff: -24 } } },
    ],
  },
  {
    id: "trap",
    name: "Trap 808",
    vibe: "Sub-heavy 808, sharp clap, rolling hats",
    bpm: 140,
    swing: 0.18,
    sounds: [
      { name: "Kick", color: "#ef4444", synth: "membrane", note: "A0", melodic: false,
        // Trap kicks ride the line between kick and 808 — long body, deep tone.
        options: { pitchDecay: 0.05, octaves: 6, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.6 } } },
      { name: "Snare", color: "#f59e0b", synth: "noise", note: "16n", melodic: false,
        // Crisper, shorter snare — lets the clap layer do the heavy lifting.
        options: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.08 } } },
      { name: "Hi-Hat", color: "#22c55e", synth: "metal", note: "C6", melodic: false,
        // Brighter hats with a tighter decay so 32nd-note rolls stay defined.
        options: { frequency: 320, envelope: { attack: 0.001, decay: 0.04, release: 0.008 }, harmonicity: 5.1, modulationIndex: 24, resonance: 9000, octaves: 1 } },
      { name: "Open Hat", color: "#06b6d4", synth: "metal", note: "C6", melodic: false,
        options: { frequency: 320, envelope: { attack: 0.001, decay: 0.5, release: 0.25 }, harmonicity: 5.1, modulationIndex: 24, resonance: 9000, octaves: 1 } },
      { name: "Clap", color: "#8b5cf6", synth: "noise", note: "16n", melodic: false,
        // Bigger clap body for the "808 clap" sound that cuts through subs.
        options: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.15 } } },
      { name: "Tom", color: "#ec4899", synth: "membrane", note: "A1", melodic: true, noteRange: ["C1", "C3"],
        options: { pitchDecay: 0.05, octaves: 4, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 } } },
      { name: "Pluck", color: "#14b8a6", synth: "fm", note: "C5", melodic: true, noteRange: ["C4", "C7"],
        // Bright melodic pluck — the "trap flute" / bell-pluck space.
        options: { harmonicity: 4, modulationIndex: 8, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }, modulation: { type: "sine" }, modulationEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 } } },
      { name: "808", color: "#6366f1", synth: "monosynth", note: "A1", melodic: true, noteRange: ["A0", "C3"],
        // Iconic 808: long sustain, slight pitch sweep via filter env, sine-ish.
        options: { oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.3, sustain: 0.95, release: 0.6 }, filterEnvelope: { attack: 0.001, decay: 0.4, sustain: 0.7, release: 0.5, baseFrequency: 80, octaves: 2.5 }, filter: { Q: 0.5, type: "lowpass", rolloff: -24 } } },
    ],
  },
  {
    id: "synthwave",
    name: "Synthwave",
    vibe: "Analog kick, gated snare, FM bell, saw bass",
    bpm: 96,
    swing: 0,
    sounds: [
      { name: "Kick", color: "#ef4444", synth: "membrane", note: "C1", melodic: false,
        // Slow attack feel + medium sweep = LinnDrum/Simmons analog kick.
        options: { pitchDecay: 0.07, octaves: 4, oscillator: { type: "sine" }, envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.45 } } },
      { name: "Snare", color: "#f59e0b", synth: "noise", note: "8n", melodic: false,
        // Long-tail gated reverb era snare — body + brightness.
        options: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.22 } } },
      { name: "Hi-Hat", color: "#22c55e", synth: "metal", note: "C6", melodic: false,
        options: { frequency: 280, envelope: { attack: 0.001, decay: 0.06, release: 0.02 }, harmonicity: 4.5, modulationIndex: 18, resonance: 8000, octaves: 1 } },
      { name: "Open Hat", color: "#06b6d4", synth: "metal", note: "C6", melodic: false,
        options: { frequency: 280, envelope: { attack: 0.001, decay: 0.5, release: 0.3 }, harmonicity: 4.5, modulationIndex: 18, resonance: 8000, octaves: 1 } },
      { name: "Clap", color: "#8b5cf6", synth: "noise", note: "16n", melodic: false,
        options: { noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.18 } } },
      { name: "Tom", color: "#ec4899", synth: "membrane", note: "G2", melodic: true, noteRange: ["C1", "C3"],
        options: { pitchDecay: 0.06, octaves: 3.5, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 } } },
      { name: "Bell", color: "#14b8a6", synth: "fm", note: "C5", melodic: true, noteRange: ["C4", "C7"],
        // Crystal FM bell — high mod index, square modulator for that DX vibe.
        options: { harmonicity: 5, modulationIndex: 10, envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.6 }, modulation: { type: "square" }, modulationEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.4 } } },
      { name: "Saw", color: "#6366f1", synth: "monosynth", note: "C2", melodic: true, noteRange: ["C1", "C3"],
        // Classic detuned-feel saw bass with longer filter sustain for held notes.
        options: { oscillator: { type: "sawtooth" }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.3 }, filterEnvelope: { attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.3, baseFrequency: 80, octaves: 4 }, filter: { Q: 6, type: "lowpass", rolloff: -24 } } },
    ],
  },
  {
    id: "dnb",
    name: "DnB Punch",
    vibe: "Punchy kick, snare crack, ride hats, reese bass",
    bpm: 174,
    swing: 0,
    sounds: [
      { name: "Kick", color: "#ef4444", synth: "membrane", note: "C1", melodic: false,
        // Tight, punchy DnB kick — fast pitch decay so it hits without lingering.
        options: { pitchDecay: 0.025, octaves: 4, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.25 } } },
      { name: "Snare", color: "#f59e0b", synth: "noise", note: "8n", melodic: false,
        // Sharp Amen-style crack — short body, fast release.
        options: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.1 } } },
      { name: "Hi-Hat", color: "#22c55e", synth: "metal", note: "C6", melodic: false,
        options: { frequency: 300, envelope: { attack: 0.001, decay: 0.045, release: 0.01 }, harmonicity: 4.8, modulationIndex: 20, resonance: 8500, octaves: 1 } },
      { name: "Ride", color: "#06b6d4", synth: "metal", note: "C6", melodic: false,
        // Longer, rideable open hat — DnB needs that swung shimmer.
        options: { frequency: 300, envelope: { attack: 0.001, decay: 0.6, release: 0.4 }, harmonicity: 4.8, modulationIndex: 20, resonance: 8500, octaves: 1 } },
      { name: "Clap", color: "#8b5cf6", synth: "noise", note: "32n", melodic: false,
        options: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.09 } } },
      { name: "Tom", color: "#ec4899", synth: "membrane", note: "G2", melodic: true, noteRange: ["C1", "C3"],
        options: { pitchDecay: 0.05, octaves: 3, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 } } },
      { name: "Stab", color: "#14b8a6", synth: "fm", note: "C5", melodic: true, noteRange: ["C4", "C6"],
        // Sharp FM stab — useful for amen-era ragga lead lines.
        options: { harmonicity: 6, modulationIndex: 12, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }, modulation: { type: "square" }, modulationEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 } } },
      { name: "Reese", color: "#6366f1", synth: "monosynth", note: "A1", melodic: true, noteRange: ["A0", "C3"],
        // Reese: square wave, low resonance, long sustain — that growling DnB bass.
        options: { oscillator: { type: "square" }, envelope: { attack: 0.005, decay: 0.3, sustain: 0.85, release: 0.3 }, filterEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.8, release: 0.3, baseFrequency: 60, octaves: 3 }, filter: { Q: 3, type: "lowpass", rolloff: -24 } } },
    ],
  },
  {
    id: "house",
    name: "House Drive",
    vibe: "Tight kick, clap-snare, shuffled hats, sub-bass",
    bpm: 124,
    swing: 0.08,
    sounds: [
      { name: "Kick", color: "#ef4444", synth: "membrane", note: "C1", melodic: false,
        // Four-on-the-floor punch — short body, fast release so kicks stay distinct.
        options: { pitchDecay: 0.03, octaves: 4, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 } } },
      { name: "Clap-Snare", color: "#f59e0b", synth: "noise", note: "16n", melodic: false,
        // Short white-noise clap layered with snare-ish decay — the classic 909 vibe.
        options: { noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.12 } } },
      { name: "Hi-Hat", color: "#22c55e", synth: "metal", note: "C6", melodic: false,
        options: { frequency: 260, envelope: { attack: 0.001, decay: 0.05, release: 0.012 }, harmonicity: 4.2, modulationIndex: 16, resonance: 7400, octaves: 1 } },
      { name: "Open Hat", color: "#06b6d4", synth: "metal", note: "C6", melodic: false,
        // Longer open hat for those classic 909 off-beat shimmer offbeats.
        options: { frequency: 260, envelope: { attack: 0.001, decay: 0.55, release: 0.3 }, harmonicity: 4.2, modulationIndex: 16, resonance: 7400, octaves: 1 } },
      { name: "Clap", color: "#8b5cf6", synth: "noise", note: "16n", melodic: false,
        options: { noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.14 } } },
      { name: "Conga", color: "#ec4899", synth: "membrane", note: "C3", melodic: true, noteRange: ["C2", "C4"],
        options: { pitchDecay: 0.04, octaves: 2.5, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 } } },
      { name: "Stab", color: "#14b8a6", synth: "am", note: "C5", melodic: true, noteRange: ["C4", "C6"],
        // House stab — bright, short, percussive. AM gives that classic vocal-ish quality.
        options: { harmonicity: 3, oscillator: { type: "sawtooth" }, modulation: { type: "square" }, envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.15 }, modulationEnvelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 } } },
      { name: "Sub Bass", color: "#6366f1", synth: "monosynth", note: "C2", melodic: true, noteRange: ["C1", "C3"],
        // Deep sine sub — the foundation of any house track.
        options: { oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.7, release: 0.25 }, filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.3, baseFrequency: 70, octaves: 3 }, filter: { Q: 2, type: "lowpass", rolloff: -24 } } },
    ],
  },
];

export function findKitPack(id: string): KitPack | undefined {
  return KIT_PACKS.find((p) => p.id === id);
}
