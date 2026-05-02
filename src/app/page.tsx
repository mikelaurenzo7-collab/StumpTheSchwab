"use client";

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Tone from "tone";

type Track = {
  id: string;
  name: string;
  voice: "kick" | "snare" | "hat" | "bass" | "pluck" | "pad";
  glyph: string;
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

const STEPS = 16;
const RING_RADII = [292, 256, 220, 184, 148, 112];
const STEP_RADIUS = 12;
const ORB_CENTER = 350;
const ORB_VIEW = 700;

const initialTracks: Track[] = [
  { id: "pulse", name: "Pulse Engine", voice: "kick", glyph: "◉", hue: 270, level: 0.92, pitch: 46, pattern: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false] },
  { id: "glass", name: "Glass Impact", voice: "snare", glyph: "✦", hue: 318, level: 0.76, pitch: 188, pattern: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true] },
  { id: "dust", name: "Photon Dust", voice: "hat", glyph: "·", hue: 190, level: 0.58, pitch: 6200, pattern: [true, false, true, false, true, true, true, false, true, false, true, false, true, true, false, true] },
  { id: "sub", name: "Sub Collider", voice: "bass", glyph: "▼", hue: 154, level: 0.84, pitch: 55, pattern: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false] },
  { id: "keys", name: "Neon Keys", voice: "pluck", glyph: "◆", hue: 42, level: 0.64, pitch: 330, pattern: [false, true, false, false, false, true, false, true, false, false, true, false, false, true, false, false] },
  { id: "aura", name: "Aura Pad", voice: "pad", glyph: "◯", hue: 226, level: 0.52, pitch: 110, pattern: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false] },
];

const scale = [0, 2, 3, 5, 7, 10, 12, 14];

const REVERB_SEND_BASE: Record<string, number> = {
  pulse: 0.04,
  glass: 0.22,
  dust: 0.10,
  sub: 0.05,
  keys: 0.32,
  aura: 0.55,
};

type VoiceBundle = {
  kick: Tone.MembraneSynth;
  kickClick: Tone.NoiseSynth;
  snareNoise: Tone.NoiseSynth;
  snareBody: Tone.Synth;
  hat: Tone.MetalSynth;
  bass: Tone.MonoSynth;
  bassSub: Tone.Synth;
  pluck: Tone.PluckSynth;
  pad: Tone.PolySynth;
};

type MasterChain = {
  filter: Tone.Filter;
  distortion: Tone.Distortion;
  reverb: Tone.Reverb;
  compressor: Tone.Compressor;
  limiter: Tone.Limiter;
};

type Sends = Record<string, Tone.Gain>;

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function polar(radius: number, step: number) {
  const angle = (step / STEPS) * Math.PI * 2 - Math.PI / 2;
  return {
    x: ORB_CENTER + radius * Math.cos(angle),
    y: ORB_CENTER + radius * Math.sin(angle),
    angle,
  };
}

type RotaryProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  hue: number;
  onChange: (next: number) => void;
};

function Rotary({ label, value, min, max, hue, onChange }: RotaryProps) {
  const dragRef = useRef<{ y: number; v: number } | null>(null);

  const handleDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { y: event.clientY, v: value };
  };

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const range = max - min;
    const next = dragRef.current.v + ((dragRef.current.y - event.clientY) / 220) * range;
    onChange(clamp(next, min, max));
  };

  const handleUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const ratio = (value - min) / (max - min);
  const angle = -135 + ratio * 270;
  const arcLength = 282;
  const dash = arcLength * ratio;

  return (
    <div className="rotary" style={{ "--rot-hue": hue } as React.CSSProperties}>
      <div
        className="rotary-body"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <svg className="rotary-arc" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" className="rotary-track" />
          <circle
            cx="60"
            cy="60"
            r="50"
            className="rotary-fill"
            strokeDasharray={`${dash} ${arcLength}`}
          />
        </svg>
        <div className="rotary-cap" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="rotary-pin" />
        </div>
        <strong className="rotary-readout">{Math.round(value)}</strong>
      </div>
      <span className="rotary-label">{label}</span>
    </div>
  );
}

export default function Home() {
  const [tracks, setTracks] = useState(initialTracks);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [bpm, setBpm] = useState(126);
  const [swing, setSwing] = useState(0.16);
  const [density, setDensity] = useState(62);
  const [scene, setScene] = useState("Nebula Breaks");
  const [macros, setMacros] = useState<Macro>({ bloom: 72, gravity: 44, shimmer: 63, fracture: 28 });
  const voicesRef = useRef<VoiceBundle | null>(null);
  const chainRef = useRef<MasterChain | null>(null);
  const sendsRef = useRef<Sends | null>(null);
  const tracksRef = useRef(tracks);
  const macrosRef = useRef(macros);
  const stepRef = useRef(step);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { macrosRef.current = macros; }, [macros]);
  useEffect(() => { stepRef.current = step; }, [step]);

  const ensureAudio = useCallback(async () => {
    await Tone.start();
    if (chainRef.current) return;

    const filter = new Tone.Filter({ type: "lowpass", frequency: 18000, Q: 0.6 });
    const distortion = new Tone.Distortion({ distortion: 0, wet: 0 });
    const compressor = new Tone.Compressor({
      threshold: -16, ratio: 3.6, attack: 0.005, release: 0.12, knee: 6,
    });
    const limiter = new Tone.Limiter(-1);
    const reverb = new Tone.Reverb({ decay: 4.5, wet: 1, preDelay: 0.02 });

    filter.chain(distortion, compressor, limiter, Tone.getDestination());
    reverb.connect(compressor);

    const sends: Sends = {};
    Object.entries(REVERB_SEND_BASE).forEach(([id, base]) => {
      sends[id] = new Tone.Gain(base).connect(reverb);
    });

    const fan = (id: string): Tone.InputNode[] => [filter, sends[id]];

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.45, sustain: 0.005, release: 0.6 },
      volume: -2,
    });
    kick.fan(...fan("pulse"));

    const kickClickHpf = new Tone.Filter({ type: "highpass", frequency: 1800 });
    kickClickHpf.fan(...fan("pulse"));
    const kickClick = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.014, sustain: 0 },
      volume: -22,
    }).connect(kickClickHpf);

    const snareBpf = new Tone.Filter({ type: "bandpass", frequency: 2400, Q: 1.4 });
    snareBpf.fan(...fan("glass"));
    const snareNoise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
      volume: -10,
    }).connect(snareBpf);
    const snareBody = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.05 },
      volume: -16,
    });
    snareBody.fan(...fan("glass"));

    const hatHpf = new Tone.Filter({ type: "highpass", frequency: 6000 });
    hatHpf.fan(...fan("dust"));
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 },
      harmonicity: 5.1,
      modulationIndex: 28,
      resonance: 6800,
      octaves: 1.4,
      volume: -22,
    });
    hat.connect(hatHpf);

    const bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.005, decay: 0.22, sustain: 0.35, release: 0.35 },
      filterEnvelope: {
        attack: 0.005, decay: 0.18, sustain: 0.3, release: 0.25,
        baseFrequency: 80, octaves: 2.6, exponent: 2,
      },
      filter: { Q: 1.6, type: "lowpass", rolloff: -24 },
      portamento: 0.015,
      volume: -6,
    });
    bass.fan(...fan("sub"));
    const bassSub = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.5, sustain: 0.4, release: 0.4 },
      volume: -10,
    });
    bassSub.fan(...fan("sub"));

    const pluck = new Tone.PluckSynth({
      attackNoise: 0.7,
      dampening: 4200,
      resonance: 0.92,
      release: 0.6,
      volume: -3,
    });
    pluck.fan(...fan("keys"));

    const padFilter = new Tone.Filter({ type: "lowpass", frequency: 3200, Q: 0.6 });
    const padChorus = new Tone.Chorus({ frequency: 0.55, depth: 0.7, wet: 0.55 }).start();
    padFilter.connect(padChorus);
    padChorus.fan(...fan("aura"));
    const pad = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      oscillator: { type: "fatsawtooth" },
      envelope: { attack: 0.85, decay: 0.4, sustain: 0.7, release: 1.8 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.6, decay: 0.5, sustain: 0.5, release: 0.8 },
      volume: -16,
    });
    pad.maxPolyphony = 6;
    pad.connect(padFilter);

    chainRef.current = { filter, distortion, reverb, compressor, limiter };
    sendsRef.current = sends;
    voicesRef.current = { kick, kickClick, snareNoise, snareBody, hat, bass, bassSub, pluck, pad };

    const m = macrosRef.current;
    filter.frequency.value = 200 * Math.pow(90, m.bloom / 100);
    distortion.distortion = (m.fracture / 100) * 0.55;
    distortion.wet.value = (m.fracture / 100) * 0.6;
    Object.entries(sends).forEach(([id, gain]) => {
      const base = REVERB_SEND_BASE[id] ?? 0.1;
      gain.gain.value = base * ((m.shimmer / 100) * 1.4);
    });
  }, []);

  const triggerVoice = useCallback((track: Track, time: number, index: number) => {
    const voices = voicesRef.current;
    if (!voices) return;

    const macro = macrosRef.current;
    const transposeOffset = Math.round(macro.gravity / 14);
    const semis = scale[(index + transposeOffset) % scale.length];
    const velocity = clamp(track.level, 0.05, 1);

    switch (track.voice) {
      case "kick":
        voices.kick.triggerAttackRelease("C1", "8n", time, velocity);
        voices.kickClick.triggerAttackRelease("32n", time, velocity * 0.6);
        return;
      case "snare":
        voices.snareNoise.triggerAttackRelease("8n", time, velocity);
        voices.snareBody.triggerAttackRelease("G2", "32n", time, velocity * 0.55);
        return;
      case "hat":
        voices.hat.triggerAttackRelease("C6", "32n", time, velocity * 0.7);
        return;
      case "bass": {
        const note = Tone.Frequency("A1").transpose(semis).toNote();
        voices.bass.triggerAttackRelease(note, "8n", time, velocity);
        voices.bassSub.triggerAttackRelease(note, "8n", time, velocity * 0.7);
        return;
      }
      case "pluck": {
        const note = Tone.Frequency("E4").transpose(semis).toNote();
        voices.pluck.triggerAttackRelease(note, "16n", time, velocity);
        return;
      }
      case "pad": {
        const root = Tone.Frequency("A3").transpose(semis).toNote();
        const third = Tone.Frequency("C4").transpose(semis).toNote();
        const fifth = Tone.Frequency("E4").transpose(semis).toNote();
        voices.pad.triggerAttackRelease([root, third, fifth], "2n", time, velocity);
        return;
      }
    }
  }, []);

  const pulse = useCallback((nextStep: number, time: number) => {
    if (!voicesRef.current) return;
    tracksRef.current.forEach((track, index) => {
      if (track.pattern[nextStep]) triggerVoice(track, time, index + nextStep);
    });
  }, [triggerVoice]);

  useEffect(() => {
    const chain = chainRef.current;
    if (!chain) return;
    chain.filter.frequency.rampTo(200 * Math.pow(90, macros.bloom / 100), 0.05);
  }, [macros.bloom]);

  useEffect(() => {
    const sends = sendsRef.current;
    if (!sends) return;
    const factor = (macros.shimmer / 100) * 1.4;
    Object.entries(sends).forEach(([id, gain]) => {
      const base = REVERB_SEND_BASE[id] ?? 0.1;
      gain.gain.rampTo(base * factor, 0.05);
    });
  }, [macros.shimmer]);

  useEffect(() => {
    const chain = chainRef.current;
    if (!chain) return;
    chain.distortion.distortion = (macros.fracture / 100) * 0.55;
    chain.distortion.wet.rampTo((macros.fracture / 100) * 0.6, 0.05);
  }, [macros.fracture]);

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    const transport = Tone.getTransport();
    transport.swing = swing;
    transport.swingSubdivision = "16n";
  }, [swing]);

  useEffect(() => {
    if (!playing) return;
    const transport = Tone.getTransport();
    let cursor = stepRef.current;
    const id = transport.scheduleRepeat((time) => {
      const current = cursor;
      pulse(current, time);
      Tone.getDraw().schedule(() => setStep(current), time);
      cursor = (current + 1) % STEPS;
    }, "16n");
    transport.start();
    return () => {
      transport.clear(id);
      transport.stop();
    };
  }, [playing, pulse]);

  const launch = async () => {
    await ensureAudio();
    setPlaying((value) => !value);
  };

  const regenerate = () => {
    const names = ["Nebula Breaks", "Quantum Bounce", "Chrome Ritual", "Zero-G Garage", "Solar Drill", "Dream Collider"];
    setScene(names[Math.floor(Math.random() * names.length)]);
    setTracks((current) => current.map((track) => ({ ...track, pattern: makePattern(track, density, macros.gravity) })));
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

  const toggleStep = (trackIndex: number, stepIndex: number) => {
    setTracks((current) =>
      current.map((track, index) =>
        index === trackIndex
          ? { ...track, pattern: track.pattern.map((value, i) => (i === stepIndex ? !value : value)) }
          : track,
      ),
    );
  };

  const setLevel = (id: string, level: number) => {
    setTracks((current) => current.map((track) => (track.id === id ? { ...track, level } : track)));
  };

  const playheadPoint = polar(RING_RADII[0] + 16, step);
  const trail = [1, 2, 3].map((offset) => polar(RING_RADII[0] + 16, (step - offset + STEPS) % STEPS));

  return (
    <main className="cosmos">
      <header className="cosmos-head">
        <div className="brand-pod">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="brand-text">
            <span className="brand-eyebrow">stump · the · schwab</span>
            <strong className="brand-title">MUSIC OS</strong>
            <span className="brand-version">v.001 — radial studio</span>
          </div>
        </div>
        <div className="head-readouts">
          <div className="readout">
            <span>scene</span>
            <strong>{scene}</strong>
          </div>
          <div className="readout">
            <span>tempo</span>
            <strong>{bpm}<em>bpm</em></strong>
          </div>
          <div className="readout">
            <span>energy</span>
            <strong>{energy}<em>%</em></strong>
          </div>
          <div className={`readout pill ${playing ? "live" : ""}`}>
            <span className="dot" />
            <strong>{playing ? "live" : "armed"}</strong>
          </div>
        </div>
      </header>

      <section className="cosmos-stage">
        <aside className="rack rack-left">
          <p className="rack-tag">channels / 06</p>
          <div className="strip-stack">
            {tracks.map((track) => {
              const firing = playing && step !== null && track.pattern[step];
              return (
                <div
                  key={track.id}
                  className={`strip ${firing ? "is-firing" : ""}`}
                  style={{ "--strip-hue": track.hue } as React.CSSProperties}
                >
                  <div className="strip-head">
                    <span className="strip-glyph">{track.glyph}</span>
                    <div className="strip-id">
                      <strong>{track.name}</strong>
                      <span>{track.voice}</span>
                    </div>
                    <span className="strip-led" />
                  </div>
                  <div className="strip-fader">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.level}
                      onChange={(event) => setLevel(track.id, Number(event.target.value))}
                    />
                    <span className="strip-level">{Math.round(track.level * 100)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="orb">
          <div className="orb-frame">
            <svg className="orb-svg" viewBox={`0 0 ${ORB_VIEW} ${ORB_VIEW}`} role="img" aria-label="Radial sequencer">
              <defs>
                <radialGradient id="orb-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(139,92,246,0.55)" />
                  <stop offset="60%" stopColor="rgba(34,211,238,0.18)" />
                  <stop offset="100%" stopColor="rgba(2,6,23,0)" />
                </radialGradient>
                <linearGradient id="playhead" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.95)" />
                </linearGradient>
              </defs>

              <circle cx={ORB_CENTER} cy={ORB_CENTER} r="320" className="orb-halo" fill="url(#orb-core)" />

              {RING_RADII.map((radius, ringIndex) => (
                <circle
                  key={`guide-${ringIndex}`}
                  cx={ORB_CENTER}
                  cy={ORB_CENTER}
                  r={radius}
                  className="ring-guide"
                  style={{ stroke: `hsla(${tracks[ringIndex].hue}, 70%, 60%, 0.18)` }}
                />
              ))}

              {Array.from({ length: STEPS }, (_, i) => {
                const downbeat = i % 4 === 0;
                const inner = polar(RING_RADII[RING_RADII.length - 1] - 18, i);
                const outer = polar(RING_RADII[0] + 8, i);
                return (
                  <line
                    key={`spoke-${i}`}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    className={`spoke ${downbeat ? "spoke-major" : ""}`}
                  />
                );
              })}

              {trail.map((point, idx) => (
                <line
                  key={`trail-${idx}`}
                  x1={ORB_CENTER}
                  y1={ORB_CENTER}
                  x2={point.x}
                  y2={point.y}
                  className="playhead-trail"
                  style={{ opacity: (3 - idx) / 8 }}
                />
              ))}

              <line
                x1={ORB_CENTER}
                y1={ORB_CENTER}
                x2={playheadPoint.x}
                y2={playheadPoint.y}
                className={`playhead ${playing ? "spinning" : ""}`}
                stroke="url(#playhead)"
              />
              <circle cx={playheadPoint.x} cy={playheadPoint.y} r="6" className="playhead-tip" />

              {tracks.map((track, trackIndex) =>
                track.pattern.map((active, stepIndex) => {
                  const point = polar(RING_RADII[trackIndex], stepIndex);
                  const isCurrent = stepIndex === step;
                  const firing = isCurrent && active;
                  return (
                    <g key={`${track.id}-${stepIndex}`} className={`step-node ${active ? "is-on" : ""} ${isCurrent ? "is-current" : ""} ${firing ? "is-firing" : ""}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={STEP_RADIUS + 6}
                        className="step-halo"
                        style={{ fill: `hsla(${track.hue}, 90%, 62%, 0.22)` }}
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={STEP_RADIUS}
                        className="step-cell"
                        style={{
                          fill: active ? `hsl(${track.hue}, 88%, 62%)` : "rgba(255,255,255,0.05)",
                          stroke: active
                            ? `hsla(${track.hue}, 92%, 78%, 0.85)`
                            : `hsla(${track.hue}, 70%, 60%, 0.35)`,
                        }}
                        onClick={() => toggleStep(trackIndex, stepIndex)}
                      />
                    </g>
                  );
                }),
              )}

              {Array.from({ length: STEPS }, (_, i) => {
                const point = polar(RING_RADII[0] + 30, i);
                return (
                  <text
                    key={`num-${i}`}
                    x={point.x}
                    y={point.y}
                    className={`step-number ${i % 4 === 0 ? "step-number-major" : ""}`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </text>
                );
              })}
            </svg>

            <div className="orb-core-text">
              <span>energy</span>
              <strong>{energy}<em>%</em></strong>
              <span className="orb-step">step {String(step + 1).padStart(2, "0")} / 16</span>
            </div>
          </div>
        </div>

        <aside className="rack rack-right">
          <p className="rack-tag">macro / sound design</p>
          <div className="rotary-grid">
            <Rotary label="bloom" hue={270} value={macros.bloom} min={0} max={100}
              onChange={(v) => setMacros((m) => ({ ...m, bloom: v }))} />
            <Rotary label="gravity" hue={154} value={macros.gravity} min={0} max={100}
              onChange={(v) => setMacros((m) => ({ ...m, gravity: v }))} />
            <Rotary label="shimmer" hue={190} value={macros.shimmer} min={0} max={100}
              onChange={(v) => setMacros((m) => ({ ...m, shimmer: v }))} />
            <Rotary label="fracture" hue={318} value={macros.fracture} min={0} max={100}
              onChange={(v) => setMacros((m) => ({ ...m, fracture: v }))} />
          </div>
          <div className="vis-card">
            <p>spectrum</p>
            <div className="vis-bars">
              {tracks.map((track, index) => (
                <span
                  key={track.id}
                  style={{
                    "--track-hue": track.hue,
                    "--height": `${20 + track.pattern.filter(Boolean).length * 5 + (track.level * 24)}%`,
                    animationDelay: `${index * 110}ms`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
          <div className="manifesto">
            <span>directive</span>
            <p>Make the session feel alive before the first plugin loads.</p>
          </div>
        </aside>
      </section>

      <footer className="dock">
        <button
          className={`dock-play ${playing ? "is-playing" : ""}`}
          onClick={launch}
          aria-label={playing ? "Pause engine" : "Start engine"}
        >
          <span className="dock-play-icon">{playing ? "❚❚" : "▶"}</span>
          <span className="dock-play-label">{playing ? "pause" : "ignite"}</span>
        </button>

        <div className="dock-slider">
          <span>tempo</span>
          <input type="range" min="72" max="178" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          <strong>{bpm}</strong>
        </div>

        <div className="dock-slider">
          <span>swing</span>
          <input type="range" min="0" max="0.6" step="0.01" value={swing} onChange={(e) => setSwing(Number(e.target.value))} />
          <strong>{Math.round(swing * 100)}%</strong>
        </div>

        <div className="dock-slider">
          <span>density</span>
          <input type="range" min="12" max="96" value={density} onChange={(e) => setDensity(Number(e.target.value))} />
          <strong>{density}%</strong>
        </div>

        <button className="dock-action" onClick={regenerate}>
          <span>generate</span>
          <em>new world</em>
        </button>
        <button className="dock-action variant" onClick={mutate}>
          <span>fracture</span>
          <em>shift pattern</em>
        </button>
      </footer>
    </main>
  );
}
