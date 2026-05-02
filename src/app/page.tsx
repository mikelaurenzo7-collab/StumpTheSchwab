"use client";

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Tone from "tone";

type Track = {
  id: string;
  name: string;
  voice: "kick" | "snare" | "hat" | "bass" | "pluck" | "pad";
  glyph: string;
  hue: number;
  pattern: boolean[];
  level: number;
  pitch: number;
};

type Macro = {
  bloom: number;
  gravity: number;
  shimmer: number;
  fracture: number;
};

const STEPS = 16;
const RING_RADII = [292, 256, 220, 184, 148, 112];
const STEP_RADIUS = 12;
const ORB_CENTER = 350;
const ORB_VIEW = 700;

const initialTracks: Track[] = [
  { id: "pulse", name: "Pulse Engine", voice: "kick", glyph: "◉", hue: 270, level: 0.92, pitch: 46, pattern: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false] },
  { id: "glass", name: "Glass Impact", voice: "snare", glyph: "✦", hue: 318, level: 0.76, pitch: 188, pattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true] },
  { id: "dust", name: "Photon Dust", voice: "hat", glyph: "·", hue: 190, level: 0.58, pitch: 6200, pattern: [true, false, true, false, true, true, true, false, true, false, true, false, true, true, false, true] },
  { id: "sub", name: "Sub Collider", voice: "bass", glyph: "▼", hue: 154, level: 0.84, pitch: 55, pattern: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false] },
  { id: "keys", name: "Neon Keys", voice: "pluck", glyph: "◆", hue: 42, level: 0.64, pitch: 330, pattern: [false, true, false, false, false, true, false, true, false, false, true, false, false, true, false, false] },
  { id: "aura", name: "Aura Pad", voice: "pad", glyph: "◯", hue: 226, level: 0.52, pitch: 110, pattern: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
];

type Mode = "minor" | "major" | "dorian" | "phrygian" | "mixolydian";
type ChordQuality = "maj" | "min" | "dim" | "maj7" | "min7" | "dom7" | "sus2" | "sus4";
type Chord = { degree: number; quality: ChordQuality };
type BassRole = "root" | "fifth" | "octave" | "third";

type Song = {
  name: string;
  key: string;
  mode: Mode;
  progression: Chord[];
  pluckMotif: (number | null)[];
  bassMotif: BassRole[];
};

const MODE_INTERVALS: Record<Mode, number[]> = {
  minor:      [0, 2, 3, 5, 7, 8, 10],
  major:      [0, 2, 4, 5, 7, 9, 11],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj:  [0, 4, 7],
  min:  [0, 3, 7],
  dim:  [0, 3, 6],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

const PLUCK_MOTIFS: (number | null)[][] = [
  [0, null, 2, null, 1, null, 0, 2,  null, 1, 2, null, 0, null, 2, 1],
  [0, 2, null, 1, null, 0, 2, null,  1, null, 2, 1, 0, 2, null, 1],
  [null, 1, 0, null, 2, null, 1, 0,  null, 2, 1, 0, null, 1, 2, null],
  [0, null, null, 1, 2, null, 0, null, 1, null, 2, 0, null, 1, null, 2],
  [2, 1, 0, null, 2, 1, 0, null,     2, 1, 0, 2, 1, null, 2, 0],
];

const BASS_MOTIFS: BassRole[][] = [
  ["root","root","root","fifth","root","root","octave","root","root","fifth","root","root","root","octave","root","fifth"],
  ["root","fifth","root","octave","root","fifth","root","octave","root","fifth","root","octave","root","fifth","root","octave"],
  ["root","root","fifth","root","root","third","fifth","octave","root","root","fifth","root","root","third","fifth","octave"],
  ["root","octave","root","root","fifth","root","octave","fifth","root","octave","root","root","fifth","root","octave","fifth"],
];

const SCENE_TEMPLATES: Pick<Song, "name" | "key" | "mode" | "progression">[] = [
  { name: "Nebula Breaks",  key: "A", mode: "minor",      progression: [{degree:1,quality:"min"},{degree:6,quality:"maj"},{degree:3,quality:"maj"},{degree:7,quality:"maj"}] },
  { name: "Quantum Bounce", key: "C", mode: "major",      progression: [{degree:1,quality:"maj"},{degree:5,quality:"maj"},{degree:6,quality:"min"},{degree:4,quality:"maj"}] },
  { name: "Chrome Ritual",  key: "F", mode: "phrygian",   progression: [{degree:1,quality:"min"},{degree:2,quality:"maj"},{degree:1,quality:"min"},{degree:7,quality:"maj"}] },
  { name: "Zero-G Garage",  key: "G", mode: "minor",      progression: [{degree:1,quality:"min7"},{degree:4,quality:"min7"},{degree:6,quality:"maj7"},{degree:5,quality:"min7"}] },
  { name: "Solar Drill",    key: "D", mode: "dorian",     progression: [{degree:1,quality:"min7"},{degree:4,quality:"maj7"},{degree:1,quality:"min7"},{degree:5,quality:"min7"}] },
  { name: "Dream Collider", key: "E", mode: "minor",      progression: [{degree:1,quality:"min"},{degree:7,quality:"maj"},{degree:6,quality:"maj"},{degree:5,quality:"min"}] },
];

function buildSong(name: string): Song {
  const tmpl = SCENE_TEMPLATES.find((s) => s.name === name) ?? SCENE_TEMPLATES[0];
  return {
    ...tmpl,
    pluckMotif: PLUCK_MOTIFS[Math.floor(Math.random() * PLUCK_MOTIFS.length)],
    bassMotif: BASS_MOTIFS[Math.floor(Math.random() * BASS_MOTIFS.length)],
  };
}

type Voice = Track["voice"];
type SectionVoiceConfig = { active: boolean; pattern?: boolean[] };
type Section = { name: string; measures: number; voices: Record<Voice, SectionVoiceConfig> };

const FOUR_ON_FLOOR  = [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false];
const BACKBEAT       = [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false];
const BACKBEAT_GHOST = [false,false,false,false, true,false,false,true,  false,false,false,false, true,false,false,true];
const HAT_EIGHTHS    = [true,false,true,false, true,false,true,false, true,false,true,false, true,false,true,false];
const HAT_SIXTEENTHS = Array.from({ length: 16 }, () => true);
const PAD_HOLD       = [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false];
const PAD_ONCE       = [true, ...Array.from({ length: 15 }, () => false)];
const BASS_DOWNBEATS = [true,false,false,false, true,false,false,false, true,false,false,false, true,false,false,false];
const BASS_SYNCO     = [true,false,false,true,  false,false,true,false, false,true,false,false, true,false,false,true];
const BASS_PUMP      = [true,false,true,false,  true,false,true,false,  true,false,true,false,  true,false,true,false];
const PLUCK_INTRO    = [true,false,false,true,  false,false,true,false, false,false,true,false, false,true,false,false];
const PLUCK_VERSE    = [true,false,true,false,  true,true,false,true,   false,true,false,true,  false,true,false,false];
const PLUCK_BREAK    = [true,false,false,false, true,false,false,false, true,false,false,false, false,false,true,false];

const ARRANGEMENT: Section[] = [
  { name: "intro",  measures: 4,
    voices: {
      kick: { active: false }, snare: { active: false }, hat: { active: false },
      bass: { active: false },
      pluck: { active: true, pattern: PLUCK_INTRO },
      pad:   { active: true, pattern: PAD_ONCE },
    } },
  { name: "verse",  measures: 8,
    voices: {
      kick:  { active: true, pattern: FOUR_ON_FLOOR },
      snare: { active: true, pattern: BACKBEAT },
      hat:   { active: true, pattern: HAT_EIGHTHS },
      bass:  { active: true, pattern: BASS_DOWNBEATS },
      pluck: { active: true, pattern: PLUCK_VERSE },
      pad:   { active: false },
    } },
  { name: "build",  measures: 4,
    voices: {
      kick:  { active: true, pattern: FOUR_ON_FLOOR },
      snare: { active: true, pattern: BACKBEAT_GHOST },
      hat:   { active: true, pattern: HAT_SIXTEENTHS },
      bass:  { active: false },
      pluck: { active: true, pattern: PLUCK_VERSE },
      pad:   { active: true, pattern: PAD_HOLD },
    } },
  { name: "drop",   measures: 16,
    voices: {
      kick:  { active: true, pattern: FOUR_ON_FLOOR },
      snare: { active: true, pattern: BACKBEAT },
      hat:   { active: true, pattern: HAT_EIGHTHS },
      bass:  { active: true, pattern: BASS_PUMP },
      pluck: { active: true, pattern: PLUCK_VERSE },
      pad:   { active: true, pattern: PAD_HOLD },
    } },
  { name: "break",  measures: 4,
    voices: {
      kick: { active: false }, snare: { active: false }, hat: { active: false },
      bass: { active: false },
      pluck: { active: true, pattern: PLUCK_BREAK },
      pad:   { active: true, pattern: PAD_ONCE },
    } },
  { name: "drop 2", measures: 8,
    voices: {
      kick:  { active: true, pattern: FOUR_ON_FLOOR },
      snare: { active: true, pattern: BACKBEAT_GHOST },
      hat:   { active: true, pattern: HAT_SIXTEENTHS },
      bass:  { active: true, pattern: BASS_SYNCO },
      pluck: { active: true, pattern: PLUCK_VERSE },
      pad:   { active: true, pattern: PAD_HOLD },
    } },
  { name: "outro",  measures: 4,
    voices: {
      kick: { active: false }, snare: { active: false }, hat: { active: false },
      bass: { active: false },
      pluck: { active: true, pattern: PLUCK_INTRO },
      pad:   { active: true, pattern: PAD_ONCE },
    } },
];

const SONG_TOTAL_MEASURES = ARRANGEMENT.reduce((s, sec) => s + sec.measures, 0);
const SONG_TOTAL_STEPS = SONG_TOTAL_MEASURES * 16;

type SongLocation = {
  section: Section;
  sectionIndex: number;
  measureInSong: number;
  measureInSection: number;
  stepInMeasure: number;
};

function locateInSong(globalStep: number): SongLocation {
  const stepInMeasure = globalStep % 16;
  const measureInSong = Math.floor(globalStep / 16);
  let counter = 0;
  for (let i = 0; i < ARRANGEMENT.length; i++) {
    const section = ARRANGEMENT[i];
    if (measureInSong < counter + section.measures) {
      return {
        section, sectionIndex: i, measureInSong,
        measureInSection: measureInSong - counter,
        stepInMeasure,
      };
    }
    counter += section.measures;
  }
  const last = ARRANGEMENT[ARRANGEMENT.length - 1];
  return { section: last, sectionIndex: ARRANGEMENT.length - 1, measureInSong, measureInSection: 0, stepInMeasure };
}

function chordNotes(song: Song, chord: Chord, octave: number): string[] {
  const tonicMidi = Tone.Frequency(`${song.key}${octave}`).toMidi();
  const rootSemis = MODE_INTERVALS[song.mode][(chord.degree - 1) % 7];
  const rootMidi = tonicMidi + rootSemis;
  return QUALITY_INTERVALS[chord.quality].map((o) =>
    Tone.Frequency(rootMidi + o, "midi").toNote(),
  );
}

function activeChord(song: Song, measure: number): Chord {
  return song.progression[measure % song.progression.length];
}

const REVERB_SEND_BASE: Record<string, number> = {
  pulse: 0.04,
  glass: 0.22,
  dust: 0.10,
  sub: 0.05,
  keys: 0.32,
  aura: 0.55,
};

type VoiceBundle = {
  kick: Tone.MembraneSynth;
  kickClick: Tone.NoiseSynth;
  snareNoise: Tone.NoiseSynth;
  snareBody: Tone.Synth;
  snareCrack: Tone.NoiseSynth;
  hat: Tone.MetalSynth;
  hatPanner: Tone.Panner;
  bass: Tone.MonoSynth;
  bassSub: Tone.Synth;
  pluck: Tone.PluckSynth;
  pad: Tone.PolySynth;
};

type MasterChain = {
  filter: Tone.Filter;
  highpass: Tone.Filter;
  eq: Tone.EQ3;
  distortion: Tone.Distortion;
  reverb: Tone.Reverb;
  pluckDelay: Tone.PingPongDelay;
  compressor: Tone.Compressor;
  widener: Tone.StereoWidener;
  limiter: Tone.Limiter;
  ducker: Tone.Gain;
};

type Sends = Record<string, Tone.Gain>;

type AudioGraph = { voices: VoiceBundle; chain: MasterChain; sends: Sends };
type HatState = { count: number };

function buildAudioGraph(): AudioGraph {
  const filter = new Tone.Filter({ type: "lowpass", frequency: 18000, Q: 0.55 });
  const highpass = new Tone.Filter({ type: "highpass", frequency: 32, Q: 0.5 });
  const eq = new Tone.EQ3({ low: -1.5, mid: -2, high: 2.5, lowFrequency: 220, highFrequency: 4500 });
  const distortion = new Tone.Distortion({ distortion: 0, wet: 0 });
  const compressor = new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.006, release: 0.18, knee: 8 });
  const widener = new Tone.StereoWidener({ width: 0.55 });
  const limiter = new Tone.Limiter(-0.8);

  filter.chain(highpass, eq, distortion, compressor, widener, limiter, Tone.getDestination());

  const ducker = new Tone.Gain(1).connect(filter);
  const reverb = new Tone.Reverb({ decay: 2.6, wet: 1, preDelay: 0.025 });
  reverb.connect(compressor);
  const pluckDelay = new Tone.PingPongDelay({ delayTime: "8n.", feedback: 0.32, wet: 0.32 });
  pluckDelay.connect(filter);

  const sends: Sends = {};
  Object.entries(REVERB_SEND_BASE).forEach(([id, base]) => {
    sends[id] = new Tone.Gain(base).connect(reverb);
  });

  const dryDest = (id: string): Tone.InputNode => (id === "pulse" ? filter : ducker);
  const fan = (id: string): Tone.InputNode[] => [dryDest(id), sends[id]];

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05, octaves: 5, oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.55, sustain: 0.005, release: 0.7 },
    volume: -3,
  });
  kick.fan(...fan("pulse"));

  const kickClickHpf = new Tone.Filter({ type: "highpass", frequency: 1800 });
  kickClickHpf.fan(...fan("pulse"));
  const kickClick = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.014, sustain: 0 },
    volume: -22,
  }).connect(kickClickHpf);

  const snareBpf = new Tone.Filter({ type: "bandpass", frequency: 2400, Q: 1.4 });
  snareBpf.fan(...fan("glass"));
  const snareNoise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    volume: -11,
  }).connect(snareBpf);
  const snareBody = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    volume: -14,
  });
  snareBody.fan(...fan("glass"));
  const snareCrackHpf = new Tone.Filter({ type: "highpass", frequency: 8000 });
  snareCrackHpf.fan(...fan("glass"));
  const snareCrack = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
    volume: -19,
  }).connect(snareCrackHpf);

  const hatHpf = new Tone.Filter({ type: "highpass", frequency: 6500 });
  const hatPanner = new Tone.Panner(0);
  hatHpf.connect(hatPanner);
  hatPanner.fan(...fan("dust"));
  const hat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 },
    harmonicity: 5.1, modulationIndex: 28, resonance: 7000, octaves: 1.3,
    volume: -22,
  });
  hat.connect(hatHpf);

  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.005, decay: 0.22, sustain: 0.4, release: 0.32 },
    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.32, release: 0.22, baseFrequency: 70, octaves: 2.8, exponent: 2 },
    filter: { Q: 1.8, type: "lowpass", rolloff: -24 },
    portamento: 0.015,
    volume: -5,
  });
  bass.fan(...fan("sub"));
  const bassSub = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0.45, release: 0.4 },
    volume: -8,
  });
  bassSub.fan(...fan("sub"));

  const pluck = new Tone.PluckSynth({
    attackNoise: 0.85, dampening: 4400, resonance: 0.93, release: 0.7,
    volume: -4,
  });
  pluck.fan(ducker, sends["keys"], pluckDelay);

  const padFilter = new Tone.Filter({ type: "lowpass", frequency: 3400, Q: 0.55 });
  const padChorus = new Tone.Chorus({ frequency: 0.55, depth: 0.75, wet: 0.6 }).start();
  const padWidener = new Tone.StereoWidener({ width: 0.7 });
  padFilter.chain(padChorus, padWidener);
  padWidener.fan(...fan("aura"));
  const pad = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 1.5,
    oscillator: { type: "fatsawtooth", spread: 32, count: 3 } as Partial<Tone.OmniOscillatorOptions>,
    envelope: { attack: 0.95, decay: 0.4, sustain: 0.7, release: 2.0 },
    modulation: { type: "sine" },
    modulationEnvelope: { attack: 0.6, decay: 0.5, sustain: 0.5, release: 0.8 },
    volume: -13,
  });
  pad.maxPolyphony = 8;
  pad.connect(padFilter);

  return {
    voices: { kick, kickClick, snareNoise, snareBody, snareCrack, hat, hatPanner, bass, bassSub, pluck, pad },
    chain: { filter, highpass, eq, distortion, reverb, pluckDelay, compressor, widener, limiter, ducker },
    sends,
  };
}

function applyMacrosInstant(graph: AudioGraph, m: Macro) {
  graph.chain.filter.frequency.value = 200 * Math.pow(90, m.bloom / 100);
  graph.chain.distortion.distortion = (m.fracture / 100) * 0.55;
  graph.chain.distortion.wet.value = (m.fracture / 100) * 0.6;
  Object.entries(graph.sends).forEach(([id, gain]) => {
    const base = REVERB_SEND_BASE[id] ?? 0.1;
    gain.gain.value = base * ((m.shimmer / 100) * 1.4);
  });
  graph.voices.bassSub.volume.value = -16 + (m.gravity / 100) * 12;
}

function applyVoiceTrigger(
  graph: AudioGraph,
  song: Song,
  hatState: HatState,
  track: Track,
  time: number,
  stepIdx: number,
  harmonyMeasure: number,
) {
  const { voices, chain } = graph;
  const velocity = clamp(track.level, 0.05, 1);
  switch (track.voice) {
    case "kick":
      voices.kick.triggerAttackRelease("C1", "8n", time, velocity);
      voices.kickClick.triggerAttackRelease("32n", time, velocity * 0.6);
      chain.ducker.gain.cancelScheduledValues(time);
      chain.ducker.gain.setValueAtTime(0.55, time);
      chain.ducker.gain.linearRampToValueAtTime(1, time + 0.18);
      return;
    case "snare":
      voices.snareNoise.triggerAttackRelease("8n", time, velocity);
      voices.snareBody.triggerAttackRelease("G2", "32n", time, velocity * 0.55);
      voices.snareCrack.triggerAttackRelease("32n", time, velocity * 0.85);
      return;
    case "hat": {
      const pan = hatState.count % 2 === 0 ? -0.32 : 0.32;
      voices.hatPanner.pan.setValueAtTime(pan, time);
      hatState.count += 1;
      voices.hat.triggerAttackRelease("C6", "32n", time, velocity * 0.7);
      return;
    }
    case "bass": {
      const chord = activeChord(song, harmonyMeasure);
      const tones = chordNotes(song, chord, 1);
      const role = song.bassMotif[stepIdx];
      let note = tones[0];
      if (role === "third") note = tones[1] ?? tones[0];
      else if (role === "fifth") note = tones[2] ?? tones[0];
      else if (role === "octave") note = Tone.Frequency(tones[0]).transpose(12).toNote();
      voices.bass.triggerAttackRelease(note, "8n", time, velocity);
      voices.bassSub.triggerAttackRelease(note, "8n", time, velocity * 0.7);
      return;
    }
    case "pluck": {
      const chord = activeChord(song, harmonyMeasure);
      const tones = chordNotes(song, chord, 4);
      const motif = song.pluckMotif[stepIdx];
      const note = motif == null ? tones[0] : (tones[motif % tones.length] ?? tones[0]);
      voices.pluck.triggerAttackRelease(note, "16n", time, velocity);
      return;
    }
    case "pad": {
      const chord = activeChord(song, harmonyMeasure);
      const tones = chordNotes(song, chord, 3);
      voices.pad.triggerAttackRelease(tones, "1n", time, velocity);
      return;
    }
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  let offset = 0;
  const write = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i)); };

  write("RIFF");
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  write("WAVE");
  write("fmt ");
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  write("data");
  view.setUint32(offset, dataSize, true); offset += 4;

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function makePattern(track: Track, density: number, gravity: number) {
  return Array.from({ length: STEPS }, (_, step) => {
    const downbeat = step % 4 === 0;
    const offbeat = step % 4 === 2;
    const phase = Math.sin((step + track.hue / 36) * (0.9 + gravity / 80));
    const threshold = density / 100 + (downbeat ? 0.22 : 0) + (offbeat ? 0.08 : 0);

    if (track.voice === "kick") return downbeat || (phase > 0.75 && density > 64);
    if (track.voice === "snare") return step === 4 || step === 12 || (phase > 0.86 && density > 74);
    if (track.voice === "hat") return step % 2 === 0 || phase > 0.38;
    if (track.voice === "pad") return step % 4 === 0;
    if (track.voice === "bass") return downbeat || (phase > 0.6 && density > 55);
    return phase + threshold > 1.08;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function polar(radius: number, step: number) {
  const angle = (step / STEPS) * Math.PI * 2 - Math.PI / 2;
  return {
    x: ORB_CENTER + radius * Math.cos(angle),
    y: ORB_CENTER + radius * Math.sin(angle),
    angle,
  };
}

type RotaryProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  hue: number;
  onChange: (next: number) => void;
};

function Rotary({ label, value, min, max, hue, onChange }: RotaryProps) {
  const dragRef = useRef<{ y: number; v: number } | null>(null);

  const handleDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { y: event.clientY, v: value };
  };

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const range = max - min;
    const next = dragRef.current.v + ((dragRef.current.y - event.clientY) / 220) * range;
    onChange(clamp(next, min, max));
  };

  const handleUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const ratio = (value - min) / (max - min);
  const angle = -135 + ratio * 270;
  const arcLength = 282;
  const dash = arcLength * ratio;

  return (
    <div className="rotary" style={{ "--rot-hue": hue } as React.CSSProperties}>
      <div
        className="rotary-body"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <svg className="rotary-arc" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" className="rotary-track" />
          <circle
            cx="60"
            cy="60"
            r="50"
            className="rotary-fill"
            strokeDasharray={`${dash} ${arcLength}`}
          />
        </svg>
        <div className="rotary-cap" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="rotary-pin" />
        </div>
        <strong className="rotary-readout">{Math.round(value)}</strong>
      </div>
      <span className="rotary-label">{label}</span>
    </div>
  );
}

export default function Home() {
  const [tracks, setTracks] = useState(initialTracks);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [bpm, setBpm] = useState(126);
  const [swing, setSwing] = useState(0.16);
  const [density, setDensity] = useState(62);
  const [song, setSong] = useState<Song>(() => buildSong("Nebula Breaks"));
  const [songMode, setSongMode] = useState(false);
  const [songProgress, setSongProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [composePrompt, setComposePrompt] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeRationale, setComposeRationale] = useState<string | null>(null);
  const [macros, setMacros] = useState<Macro>({ bloom: 72, gravity: 44, shimmer: 63, fracture: 28 });
  const songRef = useRef(song);
  const songCursorRef = useRef(0);
  const measureRef = useRef(0);
  const hatCountRef = useRef<HatState>({ count: 0 });
  const voicesRef = useRef<VoiceBundle | null>(null);
  const chainRef = useRef<MasterChain | null>(null);
  const sendsRef = useRef<Sends | null>(null);
  const tracksRef = useRef(tracks);
  const macrosRef = useRef(macros);
  const stepRef = useRef(step);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { macrosRef.current = macros; }, [macros]);
  useEffect(() => { songRef.current = song; }, [song]);

  const toggleSongMode = () => {
    songCursorRef.current = 0;
    measureRef.current = 0;
    stepRef.current = 0;
    setSongProgress(0);
    setStep(0);
    setSongMode((v) => !v);
  };

  const ensureAudio = useCallback(async () => {
    await Tone.start();
    if (chainRef.current) return;
    const graph = buildAudioGraph();
    chainRef.current = graph.chain;
    voicesRef.current = graph.voices;
    sendsRef.current = graph.sends;
    applyMacrosInstant(graph, macrosRef.current);
  }, []);

  const triggerVoice = useCallback((track: Track, time: number, stepIdx: number, harmonyMeasure: number) => {
    const voices = voicesRef.current;
    const chain = chainRef.current;
    const sends = sendsRef.current;
    if (!voices || !chain || !sends) return;
    applyVoiceTrigger({ voices, chain, sends }, songRef.current, hatCountRef.current, track, time, stepIdx, harmonyMeasure);
  }, []);

  useEffect(() => {
    const chain = chainRef.current;
    if (!chain) return;
    chain.filter.frequency.rampTo(200 * Math.pow(90, macros.bloom / 100), 0.05);
  }, [macros.bloom]);

  useEffect(() => {
    const sends = sendsRef.current;
    if (!sends) return;
    const factor = (macros.shimmer / 100) * 1.4;
    Object.entries(sends).forEach(([id, gain]) => {
      const base = REVERB_SEND_BASE[id] ?? 0.1;
      gain.gain.rampTo(base * factor, 0.05);
    });
  }, [macros.shimmer]);

  useEffect(() => {
    const chain = chainRef.current;
    if (!chain) return;
    chain.distortion.distortion = (macros.fracture / 100) * 0.55;
    chain.distortion.wet.rampTo((macros.fracture / 100) * 0.6, 0.05);
  }, [macros.fracture]);

  useEffect(() => {
    const voices = voicesRef.current;
    if (!voices) return;
    voices.bassSub.volume.rampTo(-16 + (macros.gravity / 100) * 12, 0.05);
  }, [macros.gravity]);

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    const transport = Tone.getTransport();
    transport.swing = swing;
    transport.swingSubdivision = "16n";
  }, [swing]);

  useEffect(() => {
    if (!playing) return;
    const transport = Tone.getTransport();
    const id = transport.scheduleRepeat((time) => {
      if (!voicesRef.current) return;
      if (songMode) {
        const cursor = songCursorRef.current;
        if (cursor >= SONG_TOTAL_STEPS) {
          songCursorRef.current = 0;
          measureRef.current = 0;
          Tone.getDraw().schedule(() => {
            setPlaying(false);
            setSongProgress(0);
          }, time);
          return;
        }
        const loc = locateInSong(cursor);
        tracksRef.current.forEach((track) => {
          const cfg = loc.section.voices[track.voice];
          if (!cfg.active) return;
          const pat = cfg.pattern ?? track.pattern;
          if (pat[loc.stepInMeasure]) {
            triggerVoice(track, time, loc.stepInMeasure, loc.measureInSong);
          }
        });
        Tone.getDraw().schedule(() => {
          setStep(loc.stepInMeasure);
          setSongProgress(cursor);
        }, time);
        songCursorRef.current = cursor + 1;
      } else {
        const cursor = stepRef.current;
        const measure = measureRef.current;
        tracksRef.current.forEach((track) => {
          if (track.pattern[cursor]) triggerVoice(track, time, cursor, measure);
        });
        Tone.getDraw().schedule(() => setStep(cursor), time);
        const next = (cursor + 1) % STEPS;
        stepRef.current = next;
        if (next === 0) measureRef.current = measure + 1;
      }
    }, "16n");
    transport.start();
    return () => {
      transport.clear(id);
      transport.stop();
    };
  }, [playing, songMode, triggerVoice]);

  const composeSong = async () => {
    const prompt = composePrompt.trim();
    if (!prompt || composing) return;
    setComposing(true);
    setComposeError(null);
    setComposeRationale(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `request failed (${res.status})`);

      const s = data.song;
      if (!s || !Array.isArray(s.progression) || !Array.isArray(s.pluckMotif) || !Array.isArray(s.bassMotif)) {
        throw new Error("malformed song response");
      }

      setSong({
        name: s.name,
        key: s.key,
        mode: s.mode,
        progression: s.progression,
        pluckMotif: s.pluckMotif,
        bassMotif: s.bassMotif,
      });
      if (typeof s.bpm === "number") setBpm(Math.round(clamp(s.bpm, 72, 178)));
      if (typeof s.swing === "number") setSwing(clamp(s.swing, 0, 0.6));
      if (s.macros && typeof s.macros === "object") {
        setMacros((prev) => ({
          bloom: typeof s.macros.bloom === "number" ? clamp(s.macros.bloom, 0, 100) : prev.bloom,
          gravity: typeof s.macros.gravity === "number" ? clamp(s.macros.gravity, 0, 100) : prev.gravity,
          shimmer: typeof s.macros.shimmer === "number" ? clamp(s.macros.shimmer, 0, 100) : prev.shimmer,
          fracture: typeof s.macros.fracture === "number" ? clamp(s.macros.fracture, 0, 100) : prev.fracture,
        }));
      }
      if (typeof s.rationale === "string") setComposeRationale(s.rationale);
      setTracks((current) => current.map((track) => ({ ...track, pattern: makePattern(track, density, macros.gravity) })));
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : "compose failed");
    } finally {
      setComposing(false);
    }
  };

  const exportSong = async () => {
    if (exporting) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const sixteenthSec = 60 / bpm / 4;
      const songSec = SONG_TOTAL_STEPS * sixteenthSec;
      const tailSec = 4;
      const duration = songSec + tailSec;

      const tracksSnapshot = tracks;
      const songSnapshot = song;
      const macrosSnapshot = macros;
      const swingSnapshot = swing;
      const bpmSnapshot = bpm;

      const buffer = await Tone.Offline(() => {
        const graph = buildAudioGraph();
        applyMacrosInstant(graph, macrosSnapshot);

        const transport = Tone.getTransport();
        transport.bpm.value = bpmSnapshot;
        transport.swing = swingSnapshot;
        transport.swingSubdivision = "16n";

        const hatState: HatState = { count: 0 };

        for (let cursor = 0; cursor < SONG_TOTAL_STEPS; cursor++) {
          const loc = locateInSong(cursor);
          const stepCursor = cursor;
          transport.schedule((time) => {
            tracksSnapshot.forEach((track) => {
              const cfg = loc.section.voices[track.voice];
              if (!cfg.active) return;
              const pat = cfg.pattern ?? track.pattern;
              if (pat[loc.stepInMeasure]) {
                applyVoiceTrigger(graph, songSnapshot, hatState, track, time, loc.stepInMeasure, loc.measureInSong);
              }
            });
          }, `0:0:${stepCursor}`);
        }

        transport.start();
      }, duration, 2);

      setExportProgress(0.95);
      const wav = audioBufferToWav(buffer.get() as AudioBuffer);
      const url = URL.createObjectURL(wav);
      const a = document.createElement("a");
      const safeName = song.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      a.href = url;
      a.download = `${safeName}-${bpm}bpm-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportProgress(1);
    } catch (err) {
      console.error("export failed", err);
    } finally {
      setExporting(false);
      window.setTimeout(() => setExportProgress(0), 1200);
    }
  };

  const launch = async () => {
    await ensureAudio();
    setPlaying((value) => !value);
  };

  const regenerate = () => {
    const next = SCENE_TEMPLATES[Math.floor(Math.random() * SCENE_TEMPLATES.length)].name;
    setSong(buildSong(next));
    setTracks((current) => current.map((track) => ({ ...track, pattern: makePattern(track, density, macros.gravity) })));
  };

  const mutate = () => {
    setTracks((current) => current.map((track) => ({
      ...track,
      pattern: track.pattern.map((active, index) => (Math.random() < macros.fracture / 260 || index === step ? !active : active)),
    })));
  };

  const energy = useMemo(() => {
    const active = tracks.reduce((sum, track) => sum + track.pattern.filter(Boolean).length * track.level, 0);
    return Math.round((active / (tracks.length * STEPS)) * 100);
  }, [tracks]);

  const toggleStep = (trackIndex: number, stepIndex: number) => {
    setTracks((current) =>
      current.map((track, index) =>
        index === trackIndex
          ? { ...track, pattern: track.pattern.map((value, i) => (i === stepIndex ? !value : value)) }
          : track,
      ),
    );
  };

  const setLevel = (id: string, level: number) => {
    setTracks((current) => current.map((track) => (track.id === id ? { ...track, level } : track)));
  };

  const playheadPoint = polar(RING_RADII[0] + 16, step);
  const trail = [1, 2, 3].map((offset) => polar(RING_RADII[0] + 16, (step - offset + STEPS) % STEPS));

  const currentLocation = useMemo(() => locateInSong(songProgress), [songProgress]);
  const harmonyMeasure = songMode ? currentLocation.measureInSong : 0;
  const currentChord = activeChord(song, harmonyMeasure);
  const QUALITY_SUFFIX: Record<ChordQuality, string> = {
    maj: "", min: "m", dim: "°", maj7: "Δ7", min7: "m7", dom7: "7", sus2: "sus2", sus4: "sus4",
  };
  const chordRootName = chordNotes(song, currentChord, 3)[0].replace(/-?\d+$/, "");
  const chordLabel = `${chordRootName}${QUALITY_SUFFIX[currentChord.quality]}`;

  const effectivePatternFor = (track: Track): boolean[] => {
    if (!songMode) return track.pattern;
    const cfg = currentLocation.section.voices[track.voice];
    if (!cfg.active) return Array.from({ length: STEPS }, () => false);
    return cfg.pattern ?? track.pattern;
  };

  const isVoiceActive = (track: Track): boolean => {
    if (!songMode) return true;
    return currentLocation.section.voices[track.voice].active;
  };

  return (
    <main className="cosmos">
      <header className="cosmos-head">
        <div className="brand-pod">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="brand-text">
            <span className="brand-eyebrow">stump · the · schwab</span>
            <strong className="brand-title">MUSIC OS</strong>
            <span className="brand-version">v.001 — radial studio</span>
          </div>
        </div>
        <div className="head-readouts">
          <div className="readout">
            <span>scene · {song.key} {song.mode}</span>
            <strong>{song.name}</strong>
          </div>
          <div className="readout">
            <span>tempo</span>
            <strong>{bpm}<em>bpm</em></strong>
          </div>
          <div className="readout">
            <span>energy</span>
            <strong>{energy}<em>%</em></strong>
          </div>
          <div className={`readout pill ${playing ? "live" : ""}`}>
            <span className="dot" />
            <strong>{playing ? "live" : "armed"}</strong>
          </div>
          <button
            type="button"
            className={`mode-toggle ${songMode ? "is-song" : ""}`}
            onClick={toggleSongMode}
            aria-pressed={songMode}
          >
            <span>{songMode ? "song" : "loop"}</span>
            <em>{songMode ? "arrangement" : "16-step ring"}</em>
          </button>
        </div>
      </header>

      {songMode && (
        <nav className="song-form" aria-label="Song arrangement">
          {ARRANGEMENT.map((section, i) => {
            const isActive = i === currentLocation.sectionIndex;
            const isPast = i < currentLocation.sectionIndex;
            return (
              <div
                key={`${section.name}-${i}`}
                className={`form-block ${isActive ? "active" : ""} ${isPast ? "past" : ""}`}
                style={{ flexGrow: section.measures }}
                aria-current={isActive ? "step" : undefined}
              >
                <span>{section.name}</span>
                <em>
                  {isActive
                    ? `${currentLocation.measureInSection + 1}/${section.measures}`
                    : `${section.measures}m`}
                </em>
              </div>
            );
          })}
          <button
            type="button"
            className={`render-button ${exporting ? "is-exporting" : ""}`}
            onClick={exportSong}
            disabled={exporting}
          >
            <span>{exporting ? "rendering" : "render wav"}</span>
            <em>{exporting ? `${Math.round(exportProgress * 100)}%` : `${Math.round((SONG_TOTAL_STEPS * 60) / bpm / 4)}s`}</em>
          </button>
        </nav>
      )}

      <section className="cosmos-stage">
        <aside className="rack rack-left">
          <p className="rack-tag">channels / 06</p>
          <div className="strip-stack">
            {tracks.map((track) => {
              const pat = effectivePatternFor(track);
              const muted = !isVoiceActive(track);
              const firing = playing && pat[step] && !muted;
              return (
                <div
                  key={track.id}
                  className={`strip ${firing ? "is-firing" : ""} ${muted ? "is-muted" : ""}`}
                  style={{ "--strip-hue": track.hue } as React.CSSProperties}
                >
                  <div className="strip-head">
                    <span className="strip-glyph">{track.glyph}</span>
                    <div className="strip-id">
                      <strong>{track.name}</strong>
                      <span>{track.voice}</span>
                    </div>
                    <span className="strip-led" />
                  </div>
                  <div className="strip-fader">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.level}
                      onChange={(event) => setLevel(track.id, Number(event.target.value))}
                    />
                    <span className="strip-level">{Math.round(track.level * 100)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="orb">
          <div className="orb-frame">
            <svg className="orb-svg" viewBox={`0 0 ${ORB_VIEW} ${ORB_VIEW}`} role="img" aria-label="Radial sequencer">
              <defs>
                <radialGradient id="orb-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(139,92,246,0.55)" />
                  <stop offset="60%" stopColor="rgba(34,211,238,0.18)" />
                  <stop offset="100%" stopColor="rgba(2,6,23,0)" />
                </radialGradient>
                <linearGradient id="playhead" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.95)" />
                </linearGradient>
              </defs>

              <circle cx={ORB_CENTER} cy={ORB_CENTER} r="320" className="orb-halo" fill="url(#orb-core)" />

              {RING_RADII.map((radius, ringIndex) => (
                <circle
                  key={`guide-${ringIndex}`}
                  cx={ORB_CENTER}
                  cy={ORB_CENTER}
                  r={radius}
                  className="ring-guide"
                  style={{ stroke: `hsla(${tracks[ringIndex].hue}, 70%, 60%, 0.18)` }}
                />
              ))}

              {Array.from({ length: STEPS }, (_, i) => {
                const downbeat = i % 4 === 0;
                const inner = polar(RING_RADII[RING_RADII.length - 1] - 18, i);
                const outer = polar(RING_RADII[0] + 8, i);
                return (
                  <line
                    key={`spoke-${i}`}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    className={`spoke ${downbeat ? "spoke-major" : ""}`}
                  />
                );
              })}

              {trail.map((point, idx) => (
                <line
                  key={`trail-${idx}`}
                  x1={ORB_CENTER}
                  y1={ORB_CENTER}
                  x2={point.x}
                  y2={point.y}
                  className="playhead-trail"
                  style={{ opacity: (3 - idx) / 8 }}
                />
              ))}

              <line
                x1={ORB_CENTER}
                y1={ORB_CENTER}
                x2={playheadPoint.x}
                y2={playheadPoint.y}
                className={`playhead ${playing ? "spinning" : ""}`}
                stroke="url(#playhead)"
              />
              <circle cx={playheadPoint.x} cy={playheadPoint.y} r="6" className="playhead-tip" />

              {tracks.map((track, trackIndex) => {
                const pat = effectivePatternFor(track);
                const muted = !isVoiceActive(track);
                return pat.map((active, stepIndex) => {
                  const point = polar(RING_RADII[trackIndex], stepIndex);
                  const isCurrent = stepIndex === step;
                  const firing = isCurrent && active && !muted;
                  return (
                    <g key={`${track.id}-${stepIndex}`} className={`step-node ${active ? "is-on" : ""} ${isCurrent ? "is-current" : ""} ${firing ? "is-firing" : ""} ${muted ? "is-muted" : ""}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={STEP_RADIUS + 6}
                        className="step-halo"
                        style={{ fill: `hsla(${track.hue}, 90%, 62%, ${muted ? 0.04 : 0.22})` }}
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={STEP_RADIUS}
                        className="step-cell"
                        style={{
                          fill: active && !muted ? `hsl(${track.hue}, 88%, 62%)` : "rgba(255,255,255,0.05)",
                          stroke: active && !muted
                            ? `hsla(${track.hue}, 92%, 78%, 0.85)`
                            : `hsla(${track.hue}, 70%, 60%, ${muted ? 0.12 : 0.35})`,
                          opacity: muted ? 0.4 : 1,
                        }}
                        onClick={() => !songMode && toggleStep(trackIndex, stepIndex)}
                      />
                    </g>
                  );
                });
              })}

              {Array.from({ length: STEPS }, (_, i) => {
                const point = polar(RING_RADII[0] + 30, i);
                return (
                  <text
                    key={`num-${i}`}
                    x={point.x}
                    y={point.y}
                    className={`step-number ${i % 4 === 0 ? "step-number-major" : ""}`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </text>
                );
              })}
            </svg>

            <div className="orb-core-text">
              <span>{songMode ? currentLocation.section.name : "chord"}</span>
              <strong>{chordLabel}</strong>
              <span className="orb-step">
                {songMode
                  ? `bar ${currentLocation.measureInSong + 1} / ${SONG_TOTAL_MEASURES}`
                  : `step ${String(step + 1).padStart(2, "0")} / 16 · ${energy}%`}
              </span>
            </div>
          </div>
        </div>

        <aside className="rack rack-right">
          <p className="rack-tag">macro / sound design</p>
          <div className="rotary-grid">
            <Rotary label="bloom" hue={270} value={macros.bloom} min={0} max={100}
              onChange={(v) => setMacros((m) => ({ ...m, bloom: v }))} />
            <Rotary label="gravity" hue={154} value={macros.gravity} min={0} max={100}
              onChange={(v) => setMacros((m) => ({ ...m, gravity: v }))} />
            <Rotary label="shimmer" hue={190} value={macros.shimmer} min={0} max={100}
              onChange={(v) => setMacros((m) => ({ ...m, shimmer: v }))} />
            <Rotary label="fracture" hue={318} value={macros.fracture} min={0} max={100}
              onChange={(v) => setMacros((m) => ({ ...m, fracture: v }))} />
          </div>
          <div className="vis-card">
            <p>spectrum</p>
            <div className="vis-bars">
              {tracks.map((track, index) => (
                <span
                  key={track.id}
                  style={{
                    "--track-hue": track.hue,
                    "--height": `${20 + track.pattern.filter(Boolean).length * 5 + (track.level * 24)}%`,
                    animationDelay: `${index * 110}ms`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
          <div className="compose">
            <span>compose with claude</span>
            <textarea
              className="compose-input"
              value={composePrompt}
              onChange={(e) => setComposePrompt(e.target.value)}
              placeholder="dark phrygian halftime trap, 80 bpm, lots of grit"
              rows={3}
              maxLength={1200}
              disabled={composing}
            />
            <button
              type="button"
              className={`compose-button ${composing ? "is-thinking" : ""}`}
              onClick={composeSong}
              disabled={composing || !composePrompt.trim()}
            >
              {composing ? "thinking…" : "compose"}
            </button>
            {composeError && <p className="compose-error">{composeError}</p>}
            {composeRationale && !composeError && (
              <p className="compose-rationale">{composeRationale}</p>
            )}
          </div>
        </aside>
      </section>

      <footer className="dock">
        <button
          className={`dock-play ${playing ? "is-playing" : ""}`}
          onClick={launch}
          aria-label={playing ? "Pause engine" : "Start engine"}
        >
          <span className="dock-play-icon">{playing ? "❚❚" : "▶"}</span>
          <span className="dock-play-label">{playing ? "pause" : "ignite"}</span>
        </button>

        <div className="dock-slider">
          <span>tempo</span>
          <input type="range" min="72" max="178" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          <strong>{bpm}</strong>
        </div>

        <div className="dock-slider">
          <span>swing</span>
          <input type="range" min="0" max="0.6" step="0.01" value={swing} onChange={(e) => setSwing(Number(e.target.value))} />
          <strong>{Math.round(swing * 100)}%</strong>
        </div>

        <div className="dock-slider">
          <span>density</span>
          <input type="range" min="12" max="96" value={density} onChange={(e) => setDensity(Number(e.target.value))} />
          <strong>{density}%</strong>
        </div>

        <button className="dock-action" onClick={regenerate}>
          <span>generate</span>
          <em>new world</em>
        </button>
        <button className="dock-action variant" onClick={mutate}>
          <span>fracture</span>
          <em>shift pattern</em>
        </button>
      </footer>
    </main>
  );
}
