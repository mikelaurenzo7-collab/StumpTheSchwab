"use client";

/**
 * Smart Arrangement AI — Song structure suggestions
 *
 * Analyzes the current pattern's density, energy, and rhythmic content,
 * then suggests a full song arrangement (intro → verse → build → drop →
 * breakdown → outro) with specific pattern modifications for each section.
 *
 * This is pure algorithm — no API calls. It understands drum grammar,
 * energy curves, and arrangement conventions across genres.
 */

export type SectionType = "intro" | "verse" | "build" | "drop" | "breakdown" | "bridge" | "outro" | "hook";

export interface ArrangementSection {
  type: SectionType;
  bars: number;
  patternModifications: {
    description: string;
    trackDensities: Record<string, number>; // track name → target density (0..1)
    velocityMultiplier: number;
    swingAdjust: number; // -0.2..0.2
  };
}

export interface ArrangementSuggestion {
  name: string;
  genre: string;
  totalBars: number;
  sections: ArrangementSection[];
  description: string;
}

interface PatternAnalysis {
  avgDensity: number;
  kickDensity: number;
  snareDensity: number;
  hatDensity: number;
  bassDensity: number;
  melodicDensity: number;
  energy: number; // 0..1 composite
  isSparse: boolean;
  isDense: boolean;
  hasBass: boolean;
  hasMelody: boolean;
  bpm: number;
  swing: number;
}

function analyzePattern(tracks: { name: string; steps: number[] }[], bpm: number, swing: number): PatternAnalysis {
  const densities: Record<string, number> = {};
  let totalDensity = 0;

  tracks.forEach((t) => {
    const d = t.steps.filter((v) => v > 0).length / (t.steps.length || 1);
    densities[t.name.toLowerCase()] = d;
    totalDensity += d;
  });

  const avgDensity = totalDensity / (tracks.length || 1);
  const kickDensity = densities["kick"] ?? 0;
  const snareDensity = densities["snare"] ?? 0;
  const hatDensity = densities["hihat"] ?? densities["hi-hat"] ?? 0;
  const bassDensity = densities["bass"] ?? 0;
  const melodicDensity = (densities["tom"] ?? 0) + (densities["perc"] ?? 0);

  // Energy = weighted composite (kick + bass = low energy, hats + perc = high energy)
  const energy = Math.min(1, avgDensity * 1.2 + kickDensity * 0.3 + bassDensity * 0.2);

  return {
    avgDensity,
    kickDensity,
    snareDensity,
    hatDensity,
    bassDensity,
    melodicDensity,
    energy,
    isSparse: avgDensity < 0.2,
    isDense: avgDensity > 0.5,
    hasBass: bassDensity > 0.1,
    hasMelody: melodicDensity > 0.1,
    bpm,
    swing,
  };
}

function detectGenre(a: PatternAnalysis): string {
  if (a.bpm >= 170) return "Drum & Bass";
  if (a.bpm >= 140 && a.bpm < 170) return "Trap";
  if (a.bpm >= 120 && a.bpm < 140 && a.kickDensity > 0.2) return "House/Techno";
  if (a.bpm >= 95 && a.bpm < 120 && a.snareDensity > 0.1) return "Hip-Hop";
  if (a.bpm >= 80 && a.bpm < 100 && a.swing > 0.3) return "Boom Bap";
  if (a.bpm >= 60 && a.bpm < 90 && a.isSparse) return "Ambient";
  if (a.bpm >= 100 && a.bpm < 130 && a.hatDensity > 0.4) return "Pop/EDM";
  return "Electronic";
}

// ── Arrangement Templates ──────────────────────────────────────

function buildEDMArrangement(a: PatternAnalysis): ArrangementSuggestion {
  const sections: ArrangementSection[] = [
    {
      type: "intro",
      bars: 8,
      patternModifications: {
        description: "Sparse intro — kick only, hats fade in",
        trackDensities: { kick: a.kickDensity * 0.5, hihat: 0.1, snare: 0, bass: 0, clap: 0 },
        velocityMultiplier: 0.7,
        swingAdjust: 0,
      },
    },
    {
      type: "build",
      bars: 4,
      patternModifications: {
        description: "Rising energy — add hats, snare rolls",
        trackDensities: { kick: a.kickDensity, hihat: a.hatDensity * 0.8, snare: a.snareDensity * 0.5, bass: a.bassDensity * 0.3, clap: 0 },
        velocityMultiplier: 0.85,
        swingAdjust: 0,
      },
    },
    {
      type: "drop",
      bars: 8,
      patternModifications: {
        description: "Full power — everything in",
        trackDensities: { kick: a.kickDensity, hihat: a.hatDensity, snare: a.snareDensity, bass: a.bassDensity, clap: a.snareDensity },
        velocityMultiplier: 1.0,
        swingAdjust: 0,
      },
    },
    {
      type: "breakdown",
      bars: 4,
      patternModifications: {
        description: "Strip back — bass and pads only",
        trackDensities: { kick: a.kickDensity * 0.3, hihat: 0.1, snare: 0, bass: a.bassDensity * 0.5, clap: 0 },
        velocityMultiplier: 0.6,
        swingAdjust: 0.05,
      },
    },
    {
      type: "build",
      bars: 4,
      patternModifications: {
        description: "Second rise — snare rolls + riser",
        trackDensities: { kick: a.kickDensity * 0.7, hihat: a.hatDensity * 0.6, snare: a.snareDensity * 0.8, bass: a.bassDensity * 0.5, clap: a.snareDensity * 0.3 },
        velocityMultiplier: 0.9,
        swingAdjust: 0,
      },
    },
    {
      type: "drop",
      bars: 8,
      patternModifications: {
        description: "Second drop — full energy",
        trackDensities: { kick: a.kickDensity, hihat: a.hatDensity, snare: a.snareDensity, bass: a.bassDensity, clap: a.snareDensity },
        velocityMultiplier: 1.0,
        swingAdjust: 0,
      },
    },
    {
      type: "outro",
      bars: 4,
      patternModifications: {
        description: "Fade out — kick + bass only, decrescendo",
        trackDensities: { kick: a.kickDensity * 0.4, hihat: 0.05, snare: 0, bass: a.bassDensity * 0.3, clap: 0 },
        velocityMultiplier: 0.5,
        swingAdjust: 0,
      },
    },
  ];

  return {
    name: "EDM Festival Structure",
    genre: "EDM",
    totalBars: sections.reduce((s, sec) => s + sec.bars, 0),
    sections,
    description: "Classic intro → build → drop → breakdown → build → drop → outro. Festival-ready.",
  };
}

function buildHipHopArrangement(a: PatternAnalysis): ArrangementSuggestion {
  const sections: ArrangementSection[] = [
    {
      type: "intro",
      bars: 4,
      patternModifications: {
        description: "Lo-fi intro — kick + hat, no bass",
        trackDensities: { kick: a.kickDensity * 0.5, hihat: a.hatDensity * 0.3, snare: 0, bass: 0, clap: 0 },
        velocityMultiplier: 0.65,
        swingAdjust: a.swing > 0.1 ? 0 : 0.08,
      },
    },
    {
      type: "verse",
      bars: 8,
      patternModifications: {
        description: "Main groove — full drums, bass enters",
        trackDensities: { kick: a.kickDensity, hihat: a.hatDensity * 0.7, snare: a.snareDensity, bass: a.bassDensity * 0.7, clap: a.snareDensity * 0.5 },
        velocityMultiplier: 0.85,
        swingAdjust: 0,
      },
    },
    {
      type: "hook",
      bars: 4,
      patternModifications: {
        description: "Hook — full energy, melodic elements",
        trackDensities: { kick: a.kickDensity, hihat: a.hatDensity, snare: a.snareDensity, bass: a.bassDensity, clap: a.snareDensity },
        velocityMultiplier: 1.0,
        swingAdjust: 0,
      },
    },
    {
      type: "verse",
      bars: 8,
      patternModifications: {
        description: "Verse 2 — same groove, slight variation",
        trackDensities: { kick: a.kickDensity, hihat: a.hatDensity * 0.8, snare: a.snareDensity, bass: a.bassDensity * 0.8, clap: a.snareDensity * 0.4 },
        velocityMultiplier: 0.85,
        swingAdjust: 0.02,
      },
    },
    {
      type: "bridge",
      bars: 4,
      patternModifications: {
        description: "Bridge — stripped, bass walks",
        trackDensities: { kick: a.kickDensity * 0.3, hihat: a.hatDensity * 0.2, snare: a.snareDensity * 0.3, bass: a.bassDensity * 0.5, clap: 0 },
        velocityMultiplier: 0.7,
        swingAdjust: 0.05,
      },
    },
    {
      type: "hook",
      bars: 4,
      patternModifications: {
        description: "Final hook — maximum energy",
        trackDensities: { kick: a.kickDensity, hihat: a.hatDensity, snare: a.snareDensity, bass: a.bassDensity, clap: a.snareDensity },
        velocityMultiplier: 1.0,
        swingAdjust: 0,
      },
    },
    {
      type: "outro",
      bars: 4,
      patternModifications: {
        description: "Outro — fade with kick + bass",
        trackDensities: { kick: a.kickDensity * 0.4, hihat: 0.1, snare: 0, bass: a.bassDensity * 0.3, clap: 0 },
        velocityMultiplier: 0.5,
        swingAdjust: 0,
      },
    },
  ];

  return {
    name: "Hip-Hop Structure",
    genre: "Hip-Hop",
    totalBars: sections.reduce((s, sec) => s + sec.bars, 0),
    sections,
    description: "Intro → Verse → Hook → Verse → Bridge → Hook → Outro. Classic hip-hop arrangement.",
  };
}

function buildMinimalArrangement(a: PatternAnalysis): ArrangementSuggestion {
  const sections: ArrangementSection[] = [
    {
      type: "intro",
      bars: 8,
      patternModifications: {
        description: "Atmospheric intro — minimal elements",
        trackDensities: { kick: 0.1, hihat: 0.05, snare: 0, bass: 0, clap: 0 },
        velocityMultiplier: 0.5,
        swingAdjust: 0,
      },
    },
    {
      type: "verse",
      bars: 16,
      patternModifications: {
        description: "Slow build — elements enter one by one",
        trackDensities: { kick: a.kickDensity * 0.6, hihat: a.hatDensity * 0.4, snare: a.snareDensity * 0.5, bass: a.bassDensity * 0.4, clap: 0 },
        velocityMultiplier: 0.75,
        swingAdjust: 0,
      },
    },
    {
      type: "drop",
      bars: 8,
      patternModifications: {
        description: "Peak — full pattern",
        trackDensities: { kick: a.kickDensity, hihat: a.hatDensity, snare: a.snareDensity, bass: a.bassDensity, clap: a.snareDensity },
        velocityMultiplier: 1.0,
        swingAdjust: 0,
      },
    },
    {
      type: "outro",
      bars: 8,
      patternModifications: {
        description: "Dissolve — elements fade",
        trackDensities: { kick: a.kickDensity * 0.2, hihat: 0.05, snare: 0, bass: a.bassDensity * 0.2, clap: 0 },
        velocityMultiplier: 0.4,
        swingAdjust: 0.03,
      },
    },
  ];

  return {
    name: "Minimal Structure",
    genre: "Ambient/Minimal",
    totalBars: sections.reduce((s, sec) => s + sec.bars, 0),
    sections,
    description: "Long-form minimal: Intro → Verse → Drop → Outro. Ambient and evolving.",
  };
}

// ── Public API ─────────────────────────────────────────────────

export function suggestArrangements(
  tracks: { name: string; steps: number[] }[],
  bpm: number,
  swing: number
): ArrangementSuggestion[] {
  const analysis = analyzePattern(tracks, bpm, swing);
  const genre = detectGenre(analysis);

  const suggestions: ArrangementSuggestion[] = [];

  // Always offer EDM and Hip-Hop as options
  suggestions.push(buildEDMArrangement(analysis));
  suggestions.push(buildHipHopArrangement(analysis));

  // Add minimal if the pattern is sparse or ambient
  if (analysis.isSparse || genre === "Ambient") {
    suggestions.push(buildMinimalArrangement(analysis));
  }

  return suggestions;
}

export function getPatternAnalysis(
  tracks: { name: string; steps: number[] }[],
  bpm: number,
  swing: number
): PatternAnalysis & { genre: string } {
  const analysis = analyzePattern(tracks, bpm, swing);
  return { ...analysis, genre: detectGenre(analysis) };
}
