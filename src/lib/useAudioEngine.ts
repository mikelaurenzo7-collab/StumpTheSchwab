import { useEffect, useRef, useCallback } from 'react';
import { useEngine } from '../store/engine';
import { Scheduler } from './scheduler';
import { triggerVoice } from './voices';

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<Scheduler | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const sendRef = useRef<DelayNode | null>(null);

  const ensureContext = useCallback(async () => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') await ctxRef.current.resume();
      return ctxRef.current;
    }

    const Ctor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = 0.78;
    master.connect(limiter);

    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.18;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 5400;

    delay.connect(feedback);
    feedback.connect(filter);
    filter.connect(delay);
    delay.connect(master);

    ctxRef.current = ctx;
    masterRef.current = master;
    sendRef.current = delay;

    return ctx;
  }, []);

  const start = useCallback(async () => {
    const ctx = await ensureContext();
    if (!ctx) return;

    schedulerRef.current?.stop();

    const scheduler = new Scheduler(
      ctx,
      () => useEngine.getState().bpm,
      () => useEngine.getState().swing,
      (step, time) => {
        useEngine.setState({ currentStep: step });
        const state = useEngine.getState();
        state.tracks.forEach(track => {
          if (track.pattern[step] && !track.muted) {
            triggerVoice(ctx, masterRef.current!, sendRef.current, track, state.macros, step, time);
          }
        });
      },
    );

    scheduler.start(useEngine.getState().currentStep);
    schedulerRef.current = scheduler;
    useEngine.setState({ playing: true });
  }, [ensureContext]);

  const stop = useCallback(() => {
    schedulerRef.current?.stop();
    schedulerRef.current = null;
    useEngine.setState({ playing: false });
  }, []);

  const toggle = useCallback(async () => {
    if (useEngine.getState().playing) {
      stop();
    } else {
      await start();
    }
  }, [start, stop]);

  useEffect(() => {
    return () => {
      schedulerRef.current?.stop();
      ctxRef.current?.close();
    };
  }, []);

  return { toggle, start, stop, ensureContext };
}
