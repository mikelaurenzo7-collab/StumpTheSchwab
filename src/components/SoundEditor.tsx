"use client";

/**
 * SoundEditor — per-track synth parameter customization.
 *
 * Exposes the underlying Tone.js synth params (oscillator, envelopes, filter,
 * harmonicity, modulation index, etc.) for "extreme customization." The user
 * can also swap the synth voice type entirely. Edits flow through the engine
 * store and the audio engine hot-swap effect updates the live synth in place
 * (no clicks where possible).
 */

import { useCallback, useMemo } from "react";
import { useEngineStore } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";

type SynthType = TrackSound["synth"];

const SYNTH_TYPES: { value: SynthType; label: string; desc: string }[] = [
  { value: "membrane", label: "Membrane", desc: "Drum/kick — pitch sweep" },
  { value: "noise", label: "Noise", desc: "Snares, hats, claps" },
  { value: "metal", label: "Metal", desc: "Cymbals, bells" },
  { value: "synth", label: "Synth", desc: "Basic oscillator + envelope" },
  { value: "monosynth", label: "MonoSynth", desc: "Bass — filter envelope" },
  { value: "am", label: "AM", desc: "Amplitude modulation" },
  { value: "fm", label: "FM", desc: "Frequency modulation — bells, plucks" },
];

const OSC_TYPES = ["sine", "triangle", "square", "sawtooth"] as const;
const NOISE_TYPES = ["white", "pink", "brown"] as const;
const FILTER_TYPES = ["lowpass", "highpass", "bandpass"] as const;
const ROLLOFFS = [-12, -24, -48] as const;

// ── Helpers to read deeply-nested option values safely ──────────
function getNum(obj: Record<string, unknown> | undefined, path: string[], fallback: number): number {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur && typeof cur === "object" && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k];
    } else return fallback;
  }
  return typeof cur === "number" ? cur : fallback;
}
function getStr(obj: Record<string, unknown> | undefined, path: string[], fallback: string): string {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur && typeof cur === "object" && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k];
    } else return fallback;
  }
  return typeof cur === "string" ? cur : fallback;
}

// ── Knob (range input) ──────────────────────────────────────────
function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border bg-background-2 px-2 py-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <span className="text-[10px] font-mono text-soft">
        {format ? format(value) : value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0)}
      </span>
    </div>
  );
}

function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[] | { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const opts = options.map((o) =>
    typeof o === "object" && o !== null && "value" in o ? o : { value: o, label: String(o) }
  );
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <select
        className="control-select rounded-lg px-2 py-1 text-[11px]"
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          // Restore numeric options to numbers
          const num = Number(raw);
          onChange((Number.isFinite(num) && options.some((o) => (typeof o === "object" ? o.value === num : o === num)) ? num : raw) as T);
        }}
      >
        {opts.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Sub-panels per voice type ───────────────────────────────────
type Patch = (partial: Record<string, unknown>) => void;

function EnvelopeSection({ options, patch, prefix = "envelope" }: {
  options: Record<string, unknown>;
  patch: Patch;
  prefix?: "envelope" | "modulationEnvelope" | "filterEnvelope";
}) {
  const env = (options[prefix] as Record<string, unknown> | undefined) ?? {};
  const setEnv = (k: string, v: unknown) => patch({ [prefix]: { ...env, [k]: v } });
  return (
    <div className="rounded-xl border border-border bg-background-2 p-2">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-cyan">
        {prefix === "envelope" ? "Amp Envelope" : prefix === "modulationEnvelope" ? "Mod Envelope" : "Filter Envelope"}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <Knob label="Attack" value={getNum(options, [prefix, "attack"], 0.01)} min={0.001} max={2} step={0.001} onChange={(v) => setEnv("attack", v)} format={(v) => `${(v * 1000).toFixed(0)}ms`} />
        <Knob label="Decay" value={getNum(options, [prefix, "decay"], 0.2)} min={0.001} max={3} step={0.001} onChange={(v) => setEnv("decay", v)} format={(v) => `${(v * 1000).toFixed(0)}ms`} />
        <Knob label="Sustain" value={getNum(options, [prefix, "sustain"], 0)} min={0} max={1} step={0.01} onChange={(v) => setEnv("sustain", v)} format={(v) => `${(v * 100).toFixed(0)}%`} />
        <Knob label="Release" value={getNum(options, [prefix, "release"], 0.2)} min={0.001} max={4} step={0.001} onChange={(v) => setEnv("release", v)} format={(v) => `${(v * 1000).toFixed(0)}ms`} />
      </div>
      {prefix === "filterEnvelope" && (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <Knob label="Base Freq" value={getNum(options, [prefix, "baseFrequency"], 200)} min={20} max={4000} step={1} onChange={(v) => setEnv("baseFrequency", v)} format={(v) => `${v.toFixed(0)}Hz`} />
          <Knob label="Octaves" value={getNum(options, [prefix, "octaves"], 2)} min={0} max={6} step={0.1} onChange={(v) => setEnv("octaves", v)} format={(v) => `${v.toFixed(1)}`} />
        </div>
      )}
    </div>
  );
}

// ── Main editor ─────────────────────────────────────────────────
export function SoundEditor({ trackId, onClose }: { trackId: number; onClose: () => void }) {
  const track = useEngineStore((s) => s.tracks.find((t) => t.id === trackId));
  const setTrackSoundOptions = useEngineStore((s) => s.setTrackSoundOptions);
  const setTrackSynthType = useEngineStore((s) => s.setTrackSynthType);
  const resetTrackSound = useEngineStore((s) => s.resetTrackSound);

  const sound = track?.sound;
  const options = useMemo(() => (sound?.options as Record<string, unknown> | undefined) ?? {}, [sound]);

  const patch: Patch = useCallback(
    (partial) => setTrackSoundOptions(trackId, partial),
    [trackId, setTrackSoundOptions]
  );

  if (!track || !sound) return null;

  const synth: SynthType = sound.synth;
  const oscType = getStr(options, ["oscillator", "type"], "sine");
  const noiseType = getStr(options, ["noise", "type"], "white");
  const modType = getStr(options, ["modulation", "type"], "sine");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel-soft relative max-h-[90vh] w-[min(720px,95vw)] overflow-y-auto rounded-xl border border-border bg-surface-2 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: sound.color }} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan">Sound Editor</p>
              <h2 className="text-lg font-bold tracking-tight text-white">{sound.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => resetTrackSound(trackId)}
              className="button-secondary rounded-lg px-3 py-1.5 text-[10px] font-bold"
              title="Restore default sound for this track"
            >
              RESET
            </button>
            <button
              onClick={onClose}
              className="button-secondary rounded-lg px-3 py-1.5 text-[12px] font-bold"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Voice swap */}
        <div className="mb-4 rounded-xl border border-border bg-background-2 p-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">Voice</div>
          <div className="grid grid-cols-4 gap-1.5">
            {SYNTH_TYPES.map((s) => (
              <button
                key={s.value}
                onClick={() => setTrackSynthType(trackId, s.value)}
                className={`rounded-lg px-2 py-2 text-[10px] font-bold transition-colors ${
                  synth === s.value ? "bg-accent text-white" : "button-secondary"
                }`}
                title={s.desc}
              >
                {s.label}
              </button>
            ))}
          </div>
          {synth === "mic" && (
            <p className="mt-2 text-[10px] text-muted">Mic input is live — no synth params to edit.</p>
          )}
        </div>

        {/* Voice-specific controls */}
        {synth !== "mic" && (
          <div className="flex flex-col gap-3">
            {/* Oscillator / source */}
            {(synth === "synth" || synth === "monosynth" || synth === "membrane") && (
              <div className="rounded-xl border border-border bg-background-2 p-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">Oscillator</div>
                <Select
                  label="Type"
                  value={oscType}
                  options={OSC_TYPES}
                  onChange={(v) => patch({ oscillator: { type: v } })}
                />
              </div>
            )}

            {synth === "noise" && (
              <div className="rounded-xl border border-border bg-background-2 p-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">Noise Source</div>
                <Select
                  label="Color"
                  value={noiseType}
                  options={NOISE_TYPES}
                  onChange={(v) => patch({ noise: { type: v } })}
                />
              </div>
            )}

            {/* Membrane-specific: pitch decay + octaves */}
            {synth === "membrane" && (
              <div className="rounded-xl border border-border bg-background-2 p-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">Pitch Sweep</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Knob label="Pitch Decay" value={getNum(options, ["pitchDecay"], 0.05)} min={0.001} max={0.5} step={0.001} onChange={(v) => patch({ pitchDecay: v })} format={(v) => `${(v * 1000).toFixed(0)}ms`} />
                  <Knob label="Octaves" value={getNum(options, ["octaves"], 4)} min={0.5} max={10} step={0.1} onChange={(v) => patch({ octaves: v })} format={(v) => v.toFixed(1)} />
                </div>
              </div>
            )}

            {/* Metal-specific: frequency, harmonicity, mod index, resonance, octaves */}
            {synth === "metal" && (
              <div className="rounded-xl border border-border bg-background-2 p-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">Metal Voice</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Knob label="Frequency" value={getNum(options, ["frequency"], 200)} min={20} max={1000} step={1} onChange={(v) => patch({ frequency: v })} format={(v) => `${v.toFixed(0)}Hz`} />
                  <Knob label="Harmonicity" value={getNum(options, ["harmonicity"], 5.1)} min={0.1} max={10} step={0.1} onChange={(v) => patch({ harmonicity: v })} format={(v) => v.toFixed(1)} />
                  <Knob label="Mod Index" value={getNum(options, ["modulationIndex"], 32)} min={1} max={100} step={1} onChange={(v) => patch({ modulationIndex: v })} format={(v) => v.toFixed(0)} />
                  <Knob label="Resonance" value={getNum(options, ["resonance"], 4000)} min={500} max={10000} step={100} onChange={(v) => patch({ resonance: v })} format={(v) => `${(v / 1000).toFixed(1)}k`} />
                  <Knob label="Octaves" value={getNum(options, ["octaves"], 1.5)} min={0.5} max={4} step={0.1} onChange={(v) => patch({ octaves: v })} format={(v) => v.toFixed(1)} />
                </div>
              </div>
            )}

            {/* AM/FM: harmonicity + modulation index */}
            {(synth === "am" || synth === "fm") && (
              <div className="rounded-xl border border-border bg-background-2 p-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">{synth === "fm" ? "FM" : "AM"} Modulation</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Knob label="Harmonicity" value={getNum(options, ["harmonicity"], 3)} min={0.1} max={12} step={0.1} onChange={(v) => patch({ harmonicity: v })} format={(v) => v.toFixed(2)} />
                  <Knob label="Mod Index" value={getNum(options, ["modulationIndex"], 10)} min={0} max={50} step={0.5} onChange={(v) => patch({ modulationIndex: v })} format={(v) => v.toFixed(1)} />
                  <Select label="Mod Type" value={modType} options={OSC_TYPES} onChange={(v) => patch({ modulation: { type: v } })} />
                </div>
              </div>
            )}

            {/* MonoSynth filter */}
            {synth === "monosynth" && (
              <div className="rounded-xl border border-border bg-background-2 p-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">Filter</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Select label="Type" value={getStr(options, ["filter", "type"], "lowpass")} options={FILTER_TYPES} onChange={(v) => patch({ filter: { ...((options.filter as Record<string, unknown>) ?? {}), type: v } })} />
                  <Knob label="Q" value={getNum(options, ["filter", "Q"], 1)} min={0} max={20} step={0.1} onChange={(v) => patch({ filter: { ...((options.filter as Record<string, unknown>) ?? {}), Q: v } })} format={(v) => v.toFixed(1)} />
                  <Select label="Rolloff" value={getNum(options, ["filter", "rolloff"], -12)} options={ROLLOFFS.map((r) => ({ value: r, label: `${r} dB/oct` }))} onChange={(v) => patch({ filter: { ...((options.filter as Record<string, unknown>) ?? {}), rolloff: v } })} />
                </div>
              </div>
            )}

            {/* Amp envelope — every voice has one */}
            <EnvelopeSection options={options} patch={patch} prefix="envelope" />

            {/* Mod envelope — AM/FM only */}
            {(synth === "am" || synth === "fm") && (
              <EnvelopeSection options={options} patch={patch} prefix="modulationEnvelope" />
            )}

            {/* Filter envelope — MonoSynth only */}
            {synth === "monosynth" && (
              <EnvelopeSection options={options} patch={patch} prefix="filterEnvelope" />
            )}
          </div>
        )}

        <p className="mt-4 text-[10px] text-muted">
          Edits apply live. Voice swaps rebuild the synth (brief click possible).
          Use RESET to restore the default kit sound for this track.
        </p>
      </div>
    </div>
  );
}
