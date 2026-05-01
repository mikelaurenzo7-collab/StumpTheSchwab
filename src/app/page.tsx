"use client";

import { useCallback, useMemo } from "react";
import { useEngine, STEPS, type Macro } from "../store/engine";
import { useAudioEngine } from "../lib/useAudioEngine";
import { useKeyboardShortcuts } from "../lib/useKeyboardShortcuts";
import { useAutoSave } from "../lib/useAutoSave";
import { triggerVoice } from "../lib/voices";
import { encodeWav } from "../lib/wavEncoder";
import { stepToTime } from "../lib/scheduler";

export default function Home() {
  const tracks = useEngine(s => s.tracks);
  const playing = useEngine(s => s.playing);
  const currentStep = useEngine(s => s.currentStep);
  const bpm = useEngine(s => s.bpm);
  const swing = useEngine(s => s.swing);
  const density = useEngine(s => s.density);
  const scene = useEngine(s => s.scene);
  const macros = useEngine(s => s.macros);
  const canUndo = useEngine(s => s.past.length > 0);
  const canRedo = useEngine(s => s.future.length > 0);

  const toggleStep = useEngine(s => s.toggleStep);
  const setTrackLevel = useEngine(s => s.setTrackLevel);
  const setTrackMuted = useEngine(s => s.setTrackMuted);
  const setBpm = useEngine(s => s.setBpm);
  const setSwing = useEngine(s => s.setSwing);
  const setDensity = useEngine(s => s.setDensity);
  const setMacro = useEngine(s => s.setMacro);
  const regenerate = useEngine(s => s.regenerate);
  const mutate = useEngine(s => s.mutate);
  const undo = useEngine(s => s.undo);
  const redo = useEngine(s => s.redo);
  const pushUndo = useEngine(s => s.pushUndo);

  const { toggle } = useAudioEngine();
  useAutoSave();

  const exportWav = useCallback(async () => {
    const state = useEngine.getState();
    const loops = 4;
    const totalSteps = STEPS * loops;
    const duration = stepToTime(totalSteps, state.bpm, state.swing) + 2;

    const offline = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100);

    const limiter = offline.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    limiter.connect(offline.destination);

    const master = offline.createGain();
    master.gain.value = 0.78;
    master.connect(limiter);

    const delay = offline.createDelay(1.2);
    delay.delayTime.value = 0.18;
    const feedback = offline.createGain();
    feedback.gain.value = 0.28;
    const filter = offline.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 5400;
    delay.connect(feedback);
    feedback.connect(filter);
    filter.connect(delay);
    delay.connect(master);

    for (let loop = 0; loop < loops; loop++) {
      for (let step = 0; step < STEPS; step++) {
        const globalStep = loop * STEPS + step;
        const time = stepToTime(globalStep, state.bpm, state.swing);
        state.tracks.forEach(track => {
          if (track.pattern[step] && !track.muted) {
            triggerVoice(offline, master, delay, track, state.macros, step, time);
          }
        });
      }
    }

    const buffer = await offline.startRendering();
    const blob = encodeWav(buffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.scene.toLowerCase().replace(/\s+/g, "-")}-${state.bpm}bpm.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  useKeyboardShortcuts(toggle, exportWav);

  const energy = useMemo(() => {
    const active = tracks.reduce((sum, t) => sum + t.pattern.filter(Boolean).length * t.level, 0);
    return Math.round((active / (tracks.length * STEPS)) * 100);
  }, [tracks]);

  return (
    <main className="studio-shell">
      <section className="hero-panel">
        <div className="brand-block">
          <div className="orbital-mark" aria-hidden="true"><span /></div>
          <div>
            <p className="eyebrow">StumpTheSchwab</p>
            <h1>Future studio for beats, sound design, and impossible textures.</h1>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary-action" onClick={toggle}>
            {playing ? "Pause engine" : "Start engine"}
          </button>
          <button className="ghost-action" onClick={regenerate}>Generate world</button>
          <button className="ghost-action" onClick={mutate}>Fracture pattern</button>
          <button className="ghost-action export-action" onClick={exportWav}>Export WAV</button>
        </div>
      </section>

      <section className="command-strip" aria-label="Session controls">
        <div>
          <span>Scene</span>
          <strong>{scene}</strong>
        </div>
        <label>
          <span>BPM</span>
          <input type="range" min="72" max="178" value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            onPointerDown={pushUndo}
          />
          <strong>{bpm}</strong>
        </label>
        <label>
          <span>Swing</span>
          <input type="range" min="0" max="100" value={swing}
            onChange={e => setSwing(Number(e.target.value))}
            onPointerDown={pushUndo}
          />
          <strong>{swing}%</strong>
        </label>
        <label>
          <span>Density</span>
          <input type="range" min="12" max="96" value={density}
            onChange={e => setDensity(Number(e.target.value))}
            onPointerDown={pushUndo}
          />
          <strong>{density}%</strong>
        </label>
        <div>
          <span>Energy</span>
          <strong>{energy}%</strong>
        </div>
        <div className="undo-controls">
          <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">&#x21a9;</button>
          <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">&#x21aa;</button>
        </div>
      </section>

      <section className="studio-grid">
        <div className="sequencer-card">
          <div className="section-heading">
            <p>Neural sequencer</p>
            <h2>Six engines, sixteen moments.</h2>
          </div>
          <div className="step-numbers" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className={currentStep === i ? "is-current-num" : ""}>{i + 1}</span>
            ))}
          </div>
          <div className="tracks">
            {tracks.map((track, trackIndex) => (
              <div
                className={`track-row${track.muted ? " is-muted" : ""}`}
                key={track.id}
                style={{ "--track-hue": track.hue } as React.CSSProperties}
              >
                <div className="track-meta">
                  <div className="track-meta-top">
                    <strong>{track.name}</strong>
                    <button
                      className={`mute-btn${track.muted ? " is-muted" : ""}`}
                      onClick={() => setTrackMuted(track.id, !track.muted)}
                      title={`${track.muted ? "Unmute" : "Mute"} (${trackIndex + 1})`}
                    >M</button>
                  </div>
                  <span>{track.voice}</span>
                </div>
                <div className="step-grid">
                  {track.pattern.map((active, index) => (
                    <button
                      aria-label={`${track.name} step ${index + 1}`}
                      className={`step-cell${active ? " is-active" : ""}${currentStep === index ? " is-current" : ""}`}
                      key={`${track.id}-${index}`}
                      onClick={() => toggleStep(trackIndex, index)}
                    />
                  ))}
                </div>
                <label className="mini-fader">
                  <span>Level</span>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={track.level}
                    onChange={e => setTrackLevel(track.id, Number(e.target.value))}
                    onPointerDown={pushUndo}
                  />
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
          {(Object.keys(macros) as Array<keyof Macro>).map(key => (
            <label className="macro" key={key}>
              <span>{key}</span>
              <input type="range" min="0" max="100" value={macros[key]}
                onChange={e => setMacro(key, Number(e.target.value))}
                onPointerDown={pushUndo}
              />
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
            <p>Keyboard shortcuts</p>
            <span>
              Space &mdash; play/pause &nbsp;&middot;&nbsp; R &mdash; regenerate &nbsp;&middot;&nbsp; F &mdash; fracture<br />
              &uarr;&darr; &mdash; BPM &nbsp;&middot;&nbsp; 1-6 &mdash; mute tracks &nbsp;&middot;&nbsp; Ctrl+Z/Y &mdash; undo/redo<br />
              Ctrl+E &mdash; export WAV
            </span>
          </div>
        </aside>
      </section>
    </main>
  );
}
