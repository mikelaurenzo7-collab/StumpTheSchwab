"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/ui";
import type { MidiStatus } from "@/lib/useMidi";

interface MidiPanelProps {
  status: MidiStatus;
  onEnable: () => void | Promise<void>;
}

/**
 * Floating MIDI status panel — shown when `midiOpen` is true (Cmd/Ctrl+M).
 * Lists connected inputs, last received message, and the fixed mapping table.
 */
export function MidiPanel({ status, onEnable }: MidiPanelProps) {
  const open = useUiStore((s) => s.midiOpen);
  const setOpen = useUiStore((s) => s.setMidiOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="MIDI"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
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
            onClick={() => setOpen(false)}
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

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              Mapping
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
