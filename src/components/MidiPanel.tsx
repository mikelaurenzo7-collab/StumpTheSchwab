"use client";

import { useEffect, useState } from "react";
import { useUiStore } from "@/store/ui";
import type { MidiStatus } from "@/lib/useMidi";

interface MidiPanelProps {
  status: MidiStatus;
  onEnable: () => void | Promise<void>;
}

// Learnable parameter targets exposed in the MIDI CC learn UI.
// These use the same convention as automation lane targets.
const LEARNABLE_PARAMS = [
  { target: "bpm", label: "Global BPM", min: 60, max: 180 },
  { target: "master.volume", label: "Master Volume", min: 0, max: 1 },
  { target: "track.0.volume", label: "Kick Volume", min: 0, max: 1 },
  { target: "track.0.effects.filterFreq", label: "Kick Filter", min: 100, max: 20000 },
  { target: "track.1.volume", label: "Snare Volume", min: 0, max: 1 },
  { target: "track.2.volume", label: "Hi-Hat Volume", min: 0, max: 1 },
  { target: "track.3.volume", label: "Open Hat Volume", min: 0, max: 1 },
  { target: "track.4.volume", label: "Clap Volume", min: 0, max: 1 },
  { target: "track.5.volume", label: "Tom Volume", min: 0, max: 1 },
  { target: "track.5.effects.filterFreq", label: "Tom Filter", min: 100, max: 20000 },
  { target: "track.6.volume", label: "Perc Volume", min: 0, max: 1 },
  { target: "track.7.volume", label: "Bass Volume", min: 0, max: 1 },
  { target: "track.7.effects.filterFreq", label: "Bass Filter", min: 80, max: 8000 },
  { target: "track.0.pan", label: "Kick Pan", min: -1, max: 1 },
  { target: "track.7.pan", label: "Bass Pan", min: -1, max: 1 },
];

/**
 * Floating MIDI status panel — shown when `midiOpen` is true (Cmd/Ctrl+M).
 * Lists connected inputs, last received message, the fixed mapping table,
 * and a MIDI CC learn UI to bind any CC to any engine parameter.
 */
export function MidiPanel({ status, onEnable }: MidiPanelProps) {
  const open = useUiStore((s) => s.midiOpen);
  const setOpen = useUiStore((s) => s.setMidiOpen);
  const midiCCMap = useUiStore((s) => s.midiCCMap);
  const midiLearnTarget = useUiStore((s) => s.midiLearnTarget);
  const startMidiLearn = useUiStore((s) => s.startMidiLearn);
  const cancelMidiLearn = useUiStore((s) => s.cancelMidiLearn);
  const removeMidiBinding = useUiStore((s) => s.removeMidiBinding);

  const [selectedLearnParam, setSelectedLearnParam] = useState(LEARNABLE_PARAMS[0].target);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (midiLearnTarget) { cancelMidiLearn(); return; }
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, midiLearnTarget, cancelMidiLearn]);

  if (!open) return null;

  const learnParam = LEARNABLE_PARAMS.find((p) => p.target === selectedLearnParam) ?? LEARNABLE_PARAMS[0];
  const customBindings = Object.values(midiCCMap);

  return (
    <div
      role="dialog"
      aria-label="MIDI"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) { cancelMidiLearn(); setOpen(false); }
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border-strong bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-3 py-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[13px] font-bold tracking-tight text-foreground">MIDI input</h2>
            <span className="text-[10px] font-mono text-muted">⌘M</span>
          </div>
          <button
            type="button"
            onClick={() => { cancelMidiLearn(); setOpen(false); }}
            className="text-[11px] text-muted hover:text-foreground"
          >
            close
          </button>
        </div>

        <div className="space-y-3 px-4 py-3 text-[12px]">
          {!status.supported && (
            <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-amber-200">
              Web MIDI is not available in this browser. Try Chrome or Edge over HTTPS.
            </div>
          )}

          {status.supported && !status.enabled && (
            <div className="space-y-2">
              <p className="text-soft">
                Connect a MIDI controller and click below to enable.
              </p>
              <button
                type="button"
                onClick={onEnable}
                className="button-primary rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
              >
                Enable MIDI
              </button>
            </div>
          )}

          {status.supported && status.enabled && (
            <>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                  Devices
                </div>
                <ul className="mt-1 space-y-1">
                  {status.inputs.length === 0 ? (
                    <li className="text-soft">No inputs detected.</li>
                  ) : (
                    status.inputs.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 text-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {d.name}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                  Last event
                </div>
                <div className="mt-1 font-mono text-foreground">
                  {status.lastEvent ?? "—"}
                </div>
              </div>
            </>
          )}

          {/* ── MIDI CC Learn ──────────────────────────────────────────── */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              CC Learn
            </div>

            {midiLearnTarget ? (
              <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2">
                <span className="animate-pulse h-2 w-2 rounded-full bg-accent" />
                <span className="flex-1 text-[11px] text-accent">
                  Waiting for CC… move a knob on your controller
                </span>
                <button
                  onClick={cancelMidiLearn}
                  className="text-[10px] text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={selectedLearnParam}
                  onChange={(e) => setSelectedLearnParam(e.target.value)}
                  className="flex-1 rounded border border-border bg-surface-2 px-2 py-1 text-[11px] text-foreground focus:border-accent focus:outline-none"
                >
                  {LEARNABLE_PARAMS.map((p) => (
                    <option key={p.target} value={p.target}>{p.label}</option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    startMidiLearn(learnParam.target, learnParam.label, learnParam.min, learnParam.max)
                  }
                  disabled={!status.enabled}
                  className="rounded-md bg-accent px-3 py-1 text-[10px] font-bold text-white disabled:opacity-40 hover:bg-accent/80"
                >
                  Learn
                </button>
              </div>
            )}
          </div>

          {/* ── User-defined bindings ───────────────────────────────────── */}
          {customBindings.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                Custom bindings
              </div>
              <table className="w-full text-[11px]">
                <tbody>
                  {customBindings.map((b) => (
                    <tr key={b.cc} className="border-b border-border/40 last:border-0">
                      <td className="py-1 pr-2 font-mono text-muted">CC#{b.cc}</td>
                      <td className="flex-1 py-1 text-soft">{b.label}</td>
                      <td className="py-1 text-right">
                        <button
                          onClick={() => removeMidiBinding(b.cc)}
                          className="text-[9px] text-muted hover:text-danger"
                          title="Remove binding"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              Built-in mapping
            </div>
            <table className="mt-1 w-full text-[11px] text-soft">
              <tbody className="font-mono">
                <tr>
                  <td className="py-0.5 pr-3 text-muted">Note 24–31</td>
                  <td>Switch pattern A–H</td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-3 text-muted">Note (other)</td>
                  <td>Trigger track (note % 8)</td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-3 text-muted">CC#1</td>
                  <td>BPM (60–180)</td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-3 text-muted">CC#7</td>
                  <td>Master volume</td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-3 text-muted">CC#64</td>
                  <td>Play / Pause</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
