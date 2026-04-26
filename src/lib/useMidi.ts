"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEngineStore, MAX_PATTERNS } from "@/store/engine";
import { useUiStore } from "@/store/ui";

/**
 * Web MIDI input layer. Subscribes to all MIDI inputs as they appear/disappear
 * and forwards messages to the rest of the app:
 *
 *   • Note On (channel 10 / GM drum convention or any channel) → trigger track
 *     based on note number mod 8 → tracks 0..7. Velocity carries through.
 *   • Note On with note >= 24 and < 32 (low octave) → switch to pattern A..H.
 *   • CC#1 (mod wheel) → BPM (mapped 60..180).
 *   • CC#7 (channel volume) → master volume.
 *   • CC#64 (sustain) → toggle play/pause on press.
 *
 * Web MIDI requires a secure context. If unavailable (Safari without flag,
 * insecure context, or user denied), we degrade silently and surface that
 * via the `available` flag for the UI.
 */
export interface MidiStatus {
  supported: boolean;
  enabled: boolean;
  inputs: { id: string; name: string }[];
  lastEvent: string | null;
}

export function useMidi(
  onInit: () => Promise<void>,
  triggerTrack: (index: number, velocity?: number) => void,
) {
  const [status, setStatus] = useState<MidiStatus>({
    supported: typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
    enabled: false,
    inputs: [],
    lastEvent: null,
  });
  const accessRef = useRef<MIDIAccess | null>(null);

  const handleMessage = useCallback(
    async (e: MIDIMessageEvent) => {
      const data = e.data;
      if (!data || data.length < 2) return;
      const status = data[0] & 0xf0;
      const d1 = data[1] ?? 0;
      const d2 = data[2] ?? 0;

      // Note On (status 0x90), velocity 0 acts like Note Off — ignore.
      if (status === 0x90 && d2 > 0) {
        await onInit();
        // Low octave (24..31) selects pattern A..H.
        if (d1 >= 24 && d1 < 24 + MAX_PATTERNS) {
          useEngineStore.getState().setCurrentPattern(d1 - 24);
          setStatus((s) => ({ ...s, lastEvent: `Pattern ${String.fromCharCode(65 + (d1 - 24))}` }));
          return;
        }
        const trackIdx = d1 % 8;
        const velocity = Math.max(0.05, Math.min(1, d2 / 127));
        triggerTrack(trackIdx, velocity);
        setStatus((s) => ({
          ...s,
          lastEvent: `Note ${d1} → trk ${trackIdx + 1} v${d2}`,
        }));
        return;
      }

      // CC (status 0xB0)
      if (status === 0xb0) {
        const eng = useEngineStore.getState();
        switch (d1) {
          case 1: {
            // Mod wheel → BPM 60..180
            const bpm = Math.round(60 + (d2 / 127) * 120);
            eng.setBpm(bpm);
            setStatus((s) => ({ ...s, lastEvent: `BPM ${bpm}` }));
            return;
          }
          case 7: {
            // Channel volume → master 0..1
            const vol = d2 / 127;
            eng.setMaster("volume", vol);
            setStatus((s) => ({ ...s, lastEvent: `Master ${vol.toFixed(2)}` }));
            return;
          }
          case 64: {
            // Sustain pedal press → toggle play/pause
            if (d2 >= 64) {
              await onInit();
              if (eng.playbackState === "playing") eng.pause();
              else eng.play();
              setStatus((s) => ({ ...s, lastEvent: "Play/Pause" }));
            }
            return;
          }
        }
      }
    },
    [onInit, triggerTrack],
  );

  const attachInputs = useCallback(
    (access: MIDIAccess) => {
      const inputs: { id: string; name: string }[] = [];
      access.inputs.forEach((input) => {
        inputs.push({ id: input.id, name: input.name ?? "Unknown MIDI device" });
        // Reattach handler each time so we don't double-bind on hot-reloads.
        input.onmidimessage = handleMessage;
      });
      setStatus((s) => ({ ...s, inputs }));
    },
    [handleMessage],
  );

  const enable = useCallback(async () => {
    if (!status.supported || accessRef.current) return;
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      attachInputs(access);
      access.onstatechange = () => attachInputs(access);
      setStatus((s) => ({ ...s, enabled: true }));
    } catch (err) {
      console.warn("MIDI access denied", err);
      setStatus((s) => ({ ...s, enabled: false }));
    }
  }, [status.supported, attachInputs]);

  // Keep handler bindings fresh — re-attach when handler identity changes.
  useEffect(() => {
    if (accessRef.current) attachInputs(accessRef.current);
  }, [attachInputs]);

  // Cmd/Ctrl+M toggles MIDI panel via ui store flag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyM" && !e.shiftKey) {
        e.preventDefault();
        useUiStore.getState().toggleMidi();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { status, enable };
}
