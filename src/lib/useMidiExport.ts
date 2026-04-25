"use client";

import { useCallback, useState } from "react";
import { useEngineStore, type Track } from "@/store/engine";

// Standard MIDI ppq resolution. 480 is the most common in DAWs and lets us
// represent both 16-step (each step = 120 ticks) and 32-step (60 ticks)
// patterns exactly.
const PPQ = 480;

// General MIDI drum kit mapping (channel 10 / zero-indexed 9). For melodic
// tracks (tom, perc, bass) we use the per-step pitch from track.notes; for
// non-melodic drum tracks we use these fixed GM keys so the export sounds
// like its source kit when loaded into a sampler/DAW.
const DRUM_GM_NOTE: Record<string, number> = {
  Kick: 36,       // C1 — Bass Drum 1
  Snare: 38,      // D1 — Acoustic Snare
  "Hi-Hat": 42,   // F#1 — Closed Hi-Hat
  "Open Hat": 46, // A#1 — Open Hi-Hat
  Clap: 39,       // D#1 — Hand Clap
  Tom: 45,        // A1 — Low Tom (used only as fallback if a tom step has no note)
  Perc: 60,       // C3 — Generic perc fallback
  Bass: 36,       // Bass fallback (won't normally be used; bass is melodic)
};

// ── Variable-length quantity (MIDI delta-time encoding) ──────
function writeVLQ(value: number): number[] {
  if (value < 0) value = 0;
  const buffer: number[] = [];
  let v = value & 0x0fffffff;
  buffer.unshift(v & 0x7f);
  v >>= 7;
  while (v > 0) {
    buffer.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return buffer;
}

function writeUInt32BE(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function writeUInt16BE(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

function asciiBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
}

// ── Note name (e.g., "C2", "F#3", "Eb1") → MIDI note number ──
function parseNoteName(name: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const accidental = m[2];
  const octave = parseInt(m[3], 10);
  const semitones: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let n = semitones[letter];
  if (accidental === "#") n += 1;
  else if (accidental === "b") n -= 1;
  // Tone.js / scientific pitch notation: C4 = MIDI 60 → midi = 12 + 12*octave + n
  // (C-1 = 0, C0 = 12, C4 = 60)
  const midi = 12 + 12 * octave + n;
  if (midi < 0 || midi > 127) return null;
  return midi;
}

// ── Encode a single track as a MIDI MTrk chunk ───────────────
interface NoteEvent {
  tick: number;
  type: "on" | "off";
  channel: number;
  note: number;
  velocity: number;
}

function encodeTrackChunk(
  events: NoteEvent[],
  trackName: string,
  isFirstTrack: boolean,
  bpm: number,
): Uint8Array {
  const data: number[] = [];

  // Track name meta event (FF 03 len text)
  const nameBytes = asciiBytes(trackName);
  data.push(0x00, 0xff, 0x03, ...writeVLQ(nameBytes.length).slice(-1), ...nameBytes);
  // Note: track-name length is small, VLQ rarely > 1 byte. Use VLQ properly:
  // Replace the simplified push above with a proper insertion.

  // Reset and rebuild correctly
  data.length = 0;
  data.push(0x00, 0xff, 0x03, ...writeVLQ(nameBytes.length), ...nameBytes);

  if (isFirstTrack) {
    // Tempo meta event (FF 51 03 mmmmmm) — microseconds per quarter note
    const microsPerQuarter = Math.round(60_000_000 / bpm);
    data.push(
      0x00,
      0xff,
      0x51,
      0x03,
      (microsPerQuarter >>> 16) & 0xff,
      (microsPerQuarter >>> 8) & 0xff,
      microsPerQuarter & 0xff,
    );
    // Time signature 4/4, 24 MIDI clocks per quarter, 8 32nds per quarter
    data.push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);
  }

  // Sort events by tick — note-off should come before note-on at the same tick
  // for retriggers, but we have no retriggers within a single step so order
  // off-then-on at equal ticks for cleanliness.
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.type !== b.type) return a.type === "off" ? -1 : 1;
    return 0;
  });

  let lastTick = 0;
  for (const ev of events) {
    const delta = ev.tick - lastTick;
    lastTick = ev.tick;
    data.push(...writeVLQ(delta));
    const status = (ev.type === "on" ? 0x90 : 0x80) | (ev.channel & 0x0f);
    data.push(status, ev.note & 0x7f, ev.velocity & 0x7f);
  }

  // End of track (FF 2F 00)
  data.push(0x00, 0xff, 0x2f, 0x00);

  // MTrk header
  const header = [...asciiBytes("MTrk"), ...writeUInt32BE(data.length)];
  return Uint8Array.from([...header, ...data]);
}

// ── Build a complete MIDI file from current engine state ─────
export function buildMidiFile(state: ReturnType<typeof useEngineStore.getState>): Uint8Array {
  const { bpm, totalSteps, tracks, songMode, chain, currentPattern, patterns } = state;

  const inSongMode = songMode && chain.length > 0;
  const sequenceLength = inSongMode ? totalSteps * chain.length : totalSteps;
  const ticksPerStep = (PPQ * 4) / totalSteps; // 16 steps → 120, 32 steps → 60

  // Pull effective per-track step, note, and nudge arrays for export.
  // In song mode we concatenate each pattern's data; otherwise we use the live track state.
  const effectiveStepsByTrack: number[][] = tracks.map((t, i) => {
    if (!inSongMode) return [...t.steps];
    const out: number[] = [];
    for (const patternIdx of chain) {
      const src =
        patternIdx === currentPattern
          ? t.steps
          : patterns[patternIdx]?.steps[i] ?? Array(totalSteps).fill(0);
      for (let s = 0; s < totalSteps; s++) out.push(src[s] ?? 0);
    }
    return out;
  });
  const effectiveNotesByTrack: string[][] = tracks.map((t, i) => {
    if (!inSongMode) return [...t.notes];
    const out: string[] = [];
    for (const patternIdx of chain) {
      const src =
        patternIdx === currentPattern
          ? t.notes
          : patterns[patternIdx]?.notes?.[i] ?? Array(totalSteps).fill("");
      for (let s = 0; s < totalSteps; s++) out.push(src[s] ?? "");
    }
    return out;
  });
  const effectiveNudgeByTrack: number[][] = tracks.map((t, i) => {
    if (!inSongMode) return [...t.nudge];
    const out: number[] = [];
    for (const patternIdx of chain) {
      const src =
        patternIdx === currentPattern
          ? t.nudge
          : patterns[patternIdx]?.nudge?.[i] ?? Array(totalSteps).fill(0);
      for (let s = 0; s < totalSteps; s++) out.push(src[s] ?? 0);
    }
    return out;
  });

  const trackChunks: Uint8Array[] = [];

  tracks.forEach((track: Track, trackIdx) => {
    const isMelodic = track.sound.melodic;
    const channel = isMelodic ? trackIdx : 9; // GM drums on channel 10 (zero-indexed 9)
    const events: NoteEvent[] = [];

    const stepsArr = effectiveStepsByTrack[trackIdx];
    const notesArr = effectiveNotesByTrack[trackIdx];
    const nudgeArr = effectiveNudgeByTrack[trackIdx];
    for (let step = 0; step < sequenceLength; step++) {
      const velocity = stepsArr[step] ?? 0;
      if (velocity <= 0) continue;
      // Probability is left as a runtime concept — MIDI exports always trigger.

      let midiNote: number | null = null;
      if (isMelodic) {
        const noteName = notesArr[step];
        midiNote = noteName ? parseNoteName(noteName) : null;
        if (midiNote === null) {
          // No note assigned — fall back to track's default note (e.g., G1 for tom)
          midiNote = parseNoteName(track.sound.note);
          if (midiNote === null) {
            // Last resort: a centered octave
            midiNote = 60;
          }
        }
      } else {
        midiNote = DRUM_GM_NOTE[track.sound.name] ?? 60;
      }

      const nudgeOffset = (nudgeArr[step] ?? 0) * ticksPerStep;
      const onTick = Math.max(0, Math.round(step * ticksPerStep + nudgeOffset));
      const offTick = Math.max(onTick + 1, Math.round((step + 1) * ticksPerStep + nudgeOffset));
      const vel = Math.max(1, Math.min(127, Math.round(velocity * 127)));

      events.push({ tick: onTick, type: "on", channel, note: midiNote, velocity: vel });
      events.push({ tick: offTick, type: "off", channel, note: midiNote, velocity: 0 });
    }

    if (events.length === 0) {
      // Empty track — still write a minimal chunk so DAWs see all 8 tracks
      trackChunks.push(
        encodeTrackChunk([], track.sound.name, trackIdx === 0, bpm),
      );
      return;
    }

    trackChunks.push(
      encodeTrackChunk(events, track.sound.name, trackIdx === 0, bpm),
    );
  });

  // Header chunk
  const header = [
    ...asciiBytes("MThd"),
    ...writeUInt32BE(6),
    ...writeUInt16BE(1),                  // format 1 (multi-track)
    ...writeUInt16BE(trackChunks.length), // number of tracks
    ...writeUInt16BE(PPQ),                // ticks per quarter note
  ];

  // Concatenate header + all track chunks
  let totalLen = header.length;
  for (const c of trackChunks) totalLen += c.length;
  const out = new Uint8Array(totalLen);
  out.set(header, 0);
  let offset = header.length;
  for (const c of trackChunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export function useMidiExport() {
  const [exporting, setExporting] = useState(false);

  const exportMidi = useCallback(() => {
    setExporting(true);
    try {
      const state = useEngineStore.getState();
      const bytes = buildMidiFile(state);
      const blob = new Blob([bytes as BlobPart], { type: "audio/midi" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const songLabel =
        state.songMode && state.chain.length > 0
          ? `-song-${state.chain.length}p`
          : "";
      a.href = url;
      a.download = `sts-${state.bpm}bpm-${state.totalSteps}steps${songLabel}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportMidi, exporting };
}
