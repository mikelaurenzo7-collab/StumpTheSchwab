"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEngine } from "../store/engine";
import { STEPS, scale, type Track, type Macro, type Voice } from "./sounds";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tone = typeof import("tone");

let tonePromise: Promise<Tone> | null = null;
function loadTone(): Promise<Tone> {
  if (!tonePromise) tonePromise = import("tone");
  return tonePromise;
}

function levelToDb(level: number): number {
  if (level <= 0) return -Infinity;
  return 20 * Math.log10(level);
}

function createSynth(T: Tone, voice: Voice): any {
  switch (voice) {
    case "kick":
      return new T.MembraneSynth({
        pitchDecay: 0.06,
        octaves: 5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.002, decay: 0.32, sustain: 0, release: 0.04 },
      });
    case "snare":
      return new T.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
      });
    case "hat":
      return new T.MetalSynth({
        envelope: { attack: 0.001, decay: 0.06, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      });
    case "bass":
      return new T.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.005, decay: 0.22, sustain: 0.35, release: 0.08 },
        filterEnvelope: { attack: 0.006, decay: 0.18, sustain: 0.24, baseFrequency: 180, octaves: 2.5, release: 0.08 },
      });
    case "pluck":
      return new T.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.003, decay: 0.22, sustain: 0, release: 0.06 },
      });
    case "pad":
      return new T.FMSynth({
        harmonicity: 3,
        modulationIndex: 10,
        envelope: { attack: 0.08, decay: 0.4, sustain: 0.7, release: 1.0 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.3, decay: 0, sustain: 1, release: 0.5 },
      });
  }
}

function triggerVoice(track: Track, step: number, time: number, macros: Macro, synth: any) {
  const noteHz = track.pitch * 2 ** (scale[(step + Math.round(macros.gravity / 14)) % scale.length] / 12);

  switch (track.voice) {
    case "kick":
      synth.triggerAttackRelease(track.pitch, "8n", time, track.level * 0.9);
      break;
    case "snare":
      synth.triggerAttackRelease("16n", time, track.level * 0.7);
      break;
    case "hat":
      synth.triggerAttackRelease("32n", time, track.level * 0.35);
      break;
    case "bass":
      synth.triggerAttackRelease(noteHz, "8n", time, track.level * 0.8);
      break;
    case "pluck":
      synth.triggerAttackRelease(noteHz, "16n", time, track.level * 0.55);
      break;
    case "pad":
      synth.triggerAttackRelease(noteHz, "2n", time, track.level * 0.35);
      break;
  }
}

function isAudible(track: Track, tracks: Track[]): boolean {
  const anySoloed = tracks.some((t) => t.soloed);
  return anySoloed ? track.soloed : !track.muted;
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numCh = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const blockAlign = numCh * 2;
  const dataSize = buffer.length * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);

  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  let off = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return buf;
}

export function useAudioEngine() {
  const toneRef = useRef<Tone | null>(null);
  const readyRef = useRef(false);
  const synthsRef = useRef<Record<string, any>>({});
  const channelsRef = useRef<Record<string, any>>({});
  const filtersRef = useRef<Record<string, any>>({});
  const delayRef = useRef<any>(null);
  const reverbRef = useRef<any>(null);
  const stepRef = useRef(-1);

  const init = useCallback(async () => {
    if (readyRef.current) return;
    const T = await loadTone();
    toneRef.current = T;
    await T.start();

    const transport = T.getTransport();
    const state = useEngine.getState();
    transport.bpm.value = state.bpm;
    transport.swing = state.swing / 100;
    transport.swingSubdivision = "16n";

    const comp = new T.Compressor(-14, 4).toDestination();
    const delay = new T.FeedbackDelay("8n.", 0.2).connect(comp);
    delay.wet.value = 0.12;
    const reverb = new T.Reverb({ decay: 2.8, wet: 0.15 }).connect(comp);
    delayRef.current = delay;
    reverbRef.current = reverb;

    for (const track of state.tracks) {
      const channel = new T.Channel({ volume: levelToDb(track.level) }).connect(comp);
      const delaySend = new T.Gain(0.12).connect(delay);
      const reverbSend = new T.Gain(0.08).connect(reverb);
      channel.connect(delaySend);
      channel.connect(reverbSend);

      const filter = new T.Filter({ frequency: 200 + state.macros.bloom * 140, type: "lowpass", rolloff: -12 });
      filter.connect(channel);

      const synth = createSynth(T, track.voice);
      synth.connect(filter);

      synthsRef.current[track.id] = synth;
      channelsRef.current[track.id] = channel;
      filtersRef.current[track.id] = filter;
    }

    transport.scheduleRepeat((time: number) => {
      stepRef.current = (stepRef.current + 1) % STEPS;
      const cur = stepRef.current;
      const { tracks, macros } = useEngine.getState();

      tracks.forEach((track) => {
        if (!track.pattern[cur]) return;
        if (!isAudible(track, tracks)) return;
        triggerVoice(track, cur, time, macros, synthsRef.current[track.id]);
      });

      T.getDraw().schedule(() => {
        useEngine.getState().setCurrentStep(cur);
      }, time);
    }, "16n");

    readyRef.current = true;
  }, []);

  const play = useCallback(async () => {
    await init();
    const T = toneRef.current!;
    const transport = T.getTransport();

    if (transport.state === "started") {
      transport.pause();
      useEngine.getState().setPlaying(false);
    } else {
      transport.start();
      useEngine.getState().setPlaying(true);
    }
  }, [init]);

  const stop = useCallback(() => {
    if (!toneRef.current) return;
    toneRef.current.getTransport().stop();
    stepRef.current = -1;
    useEngine.setState({ playing: false, currentStep: 0 });
  }, []);

  const exportWav = useCallback(async () => {
    if (!toneRef.current) await init();
    const T = toneRef.current!;
    const state = useEngine.getState();
    const barDuration = (60 / state.bpm) * 4;

    const buffer = await T.Offline(({ transport }) => {
      transport.bpm.value = state.bpm;

      const comp = new T.Compressor(-14, 4).toDestination();
      const anySoloed = state.tracks.some((t) => t.soloed);

      state.tracks.forEach((track) => {
        const audible = anySoloed ? track.soloed : !track.muted;
        if (!audible) return;

        const channel = new T.Channel({ volume: levelToDb(track.level) }).connect(comp);
        const filter = new T.Filter({
          frequency: 200 + state.macros.bloom * 140,
          type: "lowpass",
        }).connect(channel);
        const synth = createSynth(T, track.voice);
        synth.connect(filter);

        for (let step = 0; step < STEPS; step++) {
          if (!track.pattern[step]) continue;
          const t = (60 / state.bpm / 4) * step;
          transport.schedule((time: number) => {
            triggerVoice(track, step, time, state.macros, synth);
          }, t);
        }
      });

      transport.start();
    }, barDuration + 1.5);

    const raw = buffer.get();
    if (!raw) return;
    const wav = audioBufferToWav(raw);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.scene.toLowerCase().replace(/\s+/g, "-")}-${state.bpm}bpm.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, [init]);

  // Sync BPM → Transport
  useEffect(() => {
    const unsub = useEngine.subscribe(
      (s) => s.bpm,
      (bpm) => {
        if (toneRef.current) toneRef.current.getTransport().bpm.value = bpm;
      },
    );
    return unsub;
  }, []);

  // Sync swing → Transport
  useEffect(() => {
    const unsub = useEngine.subscribe(
      (s) => s.swing,
      (swing) => {
        if (!toneRef.current) return;
        toneRef.current.getTransport().swing = swing / 100;
      },
    );
    return unsub;
  }, []);

  // Sync track levels → Channels
  useEffect(() => {
    const unsub = useEngine.subscribe(
      (s) => s.tracks,
      (tracks) => {
        tracks.forEach((t) => {
          const ch = channelsRef.current[t.id];
          if (ch) ch.volume.value = levelToDb(t.level);
        });
      },
    );
    return unsub;
  }, []);

  // Sync macros → Filters + FX
  useEffect(() => {
    const unsub = useEngine.subscribe(
      (s) => s.macros,
      (macros) => {
        Object.values(filtersRef.current).forEach((f: any) => {
          f.frequency.value = 200 + macros.bloom * 140;
        });
        if (delayRef.current) delayRef.current.wet.value = macros.shimmer / 260;
        if (reverbRef.current) reverbRef.current.wet.value = macros.shimmer / 320;
      },
    );
    return unsub;
  }, []);

  return { play, stop, exportWav };
}
