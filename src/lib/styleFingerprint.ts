"use client";

// Style Fingerprint — a small vector of the user's recurring tendencies,
// updated each time a generated beat is accepted. Sent as context to
// /api/generate so future generations bias toward the user's style without
// explicit prompting. Local-only, no external cost.

import type { GeneratedBeat } from "@/store/engine";

const STORAGE_KEY = "sts_style_fingerprint_v1";
const MAX_HISTORY = 20;

interface BeatSummary {
  bpm: number;
  swing: number;
  totalSteps: number;
  density: Record<string, number>;       // average velocity > 0 per track
  bassNote: string | null;               // most-used bass note
  acceptedAt: number;
}

export interface StyleFingerprint {
  beats: BeatSummary[];                  // rolling history (most recent first)
}

function emptyFingerprint(): StyleFingerprint {
  return { beats: [] };
}

export function loadFingerprint(): StyleFingerprint {
  if (typeof window === "undefined") return emptyFingerprint();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyFingerprint();
    const parsed = JSON.parse(raw) as StyleFingerprint;
    if (!parsed || !Array.isArray(parsed.beats)) return emptyFingerprint();
    return parsed;
  } catch {
    return emptyFingerprint();
  }
}

function save(fp: StyleFingerprint): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fp));
  } catch {
    // localStorage full or disabled — silent fail
  }
}

function summarize(beat: GeneratedBeat): BeatSummary {
  const density: Record<string, number> = {};
  for (const [key, vels] of Object.entries(beat.tracks)) {
    const arr = vels as number[];
    const active = arr.filter((v) => v > 0);
    density[key] = active.length > 0
      ? Math.round((active.reduce((a, b) => a + b, 0) / active.length) * 100) / 100
      : 0;
  }

  // Most-used bass note (mode of non-empty entries)
  const bassNotes = beat.melodicNotes.bass ?? [];
  const counts: Record<string, number> = {};
  for (const n of bassNotes) {
    if (!n) continue;
    counts[n] = (counts[n] ?? 0) + 1;
  }
  const bassNote = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    bpm: beat.bpm,
    swing: beat.swing,
    totalSteps: beat.totalSteps,
    density,
    bassNote,
    acceptedAt: Date.now(),
  };
}

export function recordAcceptedBeat(beat: GeneratedBeat): void {
  const fp = loadFingerprint();
  fp.beats.unshift(summarize(beat));
  if (fp.beats.length > MAX_HISTORY) fp.beats.length = MAX_HISTORY;
  save(fp);
}

// Build the compact fingerprint context block for the /api/generate prompt.
// Only emitted once the user has accepted ≥3 beats — below that, signal is noise.
export function buildFingerprintContext(): string {
  const fp = loadFingerprint();
  if (fp.beats.length < 3) return "";

  const recent = fp.beats.slice(0, 10);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const bpms = recent.map((b) => b.bpm);
  const swings = recent.map((b) => b.swing);
  const stepsPattern = recent.map((b) => b.totalSteps);

  // Average density per track
  const trackKeys = Object.keys(recent[0].density);
  const avgDensity: Record<string, number> = {};
  for (const k of trackKeys) {
    const values = recent.map((b) => b.density[k] ?? 0);
    avgDensity[k] = Math.round(avg(values) * 100) / 100;
  }

  // Bass note distribution
  const noteCounts: Record<string, number> = {};
  for (const b of recent) {
    if (b.bassNote) noteCounts[b.bassNote] = (noteCounts[b.bassNote] ?? 0) + 1;
  }
  const topNotes = Object.entries(noteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n]) => n);

  return [
    `Avg BPM: ${Math.round(avg(bpms))}`,
    `Avg swing: ${avg(swings).toFixed(2)}`,
    `Step count: ${stepsPattern.reduce((a, b) => a + (b === 32 ? 1 : 0), 0) > 5 ? "32 typical" : "16 typical"}`,
    `Avg track density: ${trackKeys.map((k) => `${k} ${avgDensity[k]}`).join(", ")}`,
    topNotes.length > 0 ? `Common bass notes: ${topNotes.join(", ")}` : null,
  ].filter(Boolean).join(" · ");
}
