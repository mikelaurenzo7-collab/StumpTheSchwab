"use client";

/**
 * Smart Fill Engine — Algorithmic variation generator
 *
 * Analyzes a pattern's density, rhythm, and velocity contour, then produces
 * musically-intelligent fills, breaks, build-ups, and drops. No AI needed —
 * these are deterministic algorithms that understand drum grammar.
 */

export type FillType = "fill" | "break" | "build" | "drop" | "switch-up" | "ghost-notes";

export interface FillOptions {
  type: FillType;
  intensity: number; // 0..1
  targetBar?: number; // Which bar to apply to (for multi-bar patterns). Default last.
}

export interface FillResult {
  type: FillType;
  steps: number[]; // new step velocities for the target track
  notes: string[]; // new notes for melodic tracks
  probabilities: number[];
  nudge: number[];
  description: string;
}

// ── Analysis ─────────────────────────────────────────────────

function analyzeDensity(steps: number[]): number {
  return steps.filter((v) => v > 0).length / steps.length;
}

function analyzeOnsets(steps: number[]): number[] {
  return steps.map((v, i) => (v > 0 ? i : -1)).filter((i) => i !== -1);
}

function getBarLength(totalSteps: number): number {
  return totalSteps <= 16 ? totalSteps : totalSteps / 2;
}

function getLastBarRange(totalSteps: number): [number, number] {
  const bar = getBarLength(totalSteps);
  return [totalSteps - bar, totalSteps];
}

// ── Fill Generators ──────────────────────────────────────────

function generateDrumFill(
  steps: number[],
  totalSteps: number,
  intensity: number,
  trackName: string
): { steps: number[]; probs: number[]; nudge: number[]; desc: string } {
  const [start, end] = getLastBarRange(totalSteps);
  const barLen = end - start;
  const result = [...steps];
  const probs = steps.map((_, i) => (i >= start && i < end ? 0.5 + Math.random() * 0.5 : 1));
  const nudge = steps.map(() => 0);

  const name = trackName.toLowerCase();

  if (name.includes("kick")) {
    // Kick fill: double-time kicks on last 4 steps
    const fillStart = end - 4;
    for (let i = fillStart; i < end; i++) {
      if (i >= 0 && i < result.length) {
        result[i] = 0.7 + Math.random() * 0.3;
        nudge[i] = (Math.random() - 0.5) * 0.04; // slight push/pull
      }
    }
    return { steps: result, probs, nudge, desc: `Double-time kick push` };
  }

  if (name.includes("snare") || name.includes("clap")) {
    // Snare fill: snare roll accelerating toward the end
    const rollLen = Math.floor(2 + intensity * 4);
    const fillStart = end - rollLen;
    for (let i = fillStart; i < end; i++) {
      if (i >= 0 && i < result.length) {
        const progress = (i - fillStart) / rollLen;
        result[i] = 0.5 + progress * 0.5;
        nudge[i] = -0.02 * progress; // slightly early = tighter
      }
    }
    return { steps: result, probs, nudge, desc: `Accelerating snare roll` };
  }

  if (name.includes("hat") || name.includes("cymbal")) {
    // Hat fill: 32nd-note feel — add a flurry on the last half-bar
    const fillStart = end - barLen / 2;
    for (let i = Math.floor(fillStart); i < end; i += 1) {
      if (i >= 0 && i < result.length) {
        result[i] = 0.4 + Math.random() * 0.4;
        nudge[i] = (Math.random() - 0.5) * 0.06;
      }
    }
    return { steps: result, probs, nudge, desc: `Hat flurry` };
  }

  // Default: syncopated hits on off-beats
  const offBeats = [];
  for (let i = start; i < end; i++) {
    if (i % 2 === 1 && result[i] === 0) offBeats.push(i);
  }
  const hitsToAdd = Math.floor(offBeats.length * intensity);
  const shuffled = offBeats.sort(() => Math.random() - 0.5);
  for (let i = 0; i < hitsToAdd && i < shuffled.length; i++) {
    result[shuffled[i]] = 0.6 + Math.random() * 0.3;
  }

  return { steps: result, probs, nudge, desc: `Syncopated fill` };
}

function generateBreak(
  steps: number[],
  totalSteps: number,
  intensity: number
): { steps: number[]; probs: number[]; nudge: number[]; desc: string } {
  const [start, end] = getLastBarRange(totalSteps);
  const result = [...steps];
  const probs = steps.map(() => 1);
  const nudge = steps.map(() => 0);

  // Remove a percentage of hits in the last bar
  for (let i = start; i < end; i++) {
    if (result[i] > 0 && Math.random() < intensity * 0.7) {
      result[i] = 0;
    }
  }

  // Maybe add one big hit right before the loop restart
  const restartHit = Math.max(0, end - 2);
  if (Math.random() < intensity) {
    result[restartHit] = 0.9;
  }

  return { steps: result, probs, nudge, desc: `Stripped break` };
}

function generateBuild(
  steps: number[],
  totalSteps: number,
  intensity: number,
  trackName: string
): { steps: number[]; probs: number[]; nudge: number[]; desc: string } {
  const [start] = getLastBarRange(totalSteps);
  const result = [...steps];
  const probs = steps.map(() => 1);
  const nudge = steps.map(() => 0);

  const name = trackName.toLowerCase();

  if (name.includes("kick")) {
    // Build: four-on-floor gets denser
    for (let i = start; i < result.length; i++) {
      if (result[i] === 0 && i % 4 === 0) {
        result[i] = 0.8;
      }
    }
    return { steps: result, probs, nudge, desc: `Dense kick build` };
  }

  if (name.includes("snare") || name.includes("clap")) {
    // Build: snare gets more frequent
    for (let i = start; i < result.length; i += 2) {
      if (result[i] === 0) {
        result[i] = 0.5 + (i / result.length) * 0.4;
      }
    }
    return { steps: result, probs, nudge, desc: `Snare ramp-up` };
  }

  // Generic: crescendo velocity
  for (let i = start; i < result.length; i++) {
    if (result[i] > 0) {
      result[i] = Math.min(1, result[i] + intensity * 0.3 * (i / result.length));
    }
  }

  return { steps: result, probs, nudge, desc: `Crescendo build` };
}

function generateDrop(
  steps: number[],
  totalSteps: number,
  intensity: number
): { steps: number[]; probs: number[]; nudge: number[]; desc: string } {
  const [start, end] = getLastBarRange(totalSteps);
  const result = steps.map((v) => v); // copy
  const probs = steps.map(() => 1);
  const nudge = steps.map(() => 0);

  // Remove almost everything in last bar except a massive hit on the 1
  for (let i = start + 1; i < end; i++) {
    if (Math.random() < intensity * 0.8) {
      result[i] = 0;
    }
  }
  // Big impact on first step of new loop
  if (end < result.length) {
    result[end] = Math.max(result[end] ?? 0, 0.95);
  }

  return { steps: result, probs, nudge, desc: `Impact drop` };
}

function generateSwitchUp(
  steps: number[],
  totalSteps: number,
  intensity: number
): { steps: number[]; probs: number[]; nudge: number[]; desc: string } {
  const result = [...steps];
  const probs = steps.map(() => 1);
  const nudge = steps.map(() => 0);

  // Shift the pattern by a rhythmic offset
  const shift = Math.floor(intensity * 4) + 1;
  const shifted = [...result.slice(-shift), ...result.slice(0, -shift)];

  // Blend original with shifted
  for (let i = 0; i < result.length; i++) {
    if (Math.random() < intensity * 0.5) {
      result[i] = Math.max(result[i], shifted[i] * 0.8);
    }
  }

  return { steps: result, probs, nudge, desc: `Rhythmic switch-up` };
}

function generateGhostNotes(
  steps: number[],
  _totalSteps: number,
  intensity: number
): { steps: number[]; probs: number[]; nudge: number[]; desc: string } {
  const result = [...steps];
  const probs = steps.map(() => 1);
  const nudge = steps.map(() => 0);

  // Add very quiet ghost notes between existing hits
  const onsets = analyzeOnsets(steps);
  for (let i = 0; i < onsets.length - 1; i++) {
    const gap = onsets[i + 1] - onsets[i];
    if (gap > 2) {
      const ghostPos = onsets[i] + Math.floor(gap / 2);
      if (result[ghostPos] === 0 && Math.random() < intensity) {
        result[ghostPos] = 0.15 + Math.random() * 0.15;
        nudge[ghostPos] = 0.02; // slightly late = human
      }
    }
  }

  return { steps: result, probs, nudge, desc: `Ghost note groove` };
}

// ── Public API ───────────────────────────────────────────────

export function generateFill(
  trackSteps: number[],
  trackNotes: string[],
  trackName: string,
  totalSteps: number,
  options: FillOptions
): FillResult {
  const { type, intensity } = options;

  let generated: { steps: number[]; probs: number[]; nudge: number[]; desc: string };

  switch (type) {
    case "fill":
      generated = generateDrumFill(trackSteps, totalSteps, intensity, trackName);
      break;
    case "break":
      generated = generateBreak(trackSteps, totalSteps, intensity);
      break;
    case "build":
      generated = generateBuild(trackSteps, totalSteps, intensity, trackName);
      break;
    case "drop":
      generated = generateDrop(trackSteps, totalSteps, intensity);
      break;
    case "switch-up":
      generated = generateSwitchUp(trackSteps, totalSteps, intensity);
      break;
    case "ghost-notes":
      generated = generateGhostNotes(trackSteps, totalSteps, intensity);
      break;
    default:
      generated = { steps: [...trackSteps], probs: trackSteps.map(() => 1), nudge: trackSteps.map(() => 0), desc: "No change" };
  }

  return {
    type,
    steps: generated.steps,
    notes: trackNotes, // melodic notes preserved
    probabilities: generated.probs,
    nudge: generated.nudge,
    description: generated.desc,
  };
}

/**
 * Analyze an entire pattern and suggest the best fill type per track.
 */
export function suggestFills(
  tracks: { steps: number[]; name: string }[]
): Array<{ trackIndex: number; suggestedType: FillType; reason: string }> {
  const suggestions: Array<{ trackIndex: number; suggestedType: FillType; reason: string }> = [];

  tracks.forEach((track, i) => {
    const density = analyzeDensity(track.steps);
    const name = track.name.toLowerCase();

    if (name.includes("kick")) {
      if (density > 0.5) {
        suggestions.push({ trackIndex: i, suggestedType: "switch-up", reason: "Kick is busy — try a rhythmic variation" });
      } else {
        suggestions.push({ trackIndex: i, suggestedType: "build", reason: "Sparse kick — build energy" });
      }
    } else if (name.includes("snare") || name.includes("clap")) {
      if (density > 0.3) {
        suggestions.push({ trackIndex: i, suggestedType: "fill", reason: "Snare has a backbeat — add a roll" });
      } else {
        suggestions.push({ trackIndex: i, suggestedType: "ghost-notes", reason: "Snare is sparse — ghost notes add life" });
      }
    } else if (name.includes("hat")) {
      if (density > 0.6) {
        suggestions.push({ trackIndex: i, suggestedType: "break", reason: "Hats are constant — strip them for contrast" });
      } else {
        suggestions.push({ trackIndex: i, suggestedType: "fill", reason: "Hats are sparse — add motion" });
      }
    } else if (name.includes("bass")) {
      suggestions.push({ trackIndex: i, suggestedType: "drop", reason: "Bass drop creates impact" });
    }
  });

  return suggestions;
}
