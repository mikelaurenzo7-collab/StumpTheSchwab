"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { useEngineStore, type Track } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";

type SynthNode =
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.NoiseSynth
  | Tone.Synth
  | Tone.AMSynth
  | Tone.FMSynth;

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

export function useAudioEngine() {
  const synthsRef = useRef<SynthNode[]>([]);
  const gainNodesRef = useRef<Tone.Gain[]>([]);
  const filterNodesRef = useRef<Tone.Filter[]>([]);
  const reverbSendGainsRef = useRef<Tone.Gain[]>([]);
  const delaySendGainsRef = useRef<Tone.Gain[]>([]);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const delayRef = useRef<Tone.FeedbackDelay | null>(null);
  const limiterRef = useRef<Tone.Limiter | null>(null);
  const sequenceRef = useRef<Tone.Sequence | null>(null);
  const initializedRef = useRef(false);

  const initAudio = useCallback(async () => {
    if (initializedRef.current) return;
    await Tone.start();
    initializedRef.current = true;

    const state = useEngineStore.getState();
    const tracks = state.tracks;

    // Master limiter — prevents clipping on output
    const limiter = new Tone.Limiter(-1).toDestination();
    limiterRef.current = limiter;

    // Shared send effects (wet: 1 because dry signal goes direct)
    const reverb = new Tone.Reverb({ decay: state.reverbDecay, wet: 1 }).connect(limiter);
    reverbRef.current = reverb;

    const delay = new Tone.FeedbackDelay({
      delayTime: state.delayTime as Tone.Unit.Time,
      feedback: state.delayFeedback,
      wet: 1,
    }).connect(limiter);
    delayRef.current = delay;

    // Per-track signal chain:
    // Synth → Filter → Gain → Limiter (direct)
    //                   Gain → ReverbSendGain → Reverb
    //                   Gain → DelaySendGain → Delay
    synthsRef.current = [];
    gainNodesRef.current = [];
    filterNodesRef.current = [];
    reverbSendGainsRef.current = [];
    delaySendGainsRef.current = [];

    tracks.forEach((track) => {
      const filter = new Tone.Filter({
        frequency: track.filterFreq,
        type: track.filterType,
        Q: track.filterQ,
      });
      const gain = new Tone.Gain(track.volume);
      const reverbSendGain = new Tone.Gain(track.reverbSend);
      const delaySendGain = new Tone.Gain(track.delaySend);

      const synth = createSynth(track.sound);

      // Wire: synth → filter → gain → limiter (direct out)
      synth.connect(filter);
      filter.connect(gain);
      gain.connect(limiter);

      // Wire sends: gain → sendGain → shared effect
      gain.connect(reverbSendGain);
      gain.connect(delaySendGain);
      reverbSendGain.connect(reverb);
      delaySendGain.connect(delay);

      synthsRef.current.push(synth);
      filterNodesRef.current.push(filter);
      gainNodesRef.current.push(gain);
      reverbSendGainsRef.current.push(reverbSendGain);
      delaySendGainsRef.current.push(delaySendGain);
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

  // Sync mixer (volume, mute, solo) + per-track effects
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      const hasSolo = state.tracks.some((t) => t.solo);
      state.tracks.forEach((track, i) => {
        const gain = gainNodesRef.current[i];
        const filter = filterNodesRef.current[i];
        const reverbSendGain = reverbSendGainsRef.current[i];
        const delaySendGain = delaySendGainsRef.current[i];
        if (!gain) return;

        // Volume + mute/solo
        const audible = hasSolo ? track.solo && !track.muted : !track.muted;
        gain.gain.value = audible ? track.volume : 0;

        // Filter
        if (filter) {
          filter.frequency.value = track.filterFreq;
          filter.type = track.filterType;
          filter.Q.value = track.filterQ;
        }

        // Send levels
        if (reverbSendGain) reverbSendGain.gain.value = track.reverbSend;
        if (delaySendGain) delaySendGain.gain.value = track.delaySend;
      });
    });
    return unsub;
  }, []);

  // Sync master effect params
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      if (reverbRef.current) {
        reverbRef.current.decay = state.reverbDecay;
      }
      if (delayRef.current) {
        delayRef.current.delayTime.value = state.delayTime as Tone.Unit.Time;
        delayRef.current.feedback.value = state.delayFeedback;
      }
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
      filterNodesRef.current.forEach((f) => f.dispose());
      reverbSendGainsRef.current.forEach((g) => g.dispose());
      delaySendGainsRef.current.forEach((g) => g.dispose());
      reverbRef.current?.dispose();
      delayRef.current?.dispose();
      limiterRef.current?.dispose();
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    };
  }, []);

  return { initAudio };
}
