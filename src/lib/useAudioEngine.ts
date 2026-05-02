"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEngineStore, type Track } from "../store/engine";
import { SCALE, STEPS } from "./sounds";
import { downloadWav } from "./wav";

type Tone = typeof import("tone");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySynth = any;

interface AudioGraph {
  tone: Tone;
  synths: Record<string, AnySynth>;
  gains: Record<string, InstanceType<Tone["Gain"]>>;
  masterFilter: InstanceType<Tone["Filter"]>;
  delay: InstanceType<Tone["FeedbackDelay"]>;
  distortion: InstanceType<Tone["Distortion"]>;
  compressor: InstanceType<Tone["Compressor"]>;
  master: InstanceType<Tone["Gain"]>;
  sequence: AnySynth;
  hatFilter: InstanceType<Tone["Filter"]>;
}

function createSynths(T: Tone, dest: import("tone").InputNode) {
  const synths: Record<string, AnySynth> = {};
  const gains: Record<string, InstanceType<Tone["Gain"]>> = {};

  const compressor = new T.Compressor(-18, 4).connect(dest);
  const master = new T.Gain(0.82).connect(compressor);
  const masterFilter = new T.Filter(18000, "lowpass").connect(master);
  const distortion = new T.Distortion(0).connect(masterFilter);
  const delay = new T.FeedbackDelay("8n.", 0.18).connect(master);
  delay.wet.value = 0.15;
  const hatFilter = new T.Filter(7500, "highpass");

  const tracks = useEngineStore.getState().tracks;

  tracks.forEach((track) => {
    const gain = new T.Gain(track.level);

    if (track.voice === "hat") {
      gain.connect(hatFilter);
      hatFilter.connect(distortion);
    } else {
      gain.connect(distortion);
    }
    gain.connect(delay);
    gains[track.id] = gain;

    switch (track.voice) {
      case "kick":
        synths[track.id] = new T.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 6,
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.08 },
        }).connect(gain);
        break;
      case "snare":
        synths[track.id] = new T.NoiseSynth({
          noise: { type: "white" },
          envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
        }).connect(gain);
        break;
      case "hat":
        synths[track.id] = new T.NoiseSynth({
          noise: { type: "white" },
          envelope: { attack: 0.001, decay: 0.055, sustain: 0 },
        }).connect(gain);
        break;
      case "bass":
        synths[track.id] = new T.MonoSynth({
          oscillator: { type: "square" },
          envelope: { attack: 0.008, decay: 0.25, sustain: 0.3, release: 0.08 },
          filterEnvelope: {
            attack: 0.006,
            decay: 0.12,
            sustain: 0.4,
            release: 0.08,
            baseFrequency: 180,
            octaves: 2.6,
          },
        }).connect(gain);
        break;
      case "pluck":
        synths[track.id] = new T.FMSynth({
          harmonicity: 3,
          modulationIndex: 10,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.001, decay: 0.22, sustain: 0.04, release: 0.08 },
          modulation: { type: "square" },
          modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.08 },
        }).connect(gain);
        break;
      case "pad":
        synths[track.id] = new T.Synth({
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.18, decay: 0.4, sustain: 0.55, release: 1.2 },
        }).connect(gain);
        break;
    }
  });

  return { synths, gains, masterFilter, delay, distortion, compressor, master, hatFilter };
}

function triggerVoice(
  synth: AnySynth,
  track: Track,
  stepIndex: number,
  time: number,
  gravity: number,
) {
  const scaleIdx = (stepIndex + Math.round(gravity / 14)) % SCALE.length;
  const semitones = SCALE[scaleIdx];

  switch (track.voice) {
    case "kick":
      synth.triggerAttackRelease("C1", "8n", time, 0.88);
      break;
    case "snare":
    case "hat":
      synth.triggerAttackRelease(track.voice === "hat" ? "32n" : "8n", time);
      break;
    case "bass": {
      const freq = track.pitch * Math.pow(2, semitones / 12);
      synth.triggerAttackRelease(freq, "16n", time, 0.85);
      break;
    }
    case "pluck": {
      const freq = track.pitch * Math.pow(2, semitones / 12);
      synth.triggerAttackRelease(freq, "16n", time, 0.7);
      break;
    }
    case "pad": {
      const freq = track.pitch * Math.pow(2, semitones / 12);
      synth.triggerAttackRelease(freq, "4n", time, 0.5);
      break;
    }
  }
}

export function useAudioEngine() {
  const graphRef = useRef<AudioGraph | null>(null);
  const initRef = useRef(false);

  const init = useCallback(async () => {
    if (initRef.current) return;
    const T = await import("tone");
    await T.start();

    const dest = T.getDestination();
    const { synths, gains, masterFilter, delay, distortion, compressor, master, hatFilter } =
      createSynths(T, dest);

    const transport = T.getTransport();
    const state = useEngineStore.getState();
    transport.bpm.value = state.bpm;
    transport.swing = state.swing / 100;
    transport.swingSubdivision = "16n";

    const sequence = new T.Sequence(
      (time, stepIndex) => {
        const s = useEngineStore.getState();
        const hasSolo = s.tracks.some((t) => t.soloed);

        s.tracks.forEach((track) => {
          if (!track.pattern[stepIndex]) return;
          if (track.muted) return;
          if (hasSolo && !track.soloed) return;

          const synth = synths[track.id];
          if (synth) triggerVoice(synth, track, stepIndex, time, s.macros.gravity);
        });

        const drawTime = time - T.now();
        setTimeout(() => {
          useEngineStore.getState().setCurrentStep(stepIndex);
        }, Math.max(0, drawTime * 1000));
      },
      Array.from({ length: STEPS }, (_, i) => i),
      "16n",
    );

    sequence.start(0);
    initRef.current = true;
    graphRef.current = {
      tone: T,
      synths,
      gains,
      masterFilter,
      delay,
      distortion,
      compressor,
      master,
      sequence,
      hatFilter,
    };
  }, []);

  const play = useCallback(async () => {
    await init();
    graphRef.current!.tone.getTransport().start();
  }, [init]);

  const pause = useCallback(() => {
    if (!graphRef.current) return;
    graphRef.current.tone.getTransport().pause();
  }, []);

  const stop = useCallback(() => {
    if (!graphRef.current) return;
    graphRef.current.tone.getTransport().stop();
    useEngineStore.getState().setCurrentStep(0);
  }, []);

  // Sync BPM
  const bpm = useEngineStore((s) => s.bpm);
  useEffect(() => {
    if (graphRef.current) graphRef.current.tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  // Sync swing
  const swing = useEngineStore((s) => s.swing);
  useEffect(() => {
    if (graphRef.current) graphRef.current.tone.getTransport().swing = swing / 100;
  }, [swing]);

  // Sync track levels
  const tracks = useEngineStore((s) => s.tracks);
  useEffect(() => {
    if (!graphRef.current) return;
    tracks.forEach((track) => {
      const gain = graphRef.current!.gains[track.id];
      if (gain) gain.gain.value = track.level;
    });
  }, [tracks]);

  // Sync macros to effects
  const macros = useEngineStore((s) => s.macros);
  useEffect(() => {
    if (!graphRef.current) return;
    const { masterFilter, delay, distortion } = graphRef.current;
    masterFilter.frequency.value = 200 * Math.pow(90, macros.bloom / 100);
    delay.wet.value = macros.shimmer / 250;
    delay.feedback.value = 0.1 + (macros.shimmer / 100) * 0.4;
    distortion.distortion = macros.fracture / 125;
  }, [macros]);

  const exportWav = useCallback(async () => {
    const store = useEngineStore.getState();
    store.setExporting(true);

    try {
      const T = await import("tone");
      const exportBpm = store.bpm;
      const duration = (60 / exportBpm) * 4;

      const buffer = await T.Offline(({ transport }) => {
        transport.bpm.value = exportBpm;

        const offDest = T.getDestination();
        const { synths: offSynths } = createSynths(T, offDest);

        const hasSolo = store.tracks.some((t) => t.soloed);

        const seq = new T.Sequence(
          (time, stepIndex) => {
            store.tracks.forEach((track) => {
              if (!track.pattern[stepIndex]) return;
              if (track.muted) return;
              if (hasSolo && !track.soloed) return;
              const synth = offSynths[track.id];
              if (synth) triggerVoice(synth, track, stepIndex, time, store.macros.gravity);
            });
          },
          Array.from({ length: STEPS }, (_, i) => i),
          "16n",
        );

        seq.start(0);
        transport.start();
      }, duration);

      const rawBuffer = buffer.get();
      if (rawBuffer) {
        const sceneName = store.scene.toLowerCase().replace(/\s+/g, "-");
        downloadWav(rawBuffer, `${sceneName}-${store.bpm}bpm.wav`);
      }
    } finally {
      useEngineStore.getState().setExporting(false);
    }
  }, []);

  return { play, pause, stop, exportWav };
}
