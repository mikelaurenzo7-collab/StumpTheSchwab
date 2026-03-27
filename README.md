# NOVA — Digital Audio Workstation

**Musicality First. Complexity Second.**

NOVA is a professional web-based music production platform with AI-powered composition, live performance tools, and smart mastering — all running in the browser with zero dependencies.

A talented musician with no software experience can open NOVA and produce a professional track in minutes, not months.

---

## Features

### Core DAW
- **Polyphonic Synthesizer** — 8-voice, dual oscillators, resonant filter, ADSR envelopes, LFO, glide
- **Drum Machine** — 8 fully synthesized sounds (kick, snare, hats, clap, rim, tom, cymbal), no samples needed
- **8-Slot Sampler** — Load WAV/MP3 files, pitch shift, loop, trim
- **Step Sequencer** — 16-step grid with velocity, swing, genre presets (Trap, House, Boom Bap, R&B, Drill, Lo-fi)
- **Piano Roll** — Canvas-based MIDI editor with snap, scale highlighting, draw/select/erase tools
- **8-Channel Mixer** — Faders, pan, solo/mute, send buses, level meters
- **Professional Effects** — EQ, Distortion, Chorus, Delay, Reverb, Compressor with per-effect bypass
- **Arrangement View** — Scene management and pattern chaining for full song structure
- **31 Synth Presets** — Bass, Lead, Pad, Keys, FX, and Synth categories

### AI Music Intelligence
- **AI Composer** — Generate chord progressions, melodies, basslines, and drum patterns with mood-driven controls
- **Sound Designer** — Describe a sound in natural language ("warm 80s brass pad with shimmer") and NOVA creates it
- **Mood Sliders** — Dark/Bright, Sparse/Dense, Calm/Energetic — real-time parameter morphing
- **Surprise Me** — One-click full track generation (chords + melody + bass + drums + effects + BPM)
- **8 Mood Profiles** — Happy, Sad, Dark, Epic, Chill, Aggressive, Dreamy, Nostalgic
- **Genre-Aware Generation** — Trap, House, Boom Bap, R&B, Drill, Lo-fi, Pop, DnB

### Live Performance
- **8x4 Clip Launcher** — Ableton Push-style grid with quantized clip launching
- **FX Macro Knobs** — ATMOSPHERE, ENERGY, SPACE, GRIT — each controls multiple parameters
- **A/B Crossfader** — Blend between scene columns in real-time
- **Beat-Synced Visuals** — Playing clips pulse with the beat

### Professional Output
- **Smart Mastering** — One-click AI mastering chain: 4-band EQ, stereo widener, multiband compression, brickwall limiter
- **5 Mastering Presets** — Balanced, Loud, Warm, Bright, Radio
- **LUFS Metering** — K-weighted loudness measurement
- **Audio Export** — Real-time recording (WebM) and offline WAV bounce
- **Spectrum Analyzer** — 64-band frequency display with peak hold + waveform oscilloscope

### Collaboration & MIDI
- **Real-Time Jam Sessions** — Multi-tab collaboration via BroadcastChannel (Host/Jammer roles)
- **MIDI Hardware Support** — Web MIDI API for controllers and keyboards
- **MIDI Learn** — Map any CC to any parameter
- **Undo/Redo** — Full command history with Ctrl+Z / Ctrl+Shift+Z

### Project Management
- **Save/Load** — localStorage persistence with named projects
- **JSON Import/Export** — Shareable .nova.json project files
- **Song Templates** — Professional starter tracks across genres

---

## Quick Start

1. Open `index.html` in a modern browser (Chrome recommended for full Web Audio + MIDI support)
2. Click **START CREATING** on the splash screen
3. Follow the interactive tutorial, or:
   - Pick a genre in the Step Sequencer → Press **Space** to play
   - Switch to **AI COMPOSER** → Click **SURPRISE ME** for an instant track
   - Type a sound description in the **Sound Designer** → Click **DESIGN**
   - Press **?** for keyboard shortcuts

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| Space | Play / Stop |
| A-K | Play notes (chromatic) |
| 1-8 | Set octave |
| ? | Keyboard shortcuts help |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |

---

## Architecture

```
nova/
├── index.html                    Entry point + splash screen
├── css/nova.css                  Complete design system
├── js/
│   ├── App.js                    Main orchestrator (wires everything)
│   ├── ProjectManager.js         Save/load, JSON export, WAV bounce
│   ├── CollabManager.js          Real-time collaboration engine
│   ├── UndoManager.js            Global undo/redo system
│   ├── engine/
│   │   ├── AudioEngine.js        Web Audio graph, scheduler, routing
│   │   ├── Synthesizer.js        8-voice polyphonic synth
│   │   ├── DrumMachine.js        Synthesized drum sounds
│   │   ├── Effects.js            6-effect processing chain
│   │   ├── Sampler.js            Audio file player (8 slots)
│   │   ├── MasteringChain.js     AI mastering engine
│   │   └── MIDIManager.js        Web MIDI hardware support
│   ├── ai/
│   │   └── MusicBrain.js         Algorithmic music intelligence
│   ├── ui/
│   │   ├── TransportBar.js       Play/stop, BPM, metronome
│   │   ├── StepSequencer.js      Drum pattern grid
│   │   ├── PianoRoll.js          MIDI note editor (canvas)
│   │   ├── MixerPanel.js         Channel strips + meters
│   │   ├── SynthPanel.js         Synth controls + oscilloscope
│   │   ├── EffectsPanel.js       Effect parameter controls
│   │   ├── ArrangementView.js    Song structure timeline
│   │   ├── AIPanel.js            AI composer controls
│   │   ├── SoundDesigner.js      NLP sound design interface
│   │   ├── PerformanceView.js    Live clip launcher
│   │   ├── SpectrumAnalyzer.js   Frequency + waveform display
│   │   ├── KeyboardHelp.js       Shortcut overlay
│   │   └── Onboarding.js         Interactive tutorial
│   └── data/
│       ├── Presets.js            31 synth presets
│       ├── Scales.js             Scales, chords, key utilities
│       ├── DrumPatterns.js       Genre drum patterns
│       └── SongTemplates.js      Full song starter tracks
```

**Zero dependencies. Zero build tools. Pure vanilla JavaScript.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Audio | Web Audio API (AudioContext, OscillatorNode, BiquadFilterNode, etc.) |
| Rendering | HTML5 Canvas (piano roll, spectrum analyzer, knobs) |
| Styling | CSS3 custom properties, conic gradients, grid/flex layout |
| MIDI | Web MIDI API |
| Collaboration | BroadcastChannel API |
| Persistence | localStorage + File API |
| Export | MediaRecorder API + manual WAV encoding |

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Core DAW | Yes | Yes | Yes | Yes |
| MIDI | Yes | No | No | Yes |
| Collaboration | Yes | Yes | Yes | Yes |
| Audio Export | Yes | Yes | Partial | Yes |

Chrome is recommended for the complete experience.

---

## Philosophy

NOVA was built with three principles:

1. **Musicality over complexity** — Every feature serves the music. No feature exists just because it can.
2. **AI as copilot, not replacement** — NOVA's AI suggests, generates, and assists. The musician creates.
3. **Zero friction** — No installs, no accounts, no loading. Open a URL and start making music.

---

Built with NOVA Intelligence.
