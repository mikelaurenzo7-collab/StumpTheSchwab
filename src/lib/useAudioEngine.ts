"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { useEngineStore, type Track, type TrackEffects, type MasterBus, type ModLfoTarget, type AutomationTarget, type AutomationPoint } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";
import { getStepDurationSeconds, getStepSubdivision } from "@/lib/stepTiming";

export type SynthNode =
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.NoiseSynth
  | Tone.Synth
  | Tone.AMSynth
  | Tone.FMSynth
  | Tone.MonoSynth
  | Tone.Sampler
  | Tone.Player
  | Tone.UserMedia;

interface TrackFXChain {
  bitCrusher: Tone.BitCrusher;
  chorus: Tone.Chorus;
  drive: Tone.Distortion;
  filter: Tone.Filter;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  delayGain: Tone.Gain; // delay send level
  reverbGain: Tone.Gain; // reverb send level
  dryGain: Tone.Gain; // dry path level
}

interface MasterChain {
  gain: Tone.Gain;
  tape: Tone.Distortion;
  widener: Tone.StereoWidener;
  eq: Tone.EQ3;
  compressor: Tone.Compressor;
  limiter: Tone.Limiter;
}

export function createSynth(sound: TrackSound): SynthNode {
  const opts = (sound.options ?? {}) as Record<string, unknown>;
  switch (sound.synth) {
    case "mic": {
      const mic = new Tone.UserMedia();
      mic.open().catch(err => console.warn("Could not access microphone", err));
      return mic;
    }
    case "membrane":
      return new Tone.MembraneSynth(opts as ConstructorParameters<typeof Tone.MembraneSynth>[0]);
    case "metal":
      return new Tone.MetalSynth(opts as ConstructorParameters<typeof Tone.MetalSynth>[0]);
    case "noise":
      return new Tone.NoiseSynth(opts as ConstructorParameters<typeof Tone.NoiseSynth>[0]);
    case "am":
      return new Tone.AMSynth(opts as ConstructorParameters<typeof Tone.AMSynth>[0]);
    case "fm":
      return new Tone.FMSynth(opts as ConstructorParameters<typeof Tone.FMSynth>[0]);
    case "monosynth":
      return new Tone.MonoSynth(opts as ConstructorParameters<typeof Tone.MonoSynth>[0]);
    case "synth":
    default:
      return new Tone.Synth(opts as ConstructorParameters<typeof Tone.Synth>[0]);
  }
}


export function triggerSynth(
  synth: SynthNode,
  sound: TrackSound,
  time: number,
  velocity: number,
  duration: string | number,
  noteOverride?: string,
) {
  if (synth instanceof Tone.UserMedia) {
    // Mic input is continuous, no trigger needed. (Could implement a gate or recording envelope later).
    return;
  } else if (synth instanceof Tone.Player) {
    // Reverse/sample player — start at the scheduled time.
    // Scale volume by velocity: Player.volume is in dB.
    const dbVelocity = 20 * Math.log10(Math.max(0.001, velocity));
    synth.volume.setValueAtTime(dbVelocity, time);
    synth.start(time);
  } else if (synth instanceof Tone.NoiseSynth) {
    synth.triggerAttackRelease(duration, time, velocity);
  } else if (synth instanceof Tone.Sampler) {
    if (!synth.loaded) return;
    const note = noteOverride || sound.note;
    synth.triggerAttackRelease(note, duration, time, velocity);
  } else {
    const note = noteOverride || sound.note;
    (synth as Tone.Synth).triggerAttackRelease(note, duration, time, velocity);
  }
}

function createTrackFX(destination: Tone.InputNode): TrackFXChain {
  // Signal: synth → bitCrusher → chorus → drive → filter → (dry / delay / reverb sends) → destination
  // The crusher leads the chain so the drive/filter shape its aliased harmonics
  // rather than introducing them after the fact (this is how classic lo-fi
  // boxes sound — gritty THEN saturated, not the reverse). Chorus widens the
  // crushed signal before any drive squashes the stereo image.
  const bitCrusher = new Tone.BitCrusher(8);
  bitCrusher.wet.value = 0;
  const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.5 });
  chorus.wet.value = 0;
  // Tone.Chorus needs its internal LFOs started; otherwise the modulation
  // is silent. We always start it — when wet=0 it has no audible effect.
  chorus.start();
  bitCrusher.connect(chorus);

  // Drive shapes harmonics BEFORE the filter so the filter can tame any harshness.
  const drive = new Tone.Distortion({ distortion: 0, wet: 1 });
  chorus.connect(drive);

  const filter = new Tone.Filter({ frequency: 20000, type: "lowpass", Q: 1 });
  drive.connect(filter);

  const delay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.3, wet: 1 });
  const delayGain = new Tone.Gain(0);
  const dryGain = new Tone.Gain(1);

  const reverb = new Tone.Reverb({ decay: 1.5, wet: 1 });
  // Tone.Reverb is a convolver — it needs an impulse response generated
  // before it produces sound. Without this, the reverb send is silent until
  // the IR finishes rendering on the user's first interaction. Kick it off
  // immediately so it's ready before playback starts.
  void reverb.generate();
  const reverbGain = new Tone.Gain(0);

  filter.connect(dryGain);
  filter.connect(delay);
  filter.connect(reverb);

  delay.connect(delayGain);
  reverb.connect(reverbGain);

  dryGain.connect(destination as unknown as Tone.ToneAudioNode);
  delayGain.connect(destination as unknown as Tone.ToneAudioNode);
  reverbGain.connect(destination as unknown as Tone.ToneAudioNode);

  return { bitCrusher, chorus, drive, filter, delay, reverb, delayGain, reverbGain, dryGain };
}

function applyTrackFX(fx: TrackFXChain, effects: TrackEffects) {
  // Bit crusher — bits Param controls the quantizer. wet handles dry/wet mix
  // so even at 1 bit a low wet keeps the original signal dominant.
  if (effects.bitCrushOn) {
    // Clamp to Tone's documented 1..16 range. Lower = grittier.
    const bits = Math.max(1, Math.min(16, Math.round(effects.bitCrushBits)));
    fx.bitCrusher.bits.value = bits;
    fx.bitCrusher.wet.value = effects.bitCrushWet;
  } else {
    fx.bitCrusher.wet.value = 0;
  }

  // Chorus — frequency is the LFO rate; depth widens the modulation. wet mixes
  // dry centre against the modulated stereo split.
  if (effects.chorusOn) {
    fx.chorus.frequency.value = effects.chorusRate;
    fx.chorus.depth = effects.chorusDepth;
    fx.chorus.wet.value = effects.chorusWet;
  } else {
    fx.chorus.wet.value = 0;
  }

  // Drive — Tone.Distortion's `distortion` is 0..1; combined with oversampling
  // it gives a clean tape-saturation feel at low values and a meaty crunch high.
  if (effects.driveOn) {
    fx.drive.distortion = effects.driveAmount;
    fx.drive.wet.value = 1;
    fx.drive.oversample = "2x";
  } else {
    fx.drive.distortion = 0;
    fx.drive.wet.value = 0;
  }

  if (effects.filterOn) {
    fx.filter.frequency.value = effects.filterFreq;
    fx.filter.type = effects.filterType;
    fx.filter.Q.value = effects.filterQ;
  } else {
    fx.filter.frequency.value = 20000;
    fx.filter.type = "lowpass";
    fx.filter.Q.value = 1;
  }

  if (effects.delayOn) {
    fx.delay.delayTime.value = effects.delayTime;
    fx.delay.feedback.value = effects.delayFeedback;
    fx.delayGain.gain.value = effects.delayWet;
  } else {
    fx.delayGain.gain.value = 0;
  }

  if (effects.reverbOn) {
    fx.reverb.decay = effects.reverbDecay;
    fx.reverbGain.gain.value = effects.reverbWet;
  } else {
    fx.reverbGain.gain.value = 0;
  }
}

// Maps a Mod LFO target to the destination AudioParam plus a depth scaler.
// Depth (0..1) is mapped into a sensible swing range per parameter so the
// modulation feels musical rather than clipping or inaudible.
function modLfoDestination(
  target: ModLfoTarget,
  fx: TrackFXChain,
  gain: Tone.Gain,
): { param: Tone.Param<"frequency"> | Tone.Param<"normalRange"> | Tone.Param<"gain"> | Tone.Signal | null; range: number } | null {
  switch (target) {
    case "filterFreq":
      // ±3.5 kHz sweep at full depth. Filter base sits at user setting; LFO
      // sums into the param so the cutoff dances around it.
      return { param: fx.filter.frequency as unknown as Tone.Signal, range: 3500 };
    case "drive":
      // Modulate distortion wet (0..1). Param is a Signal in Tone.Distortion.
      return { param: fx.drive.wet as unknown as Tone.Signal, range: 0.5 };
    case "delayFeedback":
      return { param: fx.delay.feedback as unknown as Tone.Signal, range: 0.35 };
    case "reverbWet":
      return { param: fx.reverbGain.gain as unknown as Tone.Signal, range: 0.5 };
    case "volume":
      return { param: gain.gain as unknown as Tone.Signal, range: 0.4 };
    default:
      return null;
  }
}

function routeModLfo(
  entry: { lfo: Tone.LFO; target: ModLfoTarget | null },
  effects: TrackEffects,
  fx: TrackFXChain,
  gain: Tone.Gain,
) {
  // Always update rate/shape — cheap.
  entry.lfo.frequency.value = effects.modLfoRate;
  entry.lfo.type = effects.modLfoShape;

  const wantTarget = effects.modLfoOn ? effects.modLfoTarget : null;

  // If target changed (or turning off), tear down old connection.
  if (entry.target !== wantTarget) {
    if (entry.target) {
      const prev = modLfoDestination(entry.target, fx, gain);
      if (prev?.param) {
        try { entry.lfo.disconnect(prev.param as unknown as Tone.InputNode); } catch {}
      }
    }
    entry.target = wantTarget;
    if (wantTarget) {
      const next = modLfoDestination(wantTarget, fx, gain);
      if (next?.param) entry.lfo.connect(next.param as unknown as Tone.InputNode);
    }
  }

  // Update swing range for current target.
  if (wantTarget) {
    const dest = modLfoDestination(wantTarget, fx, gain);
    if (dest) {
      const range = dest.range * effects.modLfoDepth;
      entry.lfo.min = -range;
      entry.lfo.max = range;
    }
    if (entry.lfo.state !== "started") entry.lfo.start();
  } else {
    if (entry.lfo.state === "started") entry.lfo.stop();
    entry.lfo.min = 0;
    entry.lfo.max = 0;
  }
}

// ── Automation helpers ──────────────────────────────────────────────────────
// Linear interpolation between sorted automation points at a normalized
// position (0..1). Returns null if there are no points.
function interpolateAutomation(points: AutomationPoint[], position: number): number | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.position - b.position);
  if (position <= sorted[0].position) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (position >= last.position) return last.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (position >= a.position && position <= b.position) {
      const t = (b.position - a.position < 1e-9)
        ? 0
        : (position - a.position) / (b.position - a.position);
      return a.value + t * (b.value - a.value);
    }
  }
  return null;
}

// Schedule a sample-accurate automation value onto the appropriate AudioParam.
// Uses setValueAtTime so it integrates with Tone.js look-ahead scheduling
// rather than overwriting the AudioParam's instantaneous value.
function scheduleAutomationValue(
  target: AutomationTarget,
  value: number,
  time: number,
  gainNodes: Tone.Gain[],
  panNodes: Tone.Panner[],
  fxChains: TrackFXChain[],
  masterChain: MasterChain | null,
) {
  if (target === "bpm") {
    Tone.getTransport().bpm.setValueAtTime(value, time);
    return;
  }
  if (target === "master.volume") {
    masterChain?.gain.gain.setValueAtTime(value, time);
    return;
  }
  const parts = target.split(".");
  if (parts[0] !== "track") return;
  const trackIdx = parseInt(parts[1], 10);
  if (isNaN(trackIdx)) return;
  const paramPath = parts.slice(2).join(".");
  switch (paramPath) {
    case "volume":
      gainNodes[trackIdx]?.gain.setValueAtTime(value, time);
      break;
    case "pan":
      panNodes[trackIdx]?.pan.setValueAtTime(value, time);
      break;
    case "effects.filterFreq":
      fxChains[trackIdx]?.filter.frequency.setValueAtTime(value, time);
      break;
    case "effects.delayWet":
      fxChains[trackIdx]?.delayGain.gain.setValueAtTime(value, time);
      break;
    case "effects.reverbWet":
      fxChains[trackIdx]?.reverbGain.gain.setValueAtTime(value, time);
      break;
  }
}

function createMasterChain(): MasterChain {
  const master = useEngineStore.getState().master;
  // Order: gain → tape (warmth) → widener (M/S width) → eq → comp → limiter → out.
  // Tape lives early so its harmonics get shaped by EQ; widener after tape so the
  // added harmonic content is what we widen, not just the dry signal.
  const limiter = new Tone.Limiter(master.limiterThreshold).toDestination();
  const compressor = new Tone.Compressor({
    threshold: master.compressorThreshold,
    ratio: master.compressorRatio,
    attack: master.compressorAttack,
    release: master.compressorRelease,
  }).connect(limiter);
  const eq = new Tone.EQ3({
    low: master.eqOn ? master.eqLow : 0,
    mid: master.eqOn ? master.eqMid : 0,
    high: master.eqOn ? master.eqHigh : 0,
  }).connect(compressor);
  // Width: 0 = mono, 0.5 = neutral, 1 = wide. When off we sit at 0.5.
  const widener = new Tone.StereoWidener({
    width: master.widthOn ? master.width : 0.5,
  }).connect(eq);
  // Tape: drive the distortion gently (cap at 0.4 so even max stays musical).
  // 2x oversampling avoids the digital alias-hash that makes plug-in distortion
  // sound brittle on cymbals and hats.
  const tape = new Tone.Distortion({
    distortion: master.tapeOn ? master.tapeAmount * 0.4 : 0,
    wet: master.tapeOn ? 1 : 0,
    oversample: "2x",
  }).connect(widener);
  const gain = new Tone.Gain(master.volume).connect(tape);
  return { gain, tape, widener, eq, compressor, limiter };
}

function applyMasterSettings(chain: MasterChain, master: MasterBus) {
  chain.gain.gain.value = master.volume;

  if (master.tapeOn) {
    chain.tape.distortion = master.tapeAmount * 0.4;
    chain.tape.wet.value = 1;
  } else {
    chain.tape.distortion = 0;
    chain.tape.wet.value = 0;
  }

  // Widener exposes width as a single normal-range param (0 mono → 1 wide).
  // Bypass = sit at 0.5 so the stereo image is left untouched.
  chain.widener.width.value = master.widthOn ? master.width : 0.5;

  if (master.eqOn) {
    chain.eq.low.value = master.eqLow;
    chain.eq.mid.value = master.eqMid;
    chain.eq.high.value = master.eqHigh;
  } else {
    chain.eq.low.value = 0;
    chain.eq.mid.value = 0;
    chain.eq.high.value = 0;
  }

  if (master.compressorOn) {
    chain.compressor.threshold.value = master.compressorThreshold;
    chain.compressor.ratio.value = master.compressorRatio;
    chain.compressor.attack.value = master.compressorAttack;
    chain.compressor.release.value = master.compressorRelease;
  } else {
    // Bypass: threshold at max so signal never exceeds it, ratio 1:1
    chain.compressor.threshold.value = 0;
    chain.compressor.ratio.value = 1;
    chain.compressor.attack.value = 0.003;
    chain.compressor.release.value = 0.25;
  }

  if (master.limiterOn) {
    chain.limiter.threshold.value = master.limiterThreshold;
  } else {
    // Bypass: set ceiling so high it never limits
    chain.limiter.threshold.value = 6;
  }
}

export function useAudioEngine() {
  const synthsRef = useRef<SynthNode[]>([]);
  const gainNodesRef = useRef<Tone.Gain[]>([]);
  const duckGainsRef = useRef<Tone.Gain[]>([]);
  const panNodesRef = useRef<Tone.Panner[]>([]);
  const fxChainsRef = useRef<TrackFXChain[]>([]);
  const masterChainRef = useRef<MasterChain | null>(null);
  const sequenceRef = useRef<Tone.Sequence | null>(null);
  const initializedRef = useRef(false);
  const trackMetersRef = useRef<Tone.Meter[]>([]);
  const panLfosRef = useRef<Tone.LFO[]>([]);
  const modLfosRef = useRef<{ lfo: Tone.LFO; target: ModLfoTarget | null }[]>([]);
  const masterMeterRef = useRef<Tone.Meter | null>(null);
  const masterFFTRef = useRef<Tone.FFT | null>(null);
  const masterWaveformRef = useRef<Tone.Waveform | null>(null);

  const initAudio = useCallback(async () => {
    if (initializedRef.current) return;
    await Tone.start();
    initializedRef.current = true;

    const tracks = useEngineStore.getState().tracks;

    // Create master bus chain
    const masterChain = createMasterChain();
    masterChainRef.current = masterChain;

    // Create synths + per-track FX chains + panner + gain nodes
    synthsRef.current = [];
    gainNodesRef.current = [];
    duckGainsRef.current = [];
    panNodesRef.current = [];
    fxChainsRef.current = [];
    trackMetersRef.current = [];
    panLfosRef.current = [];
    modLfosRef.current = [];

    // Master meter
    const masterMeter = new Tone.Meter({ smoothing: 0.8 });
    masterChain.gain.connect(masterMeter);
    masterMeterRef.current = masterMeter;

    // Master FFT + waveform for the visualizer. 1024 bins is plenty for a
    // log-scaled bar display; we only read it from rAF, not the audio thread.
    const masterFFT = new Tone.FFT({ size: 1024, smoothing: 0.7 });
    masterChain.gain.connect(masterFFT);
    masterFFTRef.current = masterFFT;

    const masterWaveform = new Tone.Waveform(512);
    masterChain.gain.connect(masterWaveform);
    masterWaveformRef.current = masterWaveform;

    tracks.forEach((track) => {
      // Signal chain: Synth → FX → Gain → DuckGain → Meter → Panner → Master
      // DuckGain sits AFTER the user volume so the sidechain ducks the whole
      // signal (including wet effects). The meter reads post-duck so the UI
      // reflects what's actually heard.
      const panner = new Tone.Panner(track.pan).connect(masterChain.gain);
      const duckGain = new Tone.Gain(1).connect(panner);
      const gain = new Tone.Gain(track.volume).connect(duckGain);

      const meter = new Tone.Meter({ smoothing: 0.8 });
      duckGain.connect(meter);
      trackMetersRef.current.push(meter);

      const fx = createTrackFX(gain);
      applyTrackFX(fx, track.effects);

      let synth: SynthNode;
      if (track.customSampleUrl) {
        const player = new Tone.Player({ url: track.customSampleUrl });
        player.reverse = track.sampleReverse;
        if (track.samplePitchShift !== 0) {
          player.playbackRate = Math.pow(2, track.samplePitchShift / 12);
        }
        synth = player;
      } else {
        synth = createSynth(track.sound);
      }
      synth.connect(fx.bitCrusher);

      // Per-track auto-pan LFO. Always connected to panner.pan; AudioParams
      // sum input signals with the param's intrinsic value, so the LFO
      // oscillates AROUND the user's manual pan setting. When the LFO is
      // stopped, output is 0 and the manual pan remains effective.
      const panLfo = new Tone.LFO({
        frequency: track.effects.panLfoRate,
        type: track.effects.panLfoShape,
        min: -track.effects.panLfoDepth,
        max: track.effects.panLfoDepth,
      });
      panLfo.connect(panner.pan);
      if (track.effects.panLfoOn) panLfo.start();

      // Parametric Mod LFO — created idle. routeModLfo() connects/disconnects
      // it to the chosen destination AudioParam when target/depth/on changes.
      const modLfo = new Tone.LFO({
        frequency: track.effects.modLfoRate,
        type: track.effects.modLfoShape,
        min: 0,
        max: 0,
      });
      const modEntry = { lfo: modLfo, target: null as ModLfoTarget | null };
      routeModLfo(modEntry, track.effects, fx, gain);

      synthsRef.current.push(synth);
      gainNodesRef.current.push(gain);
      duckGainsRef.current.push(duckGain);
      panNodesRef.current.push(panner);
      fxChainsRef.current.push(fx);
      panLfosRef.current.push(panLfo);
      modLfosRef.current.push(modEntry);
    });
  }, []);

  // Sync BPM + swing. LFO frequencies are tempo-synced via Tone.Time strings
  // ("4n", "8n", etc) — they parse using the BPM at the moment of assignment,
  // so we re-set them whenever BPM changes to keep modulation in time.
  useEffect(() => {
    let prevBpm = useEngineStore.getState().bpm;
    const unsub = useEngineStore.subscribe((state) => {
      Tone.getTransport().bpm.value = state.bpm;
      Tone.getTransport().swing = state.swing;
      if (state.bpm !== prevBpm) {
        prevBpm = state.bpm;
        state.tracks.forEach((track, i) => {
          const lfo = panLfosRef.current[i];
          if (lfo) lfo.frequency.value = track.effects.panLfoRate;
          const mod = modLfosRef.current[i];
          if (mod) mod.lfo.frequency.value = track.effects.modLfoRate;
        });
      }
    });
    return unsub;
  }, []);

  // Sync mixer (volume, mute, solo, pan)
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      const hasSolo = state.tracks.some((t) => t.solo);
      state.tracks.forEach((track, i) => {
        const gain = gainNodesRef.current[i];
        const panner = panNodesRef.current[i];
        if (!gain) return;
        const audible = hasSolo ? track.solo && !track.muted : !track.muted;
        gain.gain.value = audible ? track.volume : 0;
        if (panner) panner.pan.value = track.pan;
      });
    });
    return unsub;
  }, []);

  // Sync macro control values to their audio targets in real-time
  useEffect(() => {
    let prevMacros = useEngineStore.getState().patterns[useEngineStore.getState().currentPattern]?.macros ?? [];
    const unsub = useEngineStore.subscribe((state) => {
      const macros = state.patterns[state.currentPattern]?.macros ?? [];
      if (macros === prevMacros) return;
      prevMacros = macros;
      const now = Tone.now();
      macros.forEach((macro) => {
        macro.targets.forEach(({ target, min, max, curve }) => {
          let scaled = min + macro.value * (max - min);
          if (curve === "exp" && macro.value > 0) {
            scaled = min * Math.pow(max / Math.max(min, 0.001), macro.value);
          } else if (curve === "log") {
            scaled = min + Math.log1p(macro.value * (Math.E - 1)) / 1 * (max - min);
          }
          scheduleAutomationValue(
            target,
            scaled,
            now,
            gainNodesRef.current,
            panNodesRef.current,
            fxChainsRef.current,
            masterChainRef.current,
          );
        });
      });
    });
    return unsub;
  }, []);

  // Sync per-track effects (incl. auto-pan LFO state)
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      state.tracks.forEach((track, i) => {
        const fx = fxChainsRef.current[i];
        if (fx) applyTrackFX(fx, track.effects);

        const lfo = panLfosRef.current[i];
        if (!lfo) return;
        lfo.min = -track.effects.panLfoDepth;
        lfo.max = track.effects.panLfoDepth;
        lfo.frequency.value = track.effects.panLfoRate;
        lfo.type = track.effects.panLfoShape;
        if (track.effects.panLfoOn && lfo.state !== "started") {
          lfo.start();
        } else if (!track.effects.panLfoOn && lfo.state === "started") {
          lfo.stop();
        }

        // Mod LFO routing/depth/state
        const modEntry = modLfosRef.current[i];
        const fxChain = fxChainsRef.current[i];
        const trackGain = gainNodesRef.current[i];
        if (modEntry && fxChain && trackGain) {
          routeModLfo(modEntry, track.effects, fxChain, trackGain);
        }
      });
    });
    return unsub;
  }, []);

  // Hot-swap synths when a custom sample is loaded/cleared, or reverse/pitch changes
  useEffect(() => {
    const prevUrls: (string | null)[] = useEngineStore
      .getState()
      .tracks.map((t) => t.customSampleUrl);
    const prevReverse: boolean[] = useEngineStore
      .getState()
      .tracks.map((t) => t.sampleReverse);
    const prevPitch: number[] = useEngineStore
      .getState()
      .tracks.map((t) => t.samplePitchShift);

    const unsub = useEngineStore.subscribe((state) => {
      state.tracks.forEach((track, i) => {
        const prevUrl = prevUrls[i] ?? null;
        const currUrl = track.customSampleUrl;
        const currReverse = track.sampleReverse;
        const currPitch = track.samplePitchShift;

        const urlChanged = currUrl !== prevUrl;
        const reverseChanged = currReverse !== prevReverse[i];
        const pitchChanged = currPitch !== prevPitch[i];

        // Update in-place when only pitch changed and a Player is already loaded
        if (!urlChanged && !reverseChanged && pitchChanged && currUrl) {
          const existing = synthsRef.current[i];
          if (existing instanceof Tone.Player) {
            existing.playbackRate = Math.pow(2, currPitch / 12);
            prevPitch[i] = currPitch;
          }
          return;
        }

        // Update reverse in-place when only reverse changed
        if (!urlChanged && reverseChanged && !pitchChanged && currUrl) {
          const existing = synthsRef.current[i];
          if (existing instanceof Tone.Player) {
            existing.reverse = currReverse;
            prevReverse[i] = currReverse;
          }
          return;
        }

        if (!urlChanged) return;

        prevUrls[i] = currUrl;
        prevReverse[i] = currReverse;
        prevPitch[i] = currPitch;

        const fx = fxChainsRef.current[i];
        if (!fx) return;

        const oldSynth = synthsRef.current[i];
        if (currUrl) {
          const player = new Tone.Player({
            url: currUrl,
            onload: () => {
              player.reverse = currReverse;
              player.playbackRate = currPitch !== 0 ? Math.pow(2, currPitch / 12) : 1;
              player.connect(fx.bitCrusher);
              synthsRef.current[i] = player;
              oldSynth?.dispose();
            },
          });
        } else {
          const synth = createSynth(track.sound);
          synth.connect(fx.bitCrusher);
          synthsRef.current[i] = synth;
          oldSynth?.dispose();
        }
      });
    });
    return unsub;
  }, []);

  // Hot-swap / live-update synth params when track.sound changes
  // (Sound Editor: tweaking ADSR, oscillator type, filter env, or full voice swap.)
  useEffect(() => {
    const prevSounds: TrackSound[] = useEngineStore
      .getState()
      .tracks.map((t) => t.sound);

    const unsub = useEngineStore.subscribe((state) => {
      state.tracks.forEach((track, i) => {
        const prev = prevSounds[i];
        const curr = track.sound;
        if (prev === curr) return;
        prevSounds[i] = curr;

        // Skip while a custom sample is loaded — the sampler owns that slot.
        if (track.customSampleUrl) return;

        const fx = fxChainsRef.current[i];
        if (!fx) return;
        const oldSynth = synthsRef.current[i];

        // If the synth voice type changed, we must recreate.
        if (!prev || prev.synth !== curr.synth) {
          const synth = createSynth(curr);
          synth.connect(fx.bitCrusher);
          synthsRef.current[i] = synth;
          oldSynth?.dispose();
          return;
        }

        // Same voice — try to apply new options in-place to avoid clicks.
        if (oldSynth && curr.options) {
          try {
            // Tone synths accept partial option objects via .set()
            (oldSynth as unknown as { set: (o: Record<string, unknown>) => void }).set(curr.options);
          } catch {
            // Fallback: rebuild
            const synth = createSynth(curr);
            synth.connect(fx.bitCrusher);
            synthsRef.current[i] = synth;
            oldSynth.dispose();
          }
        }
      });
    });
    return unsub;
  }, []);

  // Sync master bus
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      const chain = masterChainRef.current;
      if (!chain) return;
      applyMasterSettings(chain, state.master);
    });
    return unsub;
  }, []);

  // Playback control
  useEffect(() => {
    let prevPlaybackState = useEngineStore.getState().playbackState;
    let needsChainAdvance = false;

    const unsub = useEngineStore.subscribe((state) => {
      const playbackState = state.playbackState;
      if (playbackState === prevPlaybackState) return;
      prevPlaybackState = playbackState;

      const transport = Tone.getTransport();
      if (playbackState === "playing") {
        if (sequenceRef.current) {
          sequenceRef.current.dispose();
        }

        const startState = useEngineStore.getState();
        const { totalSteps, setCurrentStep } = startState;
        const stepIndices = Array.from({ length: totalSteps }, (_, i) => i);

        transport.bpm.value = startState.bpm;
        transport.swing = startState.swing;

        // If song mode is on with a chain, jump to the first pattern in the chain
        if (startState.songMode && startState.chain.length > 0) {
          const firstPattern = startState.chain[0];
          if (firstPattern !== startState.currentPattern) {
            startState.switchPatternSilent(firstPattern);
          }
          startState.setChainPosition(0);
          // Apply slot 0's BPM/swing override on initial play.
          const meta0 = startState.chainMeta[0];
          if (meta0?.bpmOverride != null) transport.bpm.value = meta0.bpmOverride;
          if (meta0?.swingOverride != null) transport.swing = meta0.swingOverride;
        }
        needsChainAdvance = false;

        sequenceRef.current = new Tone.Sequence(
          (time, stepIndex) => {
            // Advance chain at the start of a new loop iteration
            if (needsChainAdvance && stepIndex === 0) {
              const { songMode, chain, chainMeta, chainPosition, switchPatternSilent, setChainPosition } =
                useEngineStore.getState();
              if (songMode && chain.length > 0) {
                const nextPos = (chainPosition + 1) % chain.length;
                const nextPattern = chain[nextPos];
                switchPatternSilent(nextPattern);
                setChainPosition(nextPos);
                // Apply per-slot BPM/swing overrides when advancing the chain.
                const meta = chainMeta[nextPos];
                if (meta?.bpmOverride != null) {
                  Tone.getTransport().bpm.value = meta.bpmOverride;
                }
                if (meta?.swingOverride != null) {
                  Tone.getTransport().swing = meta.swingOverride;
                }
                if (meta?.bpmOverride == null || meta?.swingOverride == null) {
                  const globalState = useEngineStore.getState();
                  if (meta?.bpmOverride == null) {
                    Tone.getTransport().bpm.value = globalState.bpm;
                  }
                  if (meta?.swingOverride == null) {
                    Tone.getTransport().swing = globalState.swing;
                  }
                }
              }
              needsChainAdvance = false;
            }

            setCurrentStep(stepIndex);

            const currentState = useEngineStore.getState();
            const currentTracks = currentState.tracks;
            const hasSolo = currentTracks.some((t: Track) => t.solo);

            // Step duration in seconds; multiplied by per-track noteLength so
            // each track can be staccato or held independent of the grid.
            const stepDurationSeconds = getStepDurationSeconds(currentState.bpm, totalSteps);

            // ── Automation lanes ───────────────────────────────────────────
            // Interpolate each enabled lane to the current position and
            // schedule the value sample-accurately on the target AudioParam.
            const position = totalSteps > 0 ? stepIndex / totalSteps : 0;
            const automationLanes =
              currentState.patterns[currentState.currentPattern]?.automation ?? [];
            automationLanes.forEach((lane) => {
              if (!lane.enabled || lane.points.length === 0) return;
              const value = interpolateAutomation(lane.points, position);
              if (value === null) return;
              scheduleAutomationValue(
                lane.target,
                value,
                time,
                gainNodesRef.current,
                panNodesRef.current,
                fxChainsRef.current,
                masterChainRef.current,
              );
            });

            // ── Groove & humanization ──────────────────────────────────────
            // Pre-compute per-step velocity multiplier and timing nudge from
            // the active groove template and global humanize knobs. These are
            // applied to every track uniformly — per-track nudge then stacks
            // on top inside the track loop.
            let grooveVelocityMult = 1.0;
            let grooveTimingNudge = 0;
            const grooveId = currentState.activeGroove;
            if (grooveId) {
              const template = currentState.grooveTemplates.find((g) => g.id === grooveId);
              if (template) {
                if (template.accentPattern.length > 0) {
                  grooveVelocityMult = template.accentPattern[stepIndex % template.accentPattern.length];
                }
                if (template.velocityVariation > 0) {
                  grooveVelocityMult *=
                    1 + (Math.random() * 2 - 1) * template.velocityVariation * 0.5;
                }
                if (template.timingVariation > 0) {
                  grooveTimingNudge =
                    (Math.random() * 2 - 1) * template.timingVariation * stepDurationSeconds * 0.5;
                }
              }
            }
            // Global humanization knobs stack on top of groove template values.
            const velHuman = currentState.globalVelocityHumanize ?? 0;
            const timeHuman = currentState.globalTimingHumanize ?? 0;
            if (velHuman > 0) {
              grooveVelocityMult *= 1 + (Math.random() * 2 - 1) * velHuman * 0.25;
            }
            if (timeHuman > 0) {
              grooveTimingNudge +=
                (Math.random() * 2 - 1) * timeHuman * stepDurationSeconds * 0.25;
            }

            currentTracks.forEach((track: Track, trackIndex: number) => {
              // Per-track clip slot: when a track's slot differs from the
              // global current pattern, read step data from that pattern instead
              // of the live track arrays (which reflect currentPattern).
              const slotIdx = currentState.trackSlots?.[trackIndex] ?? currentState.currentPattern;
              const slotPattern = slotIdx !== currentState.currentPattern
                ? currentState.patterns[slotIdx]
                : null;

              const velocity = slotPattern
                ? (slotPattern.steps[trackIndex]?.[stepIndex] ?? 0)
                : track.steps[stepIndex];
              if (!velocity) return;
              const probability = slotPattern
                ? (slotPattern.probabilities[trackIndex]?.[stepIndex] ?? 1.0)
                : (track.probabilities?.[stepIndex] ?? 1.0);
              if (probability < 1.0 && Math.random() > probability) return;
              const audible = hasSolo
                ? track.solo && !track.muted
                : !track.muted;
              if (!audible) return;

              // Apply groove velocity multiplier (clamped so accented steps
              // never clip and quiet steps don't disappear entirely).
              const finalVelocity = Math.max(0.05, Math.min(1.0, velocity * grooveVelocityMult));

              const synth = synthsRef.current[trackIndex];
              const fx = fxChainsRef.current[trackIndex];
              if (synth) {
                const slotNotes = slotPattern?.notes[trackIndex];
                let noteOverride = (slotNotes ? slotNotes[stepIndex] : track.notes?.[stepIndex]) || undefined;
                const dur = stepDurationSeconds * (track.noteLength ?? 1.0);
                // Stack per-track micro-nudge with groove timing jitter.
                const rawNudge = slotPattern
                  ? (slotPattern.nudge[trackIndex]?.[stepIndex] ?? 0)
                  : (track.nudge?.[stepIndex] ?? 0);
                const nudgeOffset = rawNudge * stepDurationSeconds + grooveTimingNudge;
                
                // Sample pitch shift: tone.Player uses playbackRate, already
                // applied at load/hot-swap. For Sampler, transpose the triggered note.
                if (synth instanceof Tone.Sampler && track.samplePitchShift !== 0) {
                  const baseNote = noteOverride || track.sound.note;
                  try {
                    const baseMidi = Tone.Frequency(baseNote).toMidi();
                    noteOverride = Tone.Frequency(baseMidi + track.samplePitchShift, "midi").toNote();
                  } catch {
                    // invalid note string — leave as-is
                  }
                }

                // Per-step FX locks: apply merged overrides for this step,
                // then restore the track's baseline after the step duration.
                const stepLock = track.stepLocks?.[stepIndex];
                if (stepLock && fx) {
                  const triggerAt = time + nudgeOffset;
                  const restoreAt = triggerAt + dur;
                  // Apply locked values sample-accurately
                  if (stepLock.filterFreq !== undefined)
                    fx.filter.frequency.setValueAtTime(stepLock.filterFreq, triggerAt);
                  if (stepLock.filterQ !== undefined)
                    fx.filter.Q.setValueAtTime(stepLock.filterQ, triggerAt);
                  if (stepLock.driveAmount !== undefined)
                    fx.drive.wet.setValueAtTime(stepLock.driveOn ?? track.effects.driveOn ? stepLock.driveAmount : 0, triggerAt);
                  if (stepLock.delayWet !== undefined)
                    fx.delayGain.gain.setValueAtTime(stepLock.delayWet, triggerAt);
                  if (stepLock.reverbWet !== undefined)
                    fx.reverbGain.gain.setValueAtTime(stepLock.reverbWet, triggerAt);
                  if (stepLock.bitCrushWet !== undefined)
                    fx.bitCrusher.wet.setValueAtTime(stepLock.bitCrushWet, triggerAt);
                  // Restore to track baseline after step
                  const eff = track.effects;
                  fx.filter.frequency.setValueAtTime(eff.filterOn ? eff.filterFreq : 20000, restoreAt);
                  fx.filter.Q.setValueAtTime(eff.filterOn ? eff.filterQ : 1, restoreAt);
                  fx.drive.wet.setValueAtTime(eff.driveOn ? eff.driveAmount : 0, restoreAt);
                  fx.delayGain.gain.setValueAtTime(eff.delayOn ? eff.delayWet : 0, restoreAt);
                  fx.reverbGain.gain.setValueAtTime(eff.reverbOn ? eff.reverbWet : 0, restoreAt);
                  fx.bitCrusher.wet.setValueAtTime(eff.bitCrushOn ? eff.bitCrushWet : 0, restoreAt);
                }

                // Polyphonic chord support: if noteOverride contains commas, trigger each note
                if (noteOverride && noteOverride.includes(",")) {
                  const notes = noteOverride.split(",").filter((n) => n.trim());
                  notes.forEach((n) => {
                    triggerSynth(synth, track.sound, time + nudgeOffset, finalVelocity, dur, n.trim());
                  });
                } else {
                  triggerSynth(synth, track.sound, time + nudgeOffset, finalVelocity, dur, noteOverride);
                }
              }

              const triggerTime = time + ((track.nudge?.[stepIndex] ?? 0) * stepDurationSeconds) + grooveTimingNudge;
              currentTracks.forEach((target: Track, targetIdx: number) => {
                if (!target.effects.sidechainOn) return;
                if (target.effects.sidechainSource !== trackIndex) return;
                const dg = duckGainsRef.current[targetIdx];
                if (!dg) return;
                const depth = Math.max(0, Math.min(1, target.effects.sidechainDepth));
                const release = Math.max(0.01, target.effects.sidechainRelease);
                dg.gain.cancelScheduledValues(triggerTime);
                dg.gain.setValueAtTime(1 - depth, triggerTime);
                dg.gain.linearRampToValueAtTime(1, triggerTime + release);
              });
            });

            // Mark for chain advance at the end of the pattern
            if (
              currentState.songMode &&
              currentState.chain.length > 0 &&
              stepIndex === totalSteps - 1
            ) {
              needsChainAdvance = true;
            }
          },
          stepIndices,
          getStepSubdivision(totalSteps)
        );

        sequenceRef.current.start(0);
        transport.start();
      } else if (playbackState === "paused") {
        transport.pause();
      } else {
        transport.stop();
        needsChainAdvance = false;
        useEngineStore.getState().setChainPosition(0);
        if (sequenceRef.current) {
          sequenceRef.current.stop();
          sequenceRef.current.dispose();
          sequenceRef.current = null;
        }
      }
    });
    return unsub;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      sequenceRef.current?.dispose();
      synthsRef.current.forEach((s) => s.dispose());
      gainNodesRef.current.forEach((g) => g.dispose());
      duckGainsRef.current.forEach((g) => g.dispose());
      panNodesRef.current.forEach((p) => p.dispose());
      panLfosRef.current.forEach((l) => {
        if (l.state === "started") l.stop();
        l.dispose();
      });
      modLfosRef.current.forEach((m) => {
        if (m.lfo.state === "started") m.lfo.stop();
        m.lfo.dispose();
      });
      trackMetersRef.current.forEach((m) => m.dispose());
      masterMeterRef.current?.dispose();
      masterFFTRef.current?.dispose();
      masterWaveformRef.current?.dispose();
      fxChainsRef.current.forEach((fx) => {
        fx.bitCrusher.dispose();
        fx.chorus.dispose();
        fx.drive.dispose();
        fx.filter.dispose();
        fx.delay.dispose();
        fx.reverb.dispose();
        fx.delayGain.dispose();
        fx.reverbGain.dispose();
        fx.dryGain.dispose();
      });
      if (masterChainRef.current) {
        masterChainRef.current.gain.dispose();
        masterChainRef.current.tape.dispose();
        masterChainRef.current.widener.dispose();
        masterChainRef.current.eq.dispose();
        masterChainRef.current.compressor.dispose();
        masterChainRef.current.limiter.dispose();
      }
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    };
  }, []);

  const getTrackMeter = useCallback((index: number): number => {
    const meter = trackMetersRef.current[index];
    if (!meter) return -Infinity;
    const val = meter.getValue();
    return typeof val === "number" ? val : val[0];
  }, []);

  const getMasterMeter = useCallback((): number => {
    const meter = masterMeterRef.current;
    if (!meter) return -Infinity;
    const val = meter.getValue();
    return typeof val === "number" ? val : val[0];
  }, []);

  const getMasterSpectrum = useCallback((): Float32Array | null => {
    return masterFFTRef.current?.getValue() ?? null;
  }, []);

  const getMasterWaveform = useCallback((): Float32Array | null => {
    return masterWaveformRef.current?.getValue() ?? null;
  }, []);

  // Approximate integrated loudness (LUFS-S) from the smoothed RMS meter.
  // -1.5 dB offset is a rough K-weighting approximation. Good enough for
  // Mix Doctor and LoudnessChip targets (±2 dB tolerance).
  const loudnessRef = useRef(-Infinity);
  const getMasterLoudness = useCallback((): number => {
    const db = (() => {
      const meter = masterMeterRef.current;
      if (!meter) return -Infinity;
      const val = meter.getValue();
      return typeof val === "number" ? val : val[0];
    })();
    if (!Number.isFinite(db)) return -Infinity;
    const prev = loudnessRef.current;
    const alpha = db > prev ? 0.35 : 0.07;
    const next = !Number.isFinite(prev) ? db : prev + alpha * (db - prev);
    loudnessRef.current = next;
    return next - 1.5;
  }, []);

  // True peak: max abs sample over the latest waveform buffer.
  const getMasterTruePeak = useCallback((): number => {
    const wave = masterWaveformRef.current?.getValue();
    if (!wave) return -Infinity;
    let max = 0;
    for (let i = 0; i < wave.length; i++) {
      const v = Math.abs(wave[i]);
      if (v > max) max = v;
    }
    return max > 0 ? 20 * Math.log10(max) : -Infinity;
  }, []);

  // Live trigger — used by performance keys (Q-I) to play any track on demand,
  // independent of the step sequencer. Honors the track's noteLength and
  // fires sidechain envelopes the same way the sequence does, so manual
  // kicks pump bass even outside the running pattern.
  const triggerTrack = useCallback((index: number, velocity = 1.0) => {
    if (!initializedRef.current) return;
    const state = useEngineStore.getState();
    const track = state.tracks[index];
    if (!track) return;
    const synth = synthsRef.current[index];
    if (!synth) return;

    const stepDur = (60 / state.bpm) * (4 / state.totalSteps);
    const dur = stepDur * (track.noteLength ?? 1.0);
    const now = Tone.now();
    triggerSynth(synth, track.sound, now, velocity, dur);

    state.tracks.forEach((target, targetIdx) => {
      if (!target.effects.sidechainOn) return;
      if (target.effects.sidechainSource !== index) return;
      const dg = duckGainsRef.current[targetIdx];
      if (!dg) return;
      const depth = Math.max(0, Math.min(1, target.effects.sidechainDepth));
      const release = Math.max(0.01, target.effects.sidechainRelease);
      dg.gain.cancelScheduledValues(now);
      dg.gain.setValueAtTime(1 - depth, now);
      dg.gain.linearRampToValueAtTime(1, now + release);
    });

    // Visual flash on the channel strip — listeners attach in Mixer.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("sts-track-trigger", { detail: { index } }),
      );
    }
  }, []);

  // Allow other parts of the app (Sound Designer preview, Co-Producer) to
  // request a one-shot trigger without prop-drilling triggerTrack.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPlay = (e: Event) => {
      const ev = e as CustomEvent<{ index: number; velocity?: number }>;
      if (typeof ev.detail?.index === "number") {
        triggerTrack(ev.detail.index, ev.detail.velocity ?? 1.0);
      }
    };
    window.addEventListener("sts-track-play", onPlay);
    return () => window.removeEventListener("sts-track-play", onPlay);
  }, [triggerTrack]);

  return {
    initAudio,
    getTrackMeter,
    getMasterMeter,
    getMasterSpectrum,
    getMasterWaveform,
    getMasterLoudness,
    getMasterTruePeak,
    triggerTrack,
  };
}
