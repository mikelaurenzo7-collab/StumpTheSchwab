"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { useEngineStore, type Track, type TrackEffects, type MasterBus } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";

type SynthNode =
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
  delayGain: Tone.Gain; // wet/dry for delay
  reverbGain: Tone.Gain; // wet/dry for reverb
  dryGain: Tone.Gain; // dry path past delay
  dryGainReverb: Tone.Gain; // dry path past reverb
}

interface MasterChain {
  gain: Tone.Gain;
  compressor: Tone.Compressor;
  limiter: Tone.Limiter;
}

function createSynth(sound: TrackSound): SynthNode {
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

function triggerSynth(synth: SynthNode, sound: TrackSound, time: number) {
  if (synth instanceof Tone.NoiseSynth) {
    synth.triggerAttackRelease(sound.note, time);
  } else {
    (synth as Tone.Synth).triggerAttackRelease(sound.note, "16n", time);
  }
}

function createTrackFX(destination: Tone.InputNode): TrackFXChain {
  // Filter → split into dry/wet delay → split into dry/wet reverb → destination
  const filter = new Tone.Filter({ frequency: 20000, type: "lowpass", Q: 1 });

  // Delay wet/dry
  const delay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.3, wet: 1 });
  const delayGain = new Tone.Gain(0); // wet level (off by default)
  const dryGain = new Tone.Gain(1);

  // Reverb wet/dry
  const reverb = new Tone.Reverb({ decay: 1.5, wet: 1 });
  const reverbGain = new Tone.Gain(0); // wet level (off by default)
  const dryGainReverb = new Tone.Gain(1);

  // Signal chain:
  // filter → dryGain → dryGainReverb → destination
  // filter → delay → delayGain → dryGainReverb → destination
  // filter → dryGain → reverb → reverbGain → destination
  // (simplified: parallel wet/dry at each stage)

  // Post-filter splits to dry and delay
  filter.connect(dryGain);
  filter.connect(delay);
  delay.connect(delayGain);

  // Dry + delay-wet merge, then split to dry-reverb and reverb
  dryGain.connect(dryGainReverb);
  delayGain.connect(dryGainReverb);

  dryGain.connect(reverb);
  delayGain.connect(reverb);
  reverb.connect(reverbGain);

  // Final merge to destination
  dryGainReverb.connect(destination as unknown as Tone.ToneAudioNode);
  reverbGain.connect(destination as unknown as Tone.ToneAudioNode);

  return { filter, delay, reverb, delayGain, reverbGain, dryGain, dryGainReverb };
}

function applyTrackFX(fx: TrackFXChain, effects: TrackEffects) {
  // Filter
  if (effects.filterOn) {
    fx.filter.frequency.value = effects.filterFreq;
    fx.filter.type = effects.filterType;
    fx.filter.Q.value = effects.filterQ;
  } else {
    fx.filter.frequency.value = 20000;
    fx.filter.type = "lowpass";
    fx.filter.Q.value = 1;
  }

  // Delay wet/dry
  if (effects.delayOn) {
    fx.delay.delayTime.value = effects.delayTime;
    fx.delay.feedback.value = effects.delayFeedback;
    fx.delayGain.gain.value = effects.delayWet;
  } else {
    fx.delayGain.gain.value = 0;
  }

  // Reverb wet/dry
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
    // Bypass: ratio 1 = no compression
    chain.compressor.threshold.value = 0;
    chain.compressor.ratio.value = 1;
  }

  if (master.limiterOn) {
    chain.limiter.threshold.value = master.limiterThreshold;
  } else {
    chain.limiter.threshold.value = 0;
  }
}

export function useAudioEngine() {
  const synthsRef = useRef<SynthNode[]>([]);
  const gainNodesRef = useRef<Tone.Gain[]>([]);
  const fxChainsRef = useRef<TrackFXChain[]>([]);
  const masterChainRef = useRef<MasterChain | null>(null);
  const sequenceRef = useRef<Tone.Sequence | null>(null);
  const initializedRef = useRef(false);

  const initAudio = useCallback(async () => {
    if (initializedRef.current) return;
    await Tone.start();
    initializedRef.current = true;

    const tracks = useEngineStore.getState().tracks;

    // Create master bus chain
    const masterChain = createMasterChain();
    masterChainRef.current = masterChain;

    // Create synths + per-track FX chains + gain nodes
    synthsRef.current = [];
    gainNodesRef.current = [];
    fxChainsRef.current = [];

    tracks.forEach((track) => {
      // Per-track gain → master gain
      const gain = new Tone.Gain(track.volume).connect(masterChain.gain);

      // Per-track FX chain → per-track gain
      const fx = createTrackFX(gain);
      applyTrackFX(fx, track.effects);

      // Synth → filter (first node of FX chain)
      const synth = createSynth(track.sound);
      synth.connect(fx.filter);

      synthsRef.current.push(synth);
      gainNodesRef.current.push(gain);
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

  // Sync mixer (volume, mute, solo)
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      const hasSolo = state.tracks.some((t) => t.solo);
      state.tracks.forEach((track, i) => {
        const gain = gainNodesRef.current[i];
        if (!gain) return;
        const audible = hasSolo ? track.solo && !track.muted : !track.muted;
        gain.gain.value = audible ? track.volume : 0;
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

        transport.bpm.value = useEngineStore.getState().bpm;
        transport.swing = useEngineStore.getState().swing;

        sequenceRef.current = new Tone.Sequence(
          (time, stepIndex) => {
            setCurrentStep(stepIndex);

            const currentTracks = useEngineStore.getState().tracks;
            const hasSolo = currentTracks.some((t: Track) => t.solo);

            currentTracks.forEach((track: Track, trackIndex: number) => {
              if (!track.steps[stepIndex]) return;
              const audible = hasSolo
                ? track.solo && !track.muted
                : !track.muted;
              if (!audible) return;

              const synth = synthsRef.current[trackIndex];
              if (synth) {
                triggerSynth(synth, track.sound, time);
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
      fxChainsRef.current.forEach((fx) => {
        fx.filter.dispose();
        fx.delay.dispose();
        fx.reverb.dispose();
        fx.delayGain.dispose();
        fx.reverbGain.dispose();
        fx.dryGain.dispose();
        fx.dryGainReverb.dispose();
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

  return { initAudio };
}
