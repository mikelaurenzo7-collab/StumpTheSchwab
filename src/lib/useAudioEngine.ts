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

  const initAudio = useCallback(async () => {
    if (initializedRef.current) return;
    await Tone.start();
    initializedRef.current = true;

    const tracks = useEngineStore.getState().tracks;

    // Create synths + gain nodes for each track
    synthsRef.current = [];
    gainNodesRef.current = [];
    tracks.forEach((track) => {
      const gain = new Tone.Gain(track.volume).toDestination();
      const synth = createSynth(track.sound);
      synth.connect(gain);
      synthsRef.current.push(synth);
      gainNodesRef.current.push(gain);
    });
  }, []);

  // Sync BPM
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

        const { tracks, totalSteps, setCurrentStep } = useEngineStore.getState();
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
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    };
  }, []);

  return { initAudio };
}
