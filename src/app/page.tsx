"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Track = {
  id: string;
  name: string;
  voice: "kick" | "snare" | "hat" | "bass" | "pluck" | "pad";
  hue: number;
  pattern: boolean[];
  level: number;
  pitch: number;
};

type Macro = {
  bloom: number;
  gravity: number;
  shimmer: number;
  fracture: number;
};

type ScenePreset = {
  name: string;
  promise: string;
  bpm: number;
  density: number;
  macros: Macro;
  emphasis: Track["voice"][];
};

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const STEPS = 16;
const EMPHASIS_BOOST = 0.12;
const BACKGROUND_DIP = -0.08;
const MIN_TRACK_LEVEL = 0.18;
const FRACTURE_SCENE_THRESHOLD = 55;
const FRACTURE_SCENE_INTERVAL = 5;
const REGENERATE_PLACEHOLDER_MESSAGE = "A newly generated world, ready to be sculpted into the hook.";
const initialTracks: Track[] = [
  { id: "pulse", name: "Pulse Engine", voice: "kick", hue: 270, level: 0.92, pitch: 46, pattern: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false] },
  { id: "glass", name: "Glass Impact", voice: "snare", hue: 318, level: 0.76, pitch: 188, pattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true] },
  { id: "dust", name: "Photon Dust", voice: "hat", hue: 190, level: 0.58, pitch: 6200, pattern: [true, false, true, false, true, true, true, false, true, false, true, false, true, true, false, true] },
  { id: "sub", name: "Sub Collider", voice: "bass", hue: 154, level: 0.84, pitch: 55, pattern: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false] },
  { id: "keys", name: "Neon Keys", voice: "pluck", hue: 42, level: 0.64, pitch: 330, pattern: [false, true, false, false, false, true, false, true, false, false, true, false, false, true, false, false] },
  { id: "aura", name: "Aura Pad", voice: "pad", hue: 226, level: 0.52, pitch: 110, pattern: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false] },
];
const initialTrackLevels = new Map(initialTracks.map((track) => [track.id, track.level]));

const scale = [0, 2, 3, 5, 7, 10, 12, 14];

const scenePresets: ScenePreset[] = [
  {
    name: "Nebula Breaks",
    promise: "Velvet drums, glowing pads, and a wide-open first drop.",
    bpm: 126,
    density: 62,
    macros: { bloom: 72, gravity: 44, shimmer: 63, fracture: 28 },
    emphasis: ["kick", "hat", "pad"],
  },
  {
    name: "Chrome Ritual",
    promise: "Industrial swing for a headline moment with sharp transients.",
    bpm: 138,
    density: 74,
    macros: { bloom: 54, gravity: 68, shimmer: 41, fracture: 52 },
    emphasis: ["kick", "snare", "bass"],
  },
  {
    name: "Solar Drill",
    promise: "Fast kinetic pockets, heavy sub pressure, and bright motion.",
    bpm: 152,
    density: 82,
    macros: { bloom: 61, gravity: 78, shimmer: 55, fracture: 64 },
    emphasis: ["kick", "hat", "bass"],
  },
  {
    name: "Dream Collider",
    promise: "Floating harmony and broken percussion for late-night ideas.",
    bpm: 112,
    density: 48,
    macros: { bloom: 88, gravity: 34, shimmer: 86, fracture: 21 },
    emphasis: ["pluck", "pad", "snare"],
  },
];

function makePattern(track: Track, density: number, gravity: number) {
  return Array.from({ length: STEPS }, (_, step) => {
    const downbeat = step % 4 === 0;
    const offbeat = step % 4 === 2;
    const phase = Math.sin((step + track.hue / 36) * (0.9 + gravity / 80));
    const threshold = density / 100 + (downbeat ? 0.22 : 0) + (offbeat ? 0.08 : 0);

    if (track.voice === "kick") return downbeat || (phase > 0.75 && density > 64);
    if (track.voice === "snare") return step === 4 || step === 12 || (phase > 0.86 && density > 74);
    if (track.voice === "hat") return step % 2 === 0 || phase > 0.38;
    if (track.voice === "pad") return step === 0 || step === 8 || (phase > 0.92 && density > 80);
    return phase + threshold > 1.08;
  });
}

function makeScenePattern(track: Track, preset: ScenePreset, trackIndex: number) {
  return makePattern(track, preset.density, preset.macros.gravity).map((active, index) => {
    if (preset.emphasis.includes(track.voice) && index % 4 === 0) return true;
    if (preset.macros.fracture > FRACTURE_SCENE_THRESHOLD && (index + trackIndex) % FRACTURE_SCENE_INTERVAL === 0) return !active;
    return active;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function Home() {
  const [tracks, setTracks] = useState(initialTracks);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [bpm, setBpm] = useState(126);
  const [density, setDensity] = useState(62);
  const [scene, setScene] = useState("Nebula Breaks");
  const [directive, setDirective] = useState(scenePresets[0].promise);
  const [macros, setMacros] = useState<Macro>({ bloom: 72, gravity: 44, shimmer: 63, fracture: 28 });
  const audioRef = useRef<AudioContext | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const feedbackRef = useRef<GainNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const tracksRef = useRef(tracks);
  const macrosRef = useRef(macros);
  const stepRef = useRef(step);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    macrosRef.current = macros;
  }, [macros]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const ensureAudio = useCallback(async () => {
    if (!audioRef.current) {
      const AudioCtor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const master = ctx.createGain();
      const delay = ctx.createDelay(1.2);
      const feedback = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      master.gain.value = 0.78;
      delay.delayTime.value = 0.18;
      feedback.gain.value = 0.22;
      filter.type = "lowpass";
      filter.frequency.value = 7800;

      delay.connect(feedback);
      feedback.connect(filter);
      filter.connect(delay);
      delay.connect(master);
      master.connect(ctx.destination);

      audioRef.current = ctx;
      delayRef.current = delay;
      feedbackRef.current = feedback;
      masterRef.current = master;
    }

    if (audioRef.current.state === "suspended") {
      await audioRef.current.resume();
    }
  }, []);

  const triggerVoice = useCallback((track: Track, time: number, index: number) => {
    const ctx = audioRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;

    const macro = macrosRef.current;
    const out = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const filter = ctx.createBiquadFilter();
    const send = ctx.createGain();
    const note = track.pitch * 2 ** (scale[(index + Math.round(macro.gravity / 14)) % scale.length] / 12);

    out.gain.value = 0;
    pan.pan.value = Math.sin(index + track.hue) * 0.42;
    filter.type = track.voice === "pad" ? "lowpass" : "bandpass";
    filter.frequency.value = clamp(380 + macro.bloom * 86 + track.pitch * 2, 180, 12000);
    filter.Q.value = 0.7 + macro.fracture / 42;
    send.gain.value = macro.shimmer / 260;

    out.connect(filter);
    filter.connect(pan);
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
      const bufferSize = Math.floor(ctx.sampleRate * (track.voice === "hat" ? 0.07 : 0.18));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      out.gain.setValueAtTime(track.level * (track.voice === "hat" ? 0.26 : 0.54), time);
      out.gain.exponentialRampToValueAtTime(0.001, time + (track.voice === "hat" ? 0.05 : 0.16));
      noise.connect(out);
      noise.start(time);
      return;
    }

    const osc = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    osc.type = track.voice === "pad" ? "sawtooth" : "triangle";
    mod.type = "sine";
    osc.frequency.value = note;
    mod.frequency.value = 0.6 + macro.fracture / 18;
    modGain.gain.value = track.voice === "pad" ? 11 : 4;
    mod.connect(modGain);
    modGain.connect(osc.frequency);
    out.gain.setValueAtTime(0.001, time);
    out.gain.linearRampToValueAtTime(track.level * (track.voice === "pad" ? 0.24 : 0.36), time + 0.025);
    out.gain.exponentialRampToValueAtTime(0.001, time + (track.voice === "pad" ? 1.15 : 0.34));
    osc.connect(out);
    osc.start(time);
    mod.start(time);
    osc.stop(time + (track.voice === "pad" ? 1.2 : 0.38));
    mod.stop(time + (track.voice === "pad" ? 1.2 : 0.38));
  }, []);

  const pulse = useCallback((nextStep: number) => {
    const ctx = audioRef.current;
    if (!ctx) return;
    const time = ctx.currentTime + 0.015;
    tracksRef.current.forEach((track, index) => {
      if (track.pattern[nextStep]) triggerVoice(track, time, index + nextStep);
    });
  }, [triggerVoice]);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      const next = (stepRef.current + 1) % STEPS;
      setStep(next);
      pulse(next);
    }, (60 / bpm / 4) * 1000);

    return () => window.clearInterval(interval);
  }, [bpm, playing, pulse]);

  const launch = async () => {
    await ensureAudio();
    if (!playing) pulse(step);
    setPlaying((value) => !value);
  };

  const regenerate = () => {
    const names = ["Nebula Breaks", "Quantum Bounce", "Chrome Ritual", "Zero-G Garage", "Solar Drill", "Dream Collider"];
    setScene(names[Math.floor(Math.random() * names.length)]);
    setDirective(REGENERATE_PLACEHOLDER_MESSAGE);
    setTracks((current) => current.map((track) => ({ ...track, pattern: makePattern(track, density, macros.gravity) })));
  };

  const applyScene = (preset: ScenePreset) => {
    setScene(preset.name);
    setDirective(preset.promise);
    setBpm(preset.bpm);
    setDensity(preset.density);
    setMacros(preset.macros);
    setTracks((current) => current.map((track, trackIndex) => {
      const baseline = initialTrackLevels.get(track.id) ?? track.level;

      return {
        ...track,
        level: clamp(baseline + (preset.emphasis.includes(track.voice) ? EMPHASIS_BOOST : BACKGROUND_DIP), MIN_TRACK_LEVEL, 1),
        pattern: makeScenePattern(track, preset, trackIndex),
      };
    }));
  };

  const mutate = () => {
    setTracks((current) => current.map((track) => ({
      ...track,
      pattern: track.pattern.map((active, index) => (Math.random() < macros.fracture / 260 || index === step ? !active : active)),
    })));
  };

  const energy = useMemo(() => {
    const active = tracks.reduce((sum, track) => sum + track.pattern.filter(Boolean).length * track.level, 0);
    return Math.round((active / (tracks.length * STEPS)) * 100);
  }, [tracks]);

  return (
    <main className="studio-shell">
      <section className="hero-panel">
        <div className="brand-block">
          <div className="orbital-mark" aria-hidden="true"><span /></div>
          <div>
            <p className="eyebrow">StumpTheSchwab rebuilt from zero</p>
            <h1>Future studio for beats, sound design, and impossible textures.</h1>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary-action" onClick={launch}>{playing ? "Pause engine" : "Start engine"}</button>
          <button className="ghost-action" onClick={regenerate}>Generate world</button>
          <button className="ghost-action" onClick={mutate}>Fracture pattern</button>
        </div>
      </section>

      <section className="command-strip" aria-label="Session controls">
        <div>
          <span>Scene</span>
          <strong>{scene}</strong>
        </div>
        <label>
          <span>BPM</span>
          <input type="range" min="72" max="178" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
          <strong>{bpm}</strong>
        </label>
        <label>
          <span>Density</span>
          <input type="range" min="12" max="96" value={density} onChange={(event) => setDensity(Number(event.target.value))} />
          <strong>{density}%</strong>
        </label>
        <div>
          <span>Energy</span>
          <strong>{energy}%</strong>
        </div>
      </section>

      <section className="vision-deck" aria-label="Founder vision scenes">
        <div className="section-heading">
          <p>Founder launchpad</p>
          <h2>Pick the next world.</h2>
        </div>
        <div className="scene-grid">
          {scenePresets.map((preset) => (
            <button
              className={`scene-card ${scene === preset.name ? "is-selected" : ""}`}
              key={preset.name}
              onClick={() => applyScene(preset)}
            >
              <span>{preset.bpm} BPM · {preset.density}% density</span>
              <strong>{preset.name}</strong>
              <small>{preset.promise}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="studio-grid">
        <div className="sequencer-card">
          <div className="section-heading">
            <p>Neural sequencer</p>
            <h2>Six engines, sixteen moments.</h2>
          </div>
          <div className="step-numbers" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, index) => <span key={index}>{index + 1}</span>)}
          </div>
          <div className="tracks">
            {tracks.map((track, trackIndex) => (
              <div className="track-row" key={track.id} style={{ "--track-hue": track.hue } as React.CSSProperties}>
                <div className="track-meta">
                  <strong>{track.name}</strong>
                  <span>{track.voice}</span>
                </div>
                <div className="step-grid">
                  {track.pattern.map((active, index) => (
                    <button
                      aria-label={`${track.name} step ${index + 1}`}
                      className={`step-cell ${active ? "is-active" : ""} ${step === index ? "is-current" : ""}`}
                      key={`${track.id}-${index}`}
                      onClick={() => setTracks((current) => current.map((item, itemIndex) => itemIndex === trackIndex ? { ...item, pattern: item.pattern.map((value, stepIndex) => stepIndex === index ? !value : value) } : item))}
                    />
                  ))}
                </div>
                <label className="mini-fader">
                  <span>Level</span>
                  <input type="range" min="0" max="1" step="0.01" value={track.level} onChange={(event) => setTracks((current) => current.map((item) => item.id === track.id ? { ...item, level: Number(event.target.value) } : item))} />
                </label>
              </div>
            ))}
          </div>
        </div>

        <aside className="synth-card">
          <div className="section-heading">
            <p>Sound design cockpit</p>
            <h2>Morph the whole machine.</h2>
          </div>
          {(Object.keys(macros) as Array<keyof Macro>).map((key) => (
            <label className="macro" key={key}>
              <span>{key}</span>
              <input type="range" min="0" max="100" value={macros[key]} onChange={(event) => setMacros((current) => ({ ...current, [key]: Number(event.target.value) }))} />
              <strong>{macros[key]}</strong>
            </label>
          ))}
          <div className="visualizer" aria-label="Generative studio visualizer">
            {tracks.map((track, index) => (
              <span
                key={track.id}
                style={{
                  "--track-hue": track.hue,
                  "--height": `${18 + track.pattern.filter(Boolean).length * 5 + index * 4}%`,
                } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="ai-card">
            <p>Creative directive</p>
            <strong>{directive}</strong>
            <span>Local Web Audio synthesis, generative sequencing, responsive macro control, and founder-grade scene direction for faster musical decisions.</span>
          </div>
        </aside>
      </section>
    </main>
  );
}
