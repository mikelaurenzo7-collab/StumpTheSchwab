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
  | Tone.FMSynth;

interface TrackFXChain {
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

export function triggerSynth(synth: SynthNode, sound: TrackSound, time: number, velocity: number, duration: string, noteOverride?: string) {
  if (synth instanceof Tone.NoiseSynth) {
    synth.triggerAttackRelease(duration, time, velocity);
  } else {
    const note = noteOverride || sound.note;
    (synth as Tone.Synth).triggerAttackRelease(note, duration, time, velocity);
  }
}

function createTrackFX(destination: Tone.InputNode): TrackFXChain {
  const filter = new Tone.Filter({ frequency: 20000, type: "lowpass", Q: 1 });

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

  return { filter, delay, reverb, delayGain, reverbGain, dryGain };
}

function applyTrackFX(fx: TrackFXChain, effects: TrackEffects) {
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
    panNodesRef.current = [];
    fxChainsRef.current = [];
    trackMetersRef.current = [];

    // Master meter
    const masterMeter = new Tone.Meter({ smoothing: 0.8 });
    masterChain.gain.connect(masterMeter);
    masterMeterRef.current = masterMeter;

    tracks.forEach((track) => {
      // Signal chain: Synth → FX → Gain → Meter → Panner → Master
      const panner = new Tone.Panner(track.pan).connect(masterChain.gain);
      const gain = new Tone.Gain(track.volume).connect(panner);

      const meter = new Tone.Meter({ smoothing: 0.8 });
      gain.connect(meter);
      trackMetersRef.current.push(meter);

      const fx = createTrackFX(gain);
      applyTrackFX(fx, track.effects);

      const synth = createSynth(track.sound);
      synth.connect(fx.filter);

      synthsRef.current.push(synth);
      gainNodesRef.current.push(gain);
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
    const unsub = useEngineStore.subscribe((state) => {
      const playbackState = state.playbackState;
      if (playbackState === prevPlaybackState) return;
      prevPlaybackState = playbackState;

      const transport = Tone.getTransport();
      if (playbackState === "playing") {
        if (sequenceRef.current) {
          sequenceRef.current.dispose();
        }

        const { totalSteps, setCurrentStep } = useEngineStore.getState();
        const stepIndices = Array.from({ length: totalSteps }, (_, i) => i);

        const noteDuration = `${totalSteps}n` as Tone.Unit.Time;

        transport.bpm.value = useEngineStore.getState().bpm;
        transport.swing = useEngineStore.getState().swing;

        sequenceRef.current = new Tone.Sequence(
          (time, stepIndex) => {
            setCurrentStep(stepIndex);

            const currentTracks = useEngineStore.getState().tracks;
            const hasSolo = currentTracks.some((t: Track) => t.solo);

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
                triggerSynth(synth, track.sound, time, velocity, noteDuration as string, noteOverride);
              }
            });
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
      panNodesRef.current.forEach((p) => p.dispose());
      trackMetersRef.current.forEach((m) => m.dispose());
      masterMeterRef.current?.dispose();
      fxChainsRef.current.forEach((fx) => {
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
