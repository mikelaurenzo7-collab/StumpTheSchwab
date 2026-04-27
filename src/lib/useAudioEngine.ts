"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { useEngine, type TrackState, type Macro } from "@/store/engine";
import { STEPS, type VoiceId } from "@/lib/sounds";

type SynthBank = Record<string, Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth | Tone.MonoSynth | Tone.PluckSynth | Tone.FMSynth | Tone.Synth>;

const SCALE = [0, 2, 3, 5, 7, 10, 12, 14];

function createSynth(voice: VoiceId, channel: Tone.Channel): SynthBank[string] {
  switch (voice) {
    case "kick": {
      const s = new Tone.MembraneSynth({
        pitchDecay: 0.06,
        octaves: 6,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.1 },
      });
      s.connect(channel);
      return s;
    }
    case "snare": {
      const s = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
      });
      s.connect(channel);
      return s;
    }
    case "hat": {
      const s = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      });
      s.frequency.value = 200;
      s.connect(channel);
      return s;
    }
    case "clap": {
      const s = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.002, decay: 0.14, sustain: 0, release: 0.08 },
      });
      s.connect(channel);
      return s;
    }
    case "bass": {
      const s = new Tone.MonoSynth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.1 },
        filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.1, baseFrequency: 80, octaves: 2.5 },
      });
      s.connect(channel);
      return s;
    }
    case "pluck": {
      const s = new Tone.PluckSynth({ attackNoise: 1.2, dampening: 4000, resonance: 0.95 });
      s.connect(channel);
      return s;
    }
    case "pad": {
      const s = new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 10,
        oscillator: { type: "sine" },
        envelope: { attack: 0.08, decay: 0.4, sustain: 0.6, release: 0.5 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.3 },
      });
      s.connect(channel);
      return s;
    }
    case "perc": {
      const s = new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 4,
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.04 },
      });
      s.connect(channel);
      return s;
    }
  }
}

function getNoteForTrack(track: TrackState, stepIndex: number, macro: Macro): string {
  const degree = SCALE[(stepIndex + Math.round(macro.gravity / 14)) % SCALE.length];
  const freq = track.pitch * Math.pow(2, degree / 12);
  return Tone.Frequency(freq, "hz").toNote();
}

export function useAudioEngine() {
  const synthsRef = useRef<SynthBank>({});
  const channelsRef = useRef<Record<string, Tone.Channel>>({});
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const delayRef = useRef<Tone.FeedbackDelay | null>(null);
  const masterRef = useRef<Tone.Channel | null>(null);
  const scheduleIdRef = useRef<number | null>(null);
  const initedRef = useRef(false);

  const init = useCallback(async () => {
    if (initedRef.current) return;
    initedRef.current = true;

    await Tone.start();

    const master = new Tone.Channel({ volume: -3 }).toDestination();
    const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.18 });
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.22, wet: 0.14 });

    reverb.connect(master);
    delay.connect(master);
    masterRef.current = master;
    reverbRef.current = reverb;
    delayRef.current = delay;

    const tracks = useEngine.getState().tracks();
    for (const track of tracks) {
      const ch = new Tone.Channel({ volume: Tone.gainToDb(track.level) });
      ch.connect(master);
      ch.send("reverb", -12);
      channelsRef.current[track.id] = ch;
      synthsRef.current[track.id] = createSynth(track.voice, ch);
    }

    const transport = Tone.getTransport();
    transport.bpm.value = useEngine.getState().bpm;
    transport.swing = useEngine.getState().swing / 200;

    scheduleIdRef.current = transport.scheduleRepeat((time) => {
      const state = useEngine.getState();
      const tracks = state.patterns[state.currentPattern]?.tracks ?? [];
      const step = (state.currentStep + 1) % STEPS;

      useEngine.getState().setCurrentStep(step);

      const anySoloed = tracks.some((t) => t.soloed);

      for (const track of tracks) {
        const ch = channelsRef.current[track.id];
        if (ch) {
          ch.volume.value = Tone.gainToDb(Math.max(track.level, 0.001));
          ch.mute = track.muted || (anySoloed && !track.soloed);
        }

        if (!track.pattern[step]) continue;
        if (track.muted || (anySoloed && !track.soloed)) continue;

        const prob = track.probability[step] ?? 100;
        if (prob < 100 && Math.random() * 100 >= prob) continue;

        const synth = synthsRef.current[track.id];
        if (!synth) continue;

        try {
          if (synth instanceof Tone.NoiseSynth) {
            synth.triggerAttackRelease(track.voice === "clap" ? "16n" : "32n", time);
          } else if (synth instanceof Tone.MetalSynth) {
            synth.triggerAttackRelease("32n", time, track.level * 0.3);
          } else if (synth instanceof Tone.PluckSynth) {
            const note = getNoteForTrack(track, step, state.macros);
            synth.triggerAttack(note, time);
          } else {
            const note = getNoteForTrack(track, step, state.macros);
            const dur = track.voice === "pad" ? "2n" : track.voice === "bass" ? "8n" : "16n";
            (synth as Tone.Synth).triggerAttackRelease(note, dur, time);
          }
        } catch {
          // voice busy — skip
        }
      }
    }, "16n");
  }, []);

  const startPlayback = useCallback(async () => {
    await init();
    const transport = Tone.getTransport();
    transport.bpm.value = useEngine.getState().bpm;
    transport.start();
    useEngine.getState().play();
  }, [init]);

  const stopPlayback = useCallback(() => {
    Tone.getTransport().stop();
    useEngine.getState().stop();
  }, []);

  const pausePlayback = useCallback(() => {
    Tone.getTransport().pause();
    useEngine.getState().pause();
  }, []);

  useEffect(() => {
    const unsub = useEngine.subscribe((state, prev) => {
      if (state.bpm !== prev.bpm) {
        Tone.getTransport().bpm.value = state.bpm;
      }
      if (state.swing !== prev.swing) {
        Tone.getTransport().swing = state.swing / 200;
      }
    });
    return unsub;
  }, []);

  const exportWav = useCallback(async () => {
    const state = useEngine.getState();
    const currentTracks = state.patterns[state.currentPattern]?.tracks ?? [];
    const bpm = state.bpm;
    const macros = state.macros;
    const barDuration = (60 / bpm) * 4;

    const buffer = await Tone.Offline(({ transport }) => {
      transport.bpm.value = bpm;

      const master = new Tone.Channel({ volume: -3 }).toDestination();
      const offlineSynths: Record<string, SynthBank[string]> = {};
      const offlineChannels: Record<string, Tone.Channel> = {};

      for (const track of currentTracks) {
        const ch = new Tone.Channel({ volume: Tone.gainToDb(Math.max(track.level, 0.001)) });
        ch.connect(master);
        ch.mute = track.muted;
        offlineChannels[track.id] = ch;
        offlineSynths[track.id] = createSynth(track.voice, ch);
      }

      const anySoloed = currentTracks.some((t) => t.soloed);

      for (let step = 0; step < STEPS; step++) {
        const stepTime = step * (60 / bpm / 4);
        for (const track of currentTracks) {
          if (!track.pattern[step]) continue;
          if (track.muted || (anySoloed && !track.soloed)) continue;
          const prob = track.probability[step] ?? 100;
          if (prob < 100 && Math.random() * 100 >= prob) continue;

          const synth = offlineSynths[track.id];
          if (!synth) continue;

          if (synth instanceof Tone.NoiseSynth) {
            synth.triggerAttackRelease("32n", stepTime);
          } else if (synth instanceof Tone.MetalSynth) {
            synth.triggerAttackRelease("32n", stepTime, track.level * 0.3);
          } else if (synth instanceof Tone.PluckSynth) {
            synth.triggerAttack(getNoteForTrack(track, step, macros), stepTime);
          } else {
            const dur = track.voice === "pad" ? "2n" : track.voice === "bass" ? "8n" : "16n";
            (synth as Tone.Synth).triggerAttackRelease(
              getNoteForTrack(track, step, macros),
              dur,
              stepTime
            );
          }
        }
      }

      transport.start(0);
    }, barDuration + 0.5);

    const wav = audioBufferToWav(buffer);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stumptheschwab-${state.bpm}bpm.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const synths = synthsRef;
    const channels = channelsRef;
    const reverb = reverbRef;
    const delay = delayRef;
    const master = masterRef;
    const scheduleId = scheduleIdRef;
    return () => {
      if (scheduleId.current !== null) {
        Tone.getTransport().clear(scheduleId.current);
      }
      Tone.getTransport().stop();
      Object.values(synths.current).forEach((s) => s.dispose());
      Object.values(channels.current).forEach((c) => c.dispose());
      reverb.current?.dispose();
      delay.current?.dispose();
      master.current?.dispose();
    };
  }, []);

  return { startPlayback, stopPlayback, pausePlayback, exportWav, init };
}

function audioBufferToWav(buffer: Tone.ToneAudioBuffer): ArrayBuffer {
  const raw = buffer.toArray() as Float32Array;
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = raw.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, raw[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return arrayBuffer;
}
