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
  const sequenceRef = useRef<Tone.Sequence | null>(null);
  const initializedRef = useRef(false);

  // Effects refs
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const delayRef = useRef<Tone.FeedbackDelay | null>(null);
  const reverbSendRef = useRef<Tone.Gain | null>(null);
  const delaySendRef = useRef<Tone.Gain | null>(null);
  const masterGainRef = useRef<Tone.Gain | null>(null);

  const initAudio = useCallback(async () => {
    if (initializedRef.current) return;
    await Tone.start();
    initializedRef.current = true;

    const state = useEngineStore.getState();
    const tracks = state.tracks;

    // Create master bus
    const masterGain = new Tone.Gain(1).toDestination();
    masterGainRef.current = masterGain;

    // Create reverb send chain: sendGain → reverb → destination
    const reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01 });
    await reverb.generate();
    reverb.wet.value = 1; // Fully wet — send gain controls amount
    reverb.toDestination();
    const reverbSend = new Tone.Gain(state.reverbWet);
    reverbSend.connect(reverb);
    reverbRef.current = reverb;
    reverbSendRef.current = reverbSend;

    // Create delay send chain: sendGain → delay → destination
    const delay = new Tone.FeedbackDelay({
      delayTime: state.delayTime,
      feedback: state.delayFeedback,
      maxDelay: 2,
    });
    delay.wet.value = 1; // Fully wet — send gain controls amount
    delay.toDestination();
    const delaySend = new Tone.Gain(state.delayWet);
    delaySend.connect(delay);
    delayRef.current = delay;
    delaySendRef.current = delaySend;

    // Create synths + gain nodes for each track
    synthsRef.current = [];
    gainNodesRef.current = [];
    tracks.forEach((track) => {
      const gain = new Tone.Gain(track.volume);
      // Dry path → master → destination
      gain.connect(masterGain);
      // Send paths → effects
      gain.connect(reverbSend);
      gain.connect(delaySend);

      const synth = createSynth(track.sound);
      synth.connect(gain);
      synthsRef.current.push(synth);
      gainNodesRef.current.push(gain);
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

  // Sync effects parameters
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      if (reverbSendRef.current) {
        reverbSendRef.current.gain.value = state.reverbWet;
      }
      if (delaySendRef.current) {
        delaySendRef.current.gain.value = state.delayWet;
      }
      if (delayRef.current) {
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
        // Build or rebuild sequence
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

            // Read latest track state each tick
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
      reverbRef.current?.dispose();
      delayRef.current?.dispose();
      reverbSendRef.current?.dispose();
      delaySendRef.current?.dispose();
      masterGainRef.current?.dispose();
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    };
  }, []);

  return { initAudio };
}
