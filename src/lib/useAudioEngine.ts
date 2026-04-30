"use client";

import { useCallback, useEffect, useRef } from "react";
import * as Tone from "tone";
import { useEngine } from "@/store/engine";
import { STEPS, SCALE } from "@/lib/sounds";

interface Voice {
  trigger: (time: number, pitch: number, level: number, macro: { bloom: number; gravity: number; shimmer: number; fracture: number }, stepIndex: number) => void;
  dispose: () => void;
}

function createKick(channel: Tone.Channel): Voice {
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 6,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.1 },
  }).connect(channel);

  return {
    trigger(time, _pitch, level) {
      synth.volume.setValueAtTime(Tone.gainToDb(level * 0.9), time);
      synth.triggerAttackRelease("C1", "8n", time);
    },
    dispose() { synth.dispose(); },
  };
}

function createSnare(channel: Tone.Channel): Voice {
  const noise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05 },
  }).connect(channel);

  const body = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
  }).connect(channel);

  return {
    trigger(time, _pitch, level) {
      const db = Tone.gainToDb(level * 0.55);
      noise.volume.setValueAtTime(db, time);
      body.volume.setValueAtTime(db - 6, time);
      noise.triggerAttackRelease("16n", time);
      body.triggerAttackRelease("E2", "16n", time);
    },
    dispose() { noise.dispose(); body.dispose(); },
  };
}

function createHat(channel: Tone.Channel): Voice {
  const synth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).connect(channel);
  synth.frequency.value = 200;

  return {
    trigger(time, _pitch, level) {
      synth.volume.setValueAtTime(Tone.gainToDb(level * 0.3), time);
      synth.triggerAttackRelease("32n", time);
    },
    dispose() { synth.dispose(); },
  };
}

function createClap(channel: Tone.Channel): Voice {
  const noise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.08 },
  });
  const filter = new Tone.Filter(1200, "bandpass", -12).connect(channel);
  noise.connect(filter);

  return {
    trigger(time, _pitch, level) {
      noise.volume.setValueAtTime(Tone.gainToDb(level * 0.5), time);
      noise.triggerAttackRelease("16n", time);
    },
    dispose() { noise.dispose(); filter.dispose(); },
  };
}

function createBass(channel: Tone.Channel): Voice {
  const synth = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    filter: { Q: 2, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.1 },
    filterEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.1, baseFrequency: 80, octaves: 2.5 },
  }).connect(channel);

  return {
    trigger(time, pitch, level, macro, stepIndex) {
      const noteIndex = (stepIndex + Math.round(macro.gravity / 14)) % SCALE.length;
      const freq = pitch * 2 ** (SCALE[noteIndex] / 12);
      synth.volume.setValueAtTime(Tone.gainToDb(level * 0.7), time);
      synth.filter.frequency.setValueAtTime(380 + macro.bloom * 40, time);
      synth.triggerAttackRelease(freq, "8n", time);
    },
    dispose() { synth.dispose(); },
  };
}

function createPluck(channel: Tone.Channel): Voice {
  const synth = new Tone.PluckSynth({
    attackNoise: 1,
    dampening: 4000,
    resonance: 0.92,
  }).connect(channel);

  return {
    trigger(time, pitch, level, macro, stepIndex) {
      const noteIndex = (stepIndex + Math.round(macro.gravity / 14)) % SCALE.length;
      const freq = pitch * 2 ** (SCALE[noteIndex] / 12);
      synth.volume.setValueAtTime(Tone.gainToDb(level * 0.5), time);
      synth.triggerAttack(Math.max(20, Math.min(freq, 8000)), time);
    },
    dispose() { synth.dispose(); },
  };
}

function createPerc(channel: Tone.Channel): Voice {
  const synth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.1, release: 0.03 },
    harmonicity: 3.1,
    modulationIndex: 16,
    resonance: 2000,
    octaves: 1,
  }).connect(channel);
  synth.frequency.value = 400;

  return {
    trigger(time, _pitch, level) {
      synth.volume.setValueAtTime(Tone.gainToDb(level * 0.35), time);
      synth.triggerAttackRelease("32n", time);
    },
    dispose() { synth.dispose(); },
  };
}

function createPad(channel: Tone.Channel): Voice {
  const synth = new Tone.FMSynth({
    harmonicity: 2,
    modulationIndex: 3,
    oscillator: { type: "sine" },
    envelope: { attack: 0.15, decay: 0.3, sustain: 0.6, release: 0.8 },
    modulation: { type: "triangle" },
    modulationEnvelope: { attack: 0.2, decay: 0.2, sustain: 0.5, release: 0.5 },
  }).connect(channel);

  return {
    trigger(time, pitch, level, macro, stepIndex) {
      const noteIndex = (stepIndex + Math.round(macro.gravity / 14)) % SCALE.length;
      const freq = pitch * 2 ** (SCALE[noteIndex] / 12);
      synth.volume.setValueAtTime(Tone.gainToDb(level * 0.35), time);
      synth.modulationIndex.setValueAtTime(3 + macro.fracture / 15, time);
      synth.triggerAttackRelease(freq, "2n", time);
    },
    dispose() { synth.dispose(); },
  };
}

const VOICE_FACTORY: Record<string, (ch: Tone.Channel) => Voice> = {
  kick: createKick,
  snare: createSnare,
  hat: createHat,
  clap: createClap,
  bass: createBass,
  pluck: createPluck,
  perc: createPerc,
  pad: createPad,
};

export function useAudioEngine() {
  const voicesRef = useRef<Map<string, Voice>>(new Map());
  const channelsRef = useRef<Map<string, Tone.Channel>>(new Map());
  const sendRef = useRef<Tone.Channel | null>(null);
  const delayRef = useRef<Tone.FeedbackDelay | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const sequenceRef = useRef<Tone.Sequence | null>(null);
  const initRef = useRef(false);

  const init = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;

    await Tone.start();

    const delay = new Tone.FeedbackDelay("8n.", 0.22).toDestination();
    const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.2 }).toDestination();
    const send = new Tone.Channel({ volume: -8 });
    send.connect(delay);
    send.connect(reverb);

    delayRef.current = delay;
    reverbRef.current = reverb;
    sendRef.current = send;

    const tracks = useEngine.getState().tracks();
    tracks.forEach((track) => {
      const channel = new Tone.Channel({ volume: 0, pan: track.pan }).toDestination();
      channel.send("send", -8);
      channelsRef.current.set(track.id, channel);

      const factory = VOICE_FACTORY[track.voice];
      if (factory) {
        voicesRef.current.set(track.id, factory(channel));
      }
    });
  }, []);

  const startSequencer = useCallback(() => {
    if (sequenceRef.current) {
      sequenceRef.current.dispose();
    }

    const indices = Array.from({ length: STEPS }, (_, i) => i);
    const seq = new Tone.Sequence(
      (time, stepIndex) => {
        const state = useEngine.getState();
        const tracks = state.tracks();
        const macros = state.macros;

        useEngine.getState().setStep(stepIndex);

        const hasSolo = tracks.some((t) => t.solo);

        tracks.forEach((track) => {
          if (track.mute) return;
          if (hasSolo && !track.solo) return;

          const step = track.steps[stepIndex];
          if (!step || !step.active) return;

          if (step.probability < 100 && Math.random() * 100 > step.probability) return;

          const channel = channelsRef.current.get(track.id);
          if (channel) {
            channel.volume.setValueAtTime(Tone.gainToDb(track.level), time);
            channel.pan.setValueAtTime(track.pan, time);
          }

          const voice = voicesRef.current.get(track.id);
          voice?.trigger(time, track.pitch, track.level, macros, stepIndex);
        });
      },
      indices,
      "16n",
    );

    seq.start(0);
    sequenceRef.current = seq;
  }, []);

  const play = useCallback(async () => {
    await init();
    startSequencer();
    Tone.getTransport().start();
  }, [init, startSequencer]);

  const pause = useCallback(() => {
    Tone.getTransport().pause();
  }, []);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    useEngine.getState().setStep(0);
  }, []);

  useEffect(() => {
    const unsub = useEngine.subscribe(
      (state) => state.bpm,
      (bpm) => { Tone.getTransport().bpm.value = bpm; },
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = useEngine.subscribe(
      (state) => state.swing,
      (swing) => { Tone.getTransport().swing = swing / 100; },
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = useEngine.subscribe(
      (state) => state.macros.shimmer,
      (shimmer) => {
        if (delayRef.current) delayRef.current.feedback.value = shimmer / 400;
        if (reverbRef.current) reverbRef.current.wet.value = shimmer / 300;
      },
    );
    return unsub;
  }, []);

  const exportWav = useCallback(async (): Promise<Blob> => {
    const state = useEngine.getState();
    const tracks = state.tracks();
    const macros = state.macros;
    const bpm = state.bpm;
    const measures = 1;
    const duration = (60 / bpm) * 4 * measures;

    const buffer = await Tone.Offline(({ transport }) => {
      transport.bpm.value = bpm;
      transport.swing = state.swing / 100;

      const dest = Tone.getDestination();

      tracks.forEach((track) => {
        if (track.mute) return;
        const channel = new Tone.Channel({ volume: 0, pan: track.pan }).connect(dest);
        const factory = VOICE_FACTORY[track.voice];
        if (!factory) return;
        const voice = factory(channel);

        const indices = Array.from({ length: STEPS }, (_, i) => i);
        const seq = new Tone.Sequence(
          (time, stepIndex) => {
            const step = track.steps[stepIndex];
            if (!step?.active) return;
            if (step.probability < 100 && Math.random() * 100 > step.probability) return;
            voice.trigger(time, track.pitch, track.level, macros, stepIndex);
          },
          indices,
          "16n",
        );
        seq.start(0);
      });

      transport.start();
    }, duration);

    const wav = audioBufferToWav(buffer);
    return new Blob([wav], { type: "audio/wav" });
  }, []);

  const dispose = useCallback(() => {
    sequenceRef.current?.dispose();
    voicesRef.current.forEach((v) => v.dispose());
    channelsRef.current.forEach((ch) => ch.dispose());
    sendRef.current?.dispose();
    delayRef.current?.dispose();
    reverbRef.current?.dispose();
    voicesRef.current.clear();
    channelsRef.current.clear();
    initRef.current = false;
  }, []);

  useEffect(() => {
    return () => { dispose(); };
  }, [dispose]);

  return { play, pause, stop, exportWav, init };
}

function audioBufferToWav(buffer: Tone.ToneAudioBuffer): ArrayBuffer {
  const raw = buffer.toArray() as Float32Array | Float32Array[];
  const channels = Array.isArray(raw) ? raw : [raw];
  const numChannels = channels.length;
  const length = channels[0].length;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
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
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}
