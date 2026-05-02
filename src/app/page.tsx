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
  const audioRef = useRef<AudioContext | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const feedbackRef = useRef<GainNode | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const tracksRef = useRef(tracks);
  const macrosRef = useRef(macros);
  const stepRef = useRef(step);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { macrosRef.current = macros; }, [macros]);
  useEffect(() => { stepRef.current = step; }, [step]);

  const ensureAudio = useCallback(async () => {
    await Tone.start();

    if (!masterRef.current) {
      const ctx = Tone.getContext().rawContext as unknown as AudioContext;
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

  const pulse = useCallback((nextStep: number, time: number) => {
    if (!audioRef.current) return;
    tracksRef.current.forEach((track, index) => {
      if (track.pattern[nextStep]) triggerVoice(track, time, index + nextStep);
    });
  }, [triggerVoice]);

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
