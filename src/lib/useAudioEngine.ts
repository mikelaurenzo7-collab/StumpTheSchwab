"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { useEngineStore, type Track, type TrackEffects, type MasterBus, type ModLfoTarget } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";
import { getStepDurationSeconds, getStepSubdivision } from "@/lib/stepTiming";

export type SynthNode =
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.NoiseSynth
  | Tone.Synth
  | Tone.AMSynth
  | Tone.FMSynth
  | Tone.Sampler
  | Tone.UserMedia;

interface TrackFXChain {
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
  // Signal: synth → drive → filter → (dry / delay / reverb sends) → destination
  // Drive shapes harmonics BEFORE the filter so the filter can tame any harshness.
  const drive = new Tone.Distortion({ distortion: 0, wet: 1 });
  const filter = new Tone.Filter({ frequency: 20000, type: "lowpass", Q: 1 });
  drive.connect(filter);

  const delay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.3, wet: 1 });
  const delayGain = new Tone.Gain(0);
  const dryGain = new Tone.Gain(1);

  const reverb = new Tone.Reverb({ decay: 1.5, wet: 1 });
  const reverbGain = new Tone.Gain(0);

  filter.connect(dryGain);
  filter.connect(delay);
  filter.connect(reverb);

  delay.connect(delayGain);
  reverb.connect(reverbGain);

  dryGain.connect(destination as unknown as Tone.ToneAudioNode);
  delayGain.connect(destination as unknown as Tone.ToneAudioNode);
  reverbGain.connect(destination as unknown as Tone.ToneAudioNode);

  return { drive, filter, delay, reverb, delayGain, reverbGain, dryGain };
}

function applyTrackFX(fx: TrackFXChain, effects: TrackEffects) {
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

function createMasterChain(): MasterChain {
  const master = useEngineStore.getState().master;
  const limiter = new Tone.Limiter(master.limiterThreshold).toDestination();
  const compressor = new Tone.Compressor({
    threshold: master.compressorThreshold,
    ratio: master.compressorRatio,
    attack: master.compressorAttack,
    release: master.compressorRelease,
  }).connect(limiter);
  // Tone.EQ3 is a 3-band shelf+peak. It's the standard "master tone" tool;
  // bypass = all bands at 0 dB.
  const eq = new Tone.EQ3({
    low: master.eqOn ? master.eqLow : 0,
    mid: master.eqOn ? master.eqMid : 0,
    high: master.eqOn ? master.eqHigh : 0,
  }).connect(compressor);
  const gain = new Tone.Gain(master.volume).connect(eq);
  return { gain, eq, compressor, limiter };
}

function applyMasterSettings(chain: MasterChain, master: MasterBus) {
  chain.gain.gain.value = master.volume;

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
        synth = new Tone.Sampler({ urls: { [track.sound.note]: track.customSampleUrl } });
      } else {
        synth = createSynth(track.sound);
      }
      synth.connect(fx.drive);

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

  // Hot-swap synths when a custom sample is loaded or cleared
  useEffect(() => {
    const prevUrls: (string | null)[] = useEngineStore
      .getState()
      .tracks.map((t) => t.customSampleUrl);

    const unsub = useEngineStore.subscribe((state) => {
      state.tracks.forEach((track, i) => {
        const prev = prevUrls[i] ?? null;
        const curr = track.customSampleUrl;
        if (curr === prev) return;
        prevUrls[i] = curr;

        const fx = fxChainsRef.current[i];
        if (!fx) return;

        const oldSynth = synthsRef.current[i];
        if (curr) {
          const sampler = new Tone.Sampler({
            urls: { [track.sound.note]: curr },
            onload: () => {
              sampler.connect(fx.drive);
              synthsRef.current[i] = sampler;
              oldSynth?.dispose();
            },
          });
        } else {
          const synth = createSynth(track.sound);
          synth.connect(fx.drive);
          synthsRef.current[i] = synth;
          oldSynth?.dispose();
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
        }
        needsChainAdvance = false;

        sequenceRef.current = new Tone.Sequence(
          (time, stepIndex) => {
            // Advance chain at the start of a new loop iteration
            if (needsChainAdvance && stepIndex === 0) {
              const { songMode, chain, chainPosition, switchPatternSilent, setChainPosition } =
                useEngineStore.getState();
              if (songMode && chain.length > 0) {
                const nextPos = (chainPosition + 1) % chain.length;
                const nextPattern = chain[nextPos];
                switchPatternSilent(nextPattern);
                setChainPosition(nextPos);
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

            currentTracks.forEach((track: Track, trackIndex: number) => {
              const velocity = track.steps[stepIndex];
              if (!velocity) return;
              const probability = track.probabilities?.[stepIndex] ?? 1.0;
              if (probability < 1.0 && Math.random() > probability) return;
              const audible = hasSolo
                ? track.solo && !track.muted
                : !track.muted;
              if (!audible) return;

              const synth = synthsRef.current[trackIndex];
              if (synth) {
                const noteOverride = track.notes?.[stepIndex] || undefined;
                const dur = stepDurationSeconds * (track.noteLength ?? 1.0);
                const nudgeOffset = (track.nudge?.[stepIndex] ?? 0) * stepDurationSeconds;
                triggerSynth(synth, track.sound, time + nudgeOffset, velocity, dur, noteOverride);
              }

              const triggerTime = time + ((track.nudge?.[stepIndex] ?? 0) * stepDurationSeconds);
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

  return {
    initAudio,
    getTrackMeter,
    getMasterMeter,
    getMasterSpectrum,
    getMasterWaveform,
    triggerTrack,
  };
}
