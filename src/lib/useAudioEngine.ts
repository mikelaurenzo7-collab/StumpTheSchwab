"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { useEngineStore, type Track, type TrackEffects, type MasterBus } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";

export type SynthNode =
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.NoiseSynth
  | Tone.Synth
  | Tone.AMSynth
  | Tone.FMSynth
  | Tone.Sampler;

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
  compressor: Tone.Compressor;
  limiter: Tone.Limiter;
}

export function createSynth(sound: TrackSound): SynthNode {
  const opts = (sound.options ?? {}) as Record<string, unknown>;
  switch (sound.synth) {
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
  if (synth instanceof Tone.NoiseSynth) {
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

function createMasterChain(): MasterChain {
  const master = useEngineStore.getState().master;
  const limiter = new Tone.Limiter(master.limiterThreshold).toDestination();
  const compressor = new Tone.Compressor({
    threshold: master.compressorThreshold,
    ratio: master.compressorRatio,
    attack: master.compressorAttack,
    release: master.compressorRelease,
  }).connect(limiter);
  const gain = new Tone.Gain(master.volume).connect(compressor);
  return { gain, compressor, limiter };
}

function applyMasterSettings(chain: MasterChain, master: MasterBus) {
  chain.gain.gain.value = master.volume;

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
  const masterMeterRef = useRef<Tone.Meter | null>(null);

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

    // Master meter
    const masterMeter = new Tone.Meter({ smoothing: 0.8 });
    masterChain.gain.connect(masterMeter);
    masterMeterRef.current = masterMeter;

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

      synthsRef.current.push(synth);
      gainNodesRef.current.push(gain);
      duckGainsRef.current.push(duckGain);
      panNodesRef.current.push(panner);
      fxChainsRef.current.push(fx);
    });
  }, []);

  // Sync BPM + swing
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      Tone.getTransport().bpm.value = state.bpm;
      Tone.getTransport().swing = state.swing;
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

  // Sync per-track effects
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      state.tracks.forEach((track, i) => {
        const fx = fxChainsRef.current[i];
        if (!fx) return;
        applyTrackFX(fx, track.effects);
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
            const stepDurationSeconds = (60 / currentState.bpm) * (4 / totalSteps);

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
                triggerSynth(synth, track.sound, time, velocity, dur, noteOverride);
              }

              // Sidechain ducking — any track listening to this one as its
              // source dips its duck gain to (1 - depth) and ramps back over
              // `release` seconds. cancelScheduledValues keeps repeated kicks
              // from fighting their own previous envelopes.
              currentTracks.forEach((target: Track, targetIdx: number) => {
                if (!target.effects.sidechainOn) return;
                if (target.effects.sidechainSource !== trackIndex) return;
                const dg = duckGainsRef.current[targetIdx];
                if (!dg) return;
                const depth = Math.max(0, Math.min(1, target.effects.sidechainDepth));
                const release = Math.max(0.01, target.effects.sidechainRelease);
                dg.gain.cancelScheduledValues(time);
                dg.gain.setValueAtTime(1 - depth, time);
                dg.gain.linearRampToValueAtTime(1, time + release);
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
          "16n"
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
      trackMetersRef.current.forEach((m) => m.dispose());
      masterMeterRef.current?.dispose();
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

  return { initAudio, getTrackMeter, getMasterMeter };
}
