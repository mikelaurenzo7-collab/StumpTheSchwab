"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEngineStore, STEPS, scale, type Track, type Macros } from "@/store/engine";

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const LOOKAHEAD = 25;
const SCHEDULE_AHEAD = 0.1;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const feedbackRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef(0);
  const schedulerStepRef = useRef(0);

  const ensureContext = useCallback(async () => {
    if (ctxRef.current) {
      if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
      return;
    }

    const AudioCtor =
      window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();

    const master = ctx.createGain();
    master.gain.value = 0.78;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 6;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.18;

    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;

    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 7800;

    delay.connect(feedback);
    feedback.connect(lpf);
    lpf.connect(delay);

    master.connect(compressor);
    delay.connect(compressor);
    compressor.connect(ctx.destination);

    ctxRef.current = ctx;
    masterRef.current = master;
    compressorRef.current = compressor;
    delayRef.current = delay;
    feedbackRef.current = feedback;
    filterRef.current = lpf;
  }, []);

  const triggerVoice = useCallback(
    (track: Track, time: number, stepIndex: number, macros: Macros) => {
      const ctx = ctxRef.current;
      const master = masterRef.current;
      if (!ctx || !master) return;

      const out = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const flt = ctx.createBiquadFilter();
      const send = ctx.createGain();
      const note = track.pitch;

      const scaledNote =
        note *
        2 **
          (scale[(stepIndex + Math.round(macros.gravity / 14)) % scale.length] /
            12);

      out.gain.value = 0;
      pan.pan.value = Math.sin(stepIndex + track.hue) * 0.42;
      flt.type = track.voice === "pad" ? "lowpass" : "bandpass";
      flt.frequency.value = clamp(
        380 + macros.bloom * 86 + note * 2,
        180,
        12000
      );
      flt.Q.value = 0.7 + macros.fracture / 42;
      send.gain.value = macros.shimmer / 260;

      out.connect(flt);
      flt.connect(pan);
      pan.connect(master);
      pan.connect(send);
      if (delayRef.current) send.connect(delayRef.current);

      if (track.voice === "kick") {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(145, time);
        osc.frequency.exponentialRampToValueAtTime(42, time + 0.22);
        out.gain.setValueAtTime(track.level * 0.88, time);
        out.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
        osc.connect(out);
        osc.start(time);
        osc.stop(time + 0.3);
        return;
      }

      if (track.voice === "snare" || track.voice === "hat") {
        const dur = track.voice === "hat" ? 0.07 : 0.18;
        const amp = track.voice === "hat" ? 0.26 : 0.54;
        const bufferSize = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++)
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        out.gain.setValueAtTime(track.level * amp, time);
        out.gain.exponentialRampToValueAtTime(0.001, time + dur - 0.01);
        noise.connect(out);
        noise.start(time);
        return;
      }

      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      osc.type = track.voice === "pad" ? "sawtooth" : "triangle";
      mod.type = "sine";
      osc.frequency.value = scaledNote;
      mod.frequency.value = 0.6 + macros.fracture / 18;
      modGain.gain.value = track.voice === "pad" ? 11 : 4;
      mod.connect(modGain);
      modGain.connect(osc.frequency);

      const dur = track.voice === "pad" ? 1.15 : 0.34;
      const amp = track.voice === "pad" ? 0.24 : 0.36;
      out.gain.setValueAtTime(0.001, time);
      out.gain.linearRampToValueAtTime(track.level * amp, time + 0.025);
      out.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(out);
      osc.start(time);
      mod.start(time);
      osc.stop(time + dur + 0.05);
      mod.stop(time + dur + 0.05);
    },
    []
  );

  const scheduleNote = useCallback(
    (step: number, time: number) => {
      const state = useEngineStore.getState();
      const { tracks, macros } = state;
      const hasSolo = tracks.some((t) => t.solo);

      tracks.forEach((track, tIdx) => {
        if (!track.pattern[step]) return;
        if (hasSolo && !track.solo) return;
        if (!hasSolo && track.muted) return;
        triggerVoice(track, time, tIdx + step, macros);
      });
    },
    [triggerVoice]
  );

  const scheduler = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { bpm } = useEngineStore.getState();
    const sixteenthDuration = 60 / bpm / 4;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleNote(schedulerStepRef.current, nextNoteTimeRef.current);
      useEngineStore.getState().setCurrentStep(schedulerStepRef.current);
      nextNoteTimeRef.current += sixteenthDuration;
      schedulerStepRef.current = (schedulerStepRef.current + 1) % STEPS;
    }
  }, [scheduleNote]);

  const play = useCallback(async () => {
    await ensureContext();
    const ctx = ctxRef.current;
    if (!ctx) return;

    schedulerStepRef.current = useEngineStore.getState().currentStep;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;

    scheduler();
    timerRef.current = window.setInterval(scheduler, LOOKAHEAD);
    useEngineStore.getState().setPlaying(true);
  }, [ensureContext, scheduler]);

  const stop = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    useEngineStore.getState().setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (useEngineStore.getState().playing) stop();
    else play();
  }, [play, stop]);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const fb = feedbackRef.current;
    const flt = filterRef.current;
    const macros = useEngineStore.getState().macros;
    if (fb) fb.gain.value = clamp(macros.shimmer / 200, 0, 0.7);
    if (flt) flt.frequency.value = clamp(2000 + macros.bloom * 80, 800, 14000);

    return useEngineStore.subscribe((state) => {
      if (fb) fb.gain.value = clamp(state.macros.shimmer / 200, 0, 0.7);
      if (flt)
        flt.frequency.value = clamp(
          2000 + state.macros.bloom * 80,
          800,
          14000
        );
    });
  }, []);

  return { play, stop, toggle };
}
