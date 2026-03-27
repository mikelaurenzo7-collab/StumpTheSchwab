// ============================================================================
// NOVA DAW - Synthesizer Preset Library
// Complete preset definitions for all synth parameters
// ============================================================================

export const SYNTH_PRESETS = {

  // ==========================================================================
  // LEADS
  // ==========================================================================
  leads: [
    {
      name: 'Classic Saw Lead',
      category: 'leads',
      tags: ['bright', 'analog', 'detuned'],
      params: {
        osc1: { type: 'sawtooth', detune: -12, gain: 0.7 },
        osc2: { type: 'sawtooth', detune: 12, gain: 0.7 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 3500, resonance: 2, envAmount: 2500 },
        filterEnv: { attack: 0.005, decay: 0.4, sustain: 0.35, release: 0.3 },
        ampEnv: { attack: 0.005, decay: 0.1, sustain: 0.85, release: 0.25 },
        lfo: { type: 'sine', rate: 5, amount: 0, destination: 'filter' },
        portamento: 0,
        voices: 4
      }
    },
    {
      name: 'Acid Lead',
      category: 'leads',
      tags: ['acid', '303', 'resonant'],
      params: {
        osc1: { type: 'square', detune: 0, gain: 0.9 },
        osc2: { type: 'sawtooth', detune: 0, gain: 0.3 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.75,
        filter: { type: 'lowpass', cutoff: 800, resonance: 14, envAmount: 6000 },
        filterEnv: { attack: 0.001, decay: 0.2, sustain: 0.05, release: 0.15 },
        ampEnv: { attack: 0.001, decay: 0.15, sustain: 0.7, release: 0.1 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0.05,
        voices: 1
      }
    },
    {
      name: 'Supersaw Lead',
      category: 'leads',
      tags: ['trance', 'bright', 'huge', 'detuned'],
      params: {
        osc1: { type: 'sawtooth', detune: -25, gain: 0.8 },
        osc2: { type: 'sawtooth', detune: 25, gain: 0.8 },
        sub: { enabled: true, type: 'sawtooth', gain: 0.2 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 6000, resonance: 1.5, envAmount: 3000 },
        filterEnv: { attack: 0.01, decay: 0.5, sustain: 0.6, release: 0.4 },
        ampEnv: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.35 },
        lfo: { type: 'sine', rate: 0.3, amount: 200, destination: 'filter' },
        portamento: 0,
        voices: 6
      }
    },
    {
      name: 'Pluck Lead',
      category: 'leads',
      tags: ['pluck', 'short', 'percussive'],
      params: {
        osc1: { type: 'sawtooth', detune: 0, gain: 0.8 },
        osc2: { type: 'square', detune: 5, gain: 0.5 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: true, type: 'white', gain: 0.05 },
        oscMix: 0.6,
        filter: { type: 'lowpass', cutoff: 600, resonance: 3, envAmount: 5000 },
        filterEnv: { attack: 0.001, decay: 0.15, sustain: 0.0, release: 0.1 },
        ampEnv: { attack: 0.001, decay: 0.3, sustain: 0.0, release: 0.15 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0,
        voices: 4
      }
    },
    {
      name: 'Funky Lead',
      category: 'leads',
      tags: ['funk', 'warm', 'punchy'],
      params: {
        osc1: { type: 'square', detune: 0, gain: 0.7 },
        osc2: { type: 'sawtooth', detune: 3, gain: 0.6 },
        sub: { enabled: true, type: 'sine', gain: 0.15 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.55,
        filter: { type: 'lowpass', cutoff: 2200, resonance: 4, envAmount: 2000 },
        filterEnv: { attack: 0.03, decay: 0.25, sustain: 0.4, release: 0.2 },
        ampEnv: { attack: 0.02, decay: 0.15, sustain: 0.75, release: 0.2 },
        lfo: { type: 'sine', rate: 6, amount: 150, destination: 'filter' },
        portamento: 0.02,
        voices: 2
      }
    },
    {
      name: 'Screaming Lead',
      category: 'leads',
      tags: ['aggressive', 'distortion', 'resonant'],
      params: {
        osc1: { type: 'sawtooth', detune: -7, gain: 0.9 },
        osc2: { type: 'sawtooth', detune: 7, gain: 0.9 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: true, type: 'white', gain: 0.04 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 1800, resonance: 16, envAmount: 4500 },
        filterEnv: { attack: 0.005, decay: 0.3, sustain: 0.5, release: 0.25 },
        ampEnv: { attack: 0.003, decay: 0.05, sustain: 0.95, release: 0.2 },
        lfo: { type: 'sine', rate: 5.5, amount: 300, destination: 'filter' },
        portamento: 0.03,
        voices: 2
      }
    },
    {
      name: 'Ethereal Lead',
      category: 'leads',
      tags: ['soft', 'dreamy', 'ambient'],
      params: {
        osc1: { type: 'triangle', detune: -5, gain: 0.6 },
        osc2: { type: 'sine', detune: 5, gain: 0.7 },
        sub: { enabled: true, type: 'sine', gain: 0.2 },
        noise: { enabled: true, type: 'white', gain: 0.02 },
        oscMix: 0.45,
        filter: { type: 'lowpass', cutoff: 2800, resonance: 2, envAmount: 1500 },
        filterEnv: { attack: 0.3, decay: 0.6, sustain: 0.5, release: 0.8 },
        ampEnv: { attack: 0.25, decay: 0.3, sustain: 0.7, release: 1.0 },
        lfo: { type: 'sine', rate: 0.8, amount: 400, destination: 'filter' },
        portamento: 0.08,
        voices: 6
      }
    },
    {
      name: 'Retro Lead',
      category: 'leads',
      tags: ['retro', '80s', 'square', 'pwm'],
      params: {
        osc1: { type: 'square', detune: -15, gain: 0.7 },
        osc2: { type: 'square', detune: 15, gain: 0.7 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 3000, resonance: 3, envAmount: 1800 },
        filterEnv: { attack: 0.01, decay: 0.35, sustain: 0.45, release: 0.3 },
        ampEnv: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.25 },
        lfo: { type: 'sine', rate: 4.5, amount: 100, destination: 'pitch' },
        portamento: 0.04,
        voices: 2
      }
    }
  ],

  // ==========================================================================
  // BASSES
  // ==========================================================================
  basses: [
    {
      name: 'Sub Bass',
      category: 'basses',
      tags: ['sub', 'deep', 'clean', 'sine'],
      params: {
        osc1: { type: 'sine', detune: 0, gain: 1.0 },
        osc2: { type: 'sine', detune: 0, gain: 0 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 1.0,
        filter: { type: 'lowpass', cutoff: 400, resonance: 0, envAmount: 200 },
        filterEnv: { attack: 0.001, decay: 0.15, sustain: 0.8, release: 0.1 },
        ampEnv: { attack: 0.003, decay: 0.05, sustain: 1.0, release: 0.08 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0,
        voices: 1
      }
    },
    {
      name: 'Reese Bass',
      category: 'basses',
      tags: ['reese', 'dnb', 'detuned', 'dark'],
      params: {
        osc1: { type: 'sawtooth', detune: -12, gain: 0.8 },
        osc2: { type: 'sawtooth', detune: 12, gain: 0.8 },
        sub: { enabled: true, type: 'sine', gain: 0.35 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 700, resonance: 4, envAmount: 800 },
        filterEnv: { attack: 0.005, decay: 0.4, sustain: 0.3, release: 0.2 },
        ampEnv: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.15 },
        lfo: { type: 'sine', rate: 0.15, amount: 300, destination: 'filter' },
        portamento: 0.05,
        voices: 1
      }
    },
    {
      name: '808 Bass',
      category: 'basses',
      tags: ['808', 'trap', 'hip-hop', 'long'],
      params: {
        osc1: { type: 'sine', detune: 0, gain: 1.0 },
        osc2: { type: 'triangle', detune: 0, gain: 0.15 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.85,
        filter: { type: 'lowpass', cutoff: 300, resonance: 1, envAmount: 600 },
        filterEnv: { attack: 0.001, decay: 1.2, sustain: 0.1, release: 0.4 },
        ampEnv: { attack: 0.001, decay: 2.0, sustain: 0.0, release: 0.3 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0.03,
        voices: 1
      }
    },
    {
      name: 'Acid Bass',
      category: 'basses',
      tags: ['acid', '303', 'squelch', 'resonant'],
      params: {
        osc1: { type: 'sawtooth', detune: 0, gain: 0.9 },
        osc2: { type: 'square', detune: 0, gain: 0.2 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.8,
        filter: { type: 'lowpass', cutoff: 500, resonance: 16, envAmount: 5500 },
        filterEnv: { attack: 0.001, decay: 0.18, sustain: 0.05, release: 0.12 },
        ampEnv: { attack: 0.001, decay: 0.2, sustain: 0.6, release: 0.08 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0.04,
        voices: 1
      }
    },
    {
      name: 'FM Bass',
      category: 'basses',
      tags: ['fm', 'metallic', 'digital'],
      params: {
        osc1: { type: 'sine', detune: 0, gain: 0.8 },
        osc2: { type: 'sine', detune: 700, gain: 0.6 },
        sub: { enabled: true, type: 'sine', gain: 0.3 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.55,
        filter: { type: 'lowpass', cutoff: 1800, resonance: 3, envAmount: 2500 },
        filterEnv: { attack: 0.001, decay: 0.25, sustain: 0.1, release: 0.15 },
        ampEnv: { attack: 0.001, decay: 0.35, sustain: 0.5, release: 0.12 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0,
        voices: 1
      }
    },
    {
      name: 'Wobble Bass',
      category: 'basses',
      tags: ['wobble', 'dubstep', 'lfo', 'filthy'],
      params: {
        osc1: { type: 'sawtooth', detune: -5, gain: 0.8 },
        osc2: { type: 'square', detune: 5, gain: 0.6 },
        sub: { enabled: true, type: 'sine', gain: 0.4 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.55,
        filter: { type: 'lowpass', cutoff: 600, resonance: 10, envAmount: 1000 },
        filterEnv: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.2 },
        ampEnv: { attack: 0.005, decay: 0.05, sustain: 0.95, release: 0.15 },
        lfo: { type: 'sine', rate: 3, amount: 3500, destination: 'filter' },
        portamento: 0,
        voices: 1
      }
    },
    {
      name: 'Pluck Bass',
      category: 'basses',
      tags: ['pluck', 'short', 'tight'],
      params: {
        osc1: { type: 'sawtooth', detune: 0, gain: 0.8 },
        osc2: { type: 'triangle', detune: 0, gain: 0.4 },
        sub: { enabled: true, type: 'sine', gain: 0.3 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.65,
        filter: { type: 'lowpass', cutoff: 500, resonance: 4, envAmount: 4000 },
        filterEnv: { attack: 0.001, decay: 0.12, sustain: 0.0, release: 0.08 },
        ampEnv: { attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.1 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0,
        voices: 1
      }
    },
    {
      name: 'Dark Bass',
      category: 'basses',
      tags: ['dark', 'deep', 'ambient'],
      params: {
        osc1: { type: 'triangle', detune: 0, gain: 0.7 },
        osc2: { type: 'triangle', detune: -3, gain: 0.5 },
        sub: { enabled: true, type: 'sine', gain: 0.5 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.55,
        filter: { type: 'lowpass', cutoff: 250, resonance: 2, envAmount: 400 },
        filterEnv: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.3 },
        ampEnv: { attack: 0.01, decay: 0.1, sustain: 0.85, release: 0.2 },
        lfo: { type: 'sine', rate: 0.2, amount: 100, destination: 'filter' },
        portamento: 0.06,
        voices: 1
      }
    }
  ],

  // ==========================================================================
  // PADS
  // ==========================================================================
  pads: [
    {
      name: 'Warm Pad',
      category: 'pads',
      tags: ['warm', 'lush', 'analog'],
      params: {
        osc1: { type: 'sawtooth', detune: -8, gain: 0.6 },
        osc2: { type: 'sawtooth', detune: 8, gain: 0.6 },
        sub: { enabled: true, type: 'sine', gain: 0.2 },
        noise: { enabled: true, type: 'white', gain: 0.02 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 1200, resonance: 1, envAmount: 800 },
        filterEnv: { attack: 0.6, decay: 1.0, sustain: 0.6, release: 1.2 },
        ampEnv: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1.5 },
        lfo: { type: 'sine', rate: 0.3, amount: 200, destination: 'filter' },
        portamento: 0,
        voices: 8
      }
    },
    {
      name: 'Glass Pad',
      category: 'pads',
      tags: ['glass', 'crystal', 'bright'],
      params: {
        osc1: { type: 'triangle', detune: -6, gain: 0.7 },
        osc2: { type: 'triangle', detune: 6, gain: 0.7 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: true, type: 'white', gain: 0.03 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 3500, resonance: 3, envAmount: 2000 },
        filterEnv: { attack: 0.4, decay: 0.8, sustain: 0.5, release: 1.0 },
        ampEnv: { attack: 0.3, decay: 0.4, sustain: 0.75, release: 2.0 },
        lfo: { type: 'triangle', rate: 0.5, amount: 300, destination: 'filter' },
        portamento: 0,
        voices: 8
      }
    },
    {
      name: 'Dark Pad',
      category: 'pads',
      tags: ['dark', 'ominous', 'cinematic'],
      params: {
        osc1: { type: 'square', detune: -10, gain: 0.6 },
        osc2: { type: 'square', detune: 10, gain: 0.6 },
        sub: { enabled: true, type: 'sine', gain: 0.25 },
        noise: { enabled: true, type: 'white', gain: 0.01 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 500, resonance: 2, envAmount: 400 },
        filterEnv: { attack: 0.8, decay: 1.5, sustain: 0.3, release: 2.0 },
        ampEnv: { attack: 0.7, decay: 0.5, sustain: 0.7, release: 2.5 },
        lfo: { type: 'sine', rate: 0.15, amount: 150, destination: 'filter' },
        portamento: 0,
        voices: 6
      }
    },
    {
      name: 'Evolving Pad',
      category: 'pads',
      tags: ['evolving', 'movement', 'atmospheric'],
      params: {
        osc1: { type: 'sawtooth', detune: -15, gain: 0.6 },
        osc2: { type: 'triangle', detune: 15, gain: 0.5 },
        sub: { enabled: true, type: 'sine', gain: 0.15 },
        noise: { enabled: true, type: 'white', gain: 0.03 },
        oscMix: 0.55,
        filter: { type: 'lowpass', cutoff: 1000, resonance: 5, envAmount: 1500 },
        filterEnv: { attack: 1.0, decay: 2.0, sustain: 0.4, release: 2.0 },
        ampEnv: { attack: 0.8, decay: 0.5, sustain: 0.75, release: 2.5 },
        lfo: { type: 'sine', rate: 0.1, amount: 2000, destination: 'filter' },
        portamento: 0,
        voices: 6
      }
    },
    {
      name: 'Choir Pad',
      category: 'pads',
      tags: ['choir', 'vocal', 'ethereal'],
      params: {
        osc1: { type: 'sawtooth', detune: -5, gain: 0.5 },
        osc2: { type: 'sawtooth', detune: 5, gain: 0.5 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: true, type: 'white', gain: 0.04 },
        oscMix: 0.5,
        filter: { type: 'bandpass', cutoff: 1800, resonance: 6, envAmount: 800 },
        filterEnv: { attack: 0.5, decay: 1.0, sustain: 0.6, release: 1.5 },
        ampEnv: { attack: 0.6, decay: 0.4, sustain: 0.8, release: 1.8 },
        lfo: { type: 'sine', rate: 0.25, amount: 400, destination: 'filter' },
        portamento: 0,
        voices: 8
      }
    },
    {
      name: 'Ambient Pad',
      category: 'pads',
      tags: ['ambient', 'texture', 'background'],
      params: {
        osc1: { type: 'sine', detune: -3, gain: 0.5 },
        osc2: { type: 'sine', detune: 3, gain: 0.4 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: true, type: 'white', gain: 0.15 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 2000, resonance: 1, envAmount: 500 },
        filterEnv: { attack: 2.0, decay: 2.0, sustain: 0.5, release: 3.0 },
        ampEnv: { attack: 2.5, decay: 1.0, sustain: 0.6, release: 4.0 },
        lfo: { type: 'sine', rate: 0.08, amount: 300, destination: 'filter' },
        portamento: 0,
        voices: 8
      }
    }
  ],

  // ==========================================================================
  // KEYS
  // ==========================================================================
  keys: [
    {
      name: 'Electric Piano',
      category: 'keys',
      tags: ['electric', 'rhodes', 'warm'],
      params: {
        osc1: { type: 'sine', detune: 0, gain: 0.8 },
        osc2: { type: 'triangle', detune: 1, gain: 0.4 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.65,
        filter: { type: 'lowpass', cutoff: 2500, resonance: 1, envAmount: 2000 },
        filterEnv: { attack: 0.001, decay: 0.6, sustain: 0.2, release: 0.3 },
        ampEnv: { attack: 0.001, decay: 1.2, sustain: 0.3, release: 0.4 },
        lfo: { type: 'sine', rate: 4.8, amount: 50, destination: 'pitch' },
        portamento: 0,
        voices: 8
      }
    },
    {
      name: 'Organ',
      category: 'keys',
      tags: ['organ', 'sustained', 'classic'],
      params: {
        osc1: { type: 'sine', detune: 0, gain: 0.7 },
        osc2: { type: 'square', detune: 0.5, gain: 0.4 },
        sub: { enabled: true, type: 'sine', gain: 0.3 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.6,
        filter: { type: 'lowpass', cutoff: 4000, resonance: 0.5, envAmount: 0 },
        filterEnv: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.05 },
        ampEnv: { attack: 0.008, decay: 0.01, sustain: 1.0, release: 0.06 },
        lfo: { type: 'sine', rate: 6.5, amount: 80, destination: 'pitch' },
        portamento: 0,
        voices: 8
      }
    },
    {
      name: 'Clav',
      category: 'keys',
      tags: ['clav', 'funky', 'percussive'],
      params: {
        osc1: { type: 'square', detune: 0, gain: 0.8 },
        osc2: { type: 'sawtooth', detune: 1, gain: 0.3 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: true, type: 'white', gain: 0.03 },
        oscMix: 0.7,
        filter: { type: 'bandpass', cutoff: 1500, resonance: 5, envAmount: 3000 },
        filterEnv: { attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.05 },
        ampEnv: { attack: 0.001, decay: 0.25, sustain: 0.0, release: 0.08 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0,
        voices: 6
      }
    },
    {
      name: 'Bell',
      category: 'keys',
      tags: ['bell', 'metallic', 'bright', 'fm'],
      params: {
        osc1: { type: 'sine', detune: 0, gain: 0.7 },
        osc2: { type: 'sine', detune: 500, gain: 0.5 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: false, type: 'white', gain: 0 },
        oscMix: 0.55,
        filter: { type: 'lowpass', cutoff: 5000, resonance: 1, envAmount: 3000 },
        filterEnv: { attack: 0.001, decay: 1.5, sustain: 0.1, release: 1.0 },
        ampEnv: { attack: 0.001, decay: 2.5, sustain: 0.0, release: 2.0 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0,
        voices: 8
      }
    }
  ],

  // ==========================================================================
  // FX / OTHER
  // ==========================================================================
  fx: [
    {
      name: 'Riser',
      category: 'fx',
      tags: ['riser', 'build', 'tension'],
      params: {
        osc1: { type: 'sawtooth', detune: -20, gain: 0.6 },
        osc2: { type: 'sawtooth', detune: 20, gain: 0.6 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: true, type: 'white', gain: 0.08 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 800, resonance: 6, envAmount: 8000 },
        filterEnv: { attack: 4.0, decay: 0.1, sustain: 1.0, release: 0.5 },
        ampEnv: { attack: 4.0, decay: 0.1, sustain: 0.9, release: 0.5 },
        lfo: { type: 'sawtooth', rate: 0.08, amount: 600, destination: 'pitch' },
        portamento: 0,
        voices: 4
      }
    },
    {
      name: 'Drop',
      category: 'fx',
      tags: ['drop', 'impact', 'downward'],
      params: {
        osc1: { type: 'sine', detune: 0, gain: 1.0 },
        osc2: { type: 'sine', detune: 0, gain: 0.3 },
        sub: { enabled: true, type: 'sine', gain: 0.4 },
        noise: { enabled: true, type: 'white', gain: 0.1 },
        oscMix: 0.8,
        filter: { type: 'lowpass', cutoff: 5000, resonance: 2, envAmount: -4000 },
        filterEnv: { attack: 0.001, decay: 1.5, sustain: 0.0, release: 0.5 },
        ampEnv: { attack: 0.001, decay: 2.0, sustain: 0.0, release: 0.3 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0,
        voices: 1
      }
    },
    {
      name: 'Stab',
      category: 'fx',
      tags: ['stab', 'punchy', 'short', 'chord'],
      params: {
        osc1: { type: 'sawtooth', detune: -10, gain: 0.8 },
        osc2: { type: 'square', detune: 10, gain: 0.6 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: true, type: 'white', gain: 0.05 },
        oscMix: 0.55,
        filter: { type: 'lowpass', cutoff: 1000, resonance: 4, envAmount: 5000 },
        filterEnv: { attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.06 },
        ampEnv: { attack: 0.001, decay: 0.15, sustain: 0.0, release: 0.1 },
        lfo: { type: 'sine', rate: 0, amount: 0, destination: 'filter' },
        portamento: 0,
        voices: 6
      }
    },
    {
      name: 'Atmosphere',
      category: 'fx',
      tags: ['atmosphere', 'ambient', 'texture', 'noise'],
      params: {
        osc1: { type: 'sine', detune: -2, gain: 0.3 },
        osc2: { type: 'sine', detune: 2, gain: 0.3 },
        sub: { enabled: false, type: 'sine', gain: 0 },
        noise: { enabled: true, type: 'white', gain: 0.25 },
        oscMix: 0.5,
        filter: { type: 'lowpass', cutoff: 1500, resonance: 3, envAmount: 800 },
        filterEnv: { attack: 3.0, decay: 2.0, sustain: 0.5, release: 4.0 },
        ampEnv: { attack: 3.5, decay: 1.0, sustain: 0.6, release: 5.0 },
        lfo: { type: 'sine', rate: 0.05, amount: 500, destination: 'filter' },
        portamento: 0,
        voices: 4
      }
    }
  ]
};

// Helper: get a flat array of all presets
export function getAllPresets() {
  return [
    ...SYNTH_PRESETS.leads,
    ...SYNTH_PRESETS.basses,
    ...SYNTH_PRESETS.pads,
    ...SYNTH_PRESETS.keys,
    ...SYNTH_PRESETS.fx
  ];
}

// Helper: find preset by name (case-insensitive)
export function findPreset(name) {
  const lower = name.toLowerCase();
  return getAllPresets().find(p => p.name.toLowerCase() === lower) || null;
}

// Helper: find presets by tag
export function findPresetsByTag(tag) {
  const lower = tag.toLowerCase();
  return getAllPresets().filter(p => p.tags.some(t => t.toLowerCase() === lower));
}

// Helper: get category names
export function getCategories() {
  return Object.keys(SYNTH_PRESETS);
}

// Default / init preset
export const DEFAULT_PRESET = SYNTH_PRESETS.leads[0];
