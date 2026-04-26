"use client";

import { useState, useCallback, useMemo } from "react";
import { useEngineStore } from "@/store/engine";
import { DEFAULT_KIT } from "@/lib/sounds";
import {
  suggestArrangements,
  getPatternAnalysis,
  type ArrangementSection,
  type SectionType,
} from "@/lib/arrangementAI";

const SECTION_COLORS: Record<SectionType, string> = {
  intro: "#4ade9b",
  verse: "#60a5fa",
  build: "#f59e0b",
  drop: "#ef4444",
  breakdown: "#8b5cf6",
  bridge: "#06b6d4",
  outro: "#6b7280",
  hook: "#ec4899",
};

const SECTION_EMOJIS: Record<SectionType, string> = {
  intro: "🌅",
  verse: "🎤",
  build: "📈",
  drop: "💥",
  breakdown: "🧘",
  bridge: "🌉",
  outro: "🌙",
  hook: "🪝",
};

export function ArrangementPanel() {
  const tracks = useEngineStore((s) => s.tracks);
  const bpm = useEngineStore((s) => s.bpm);
  const swing = useEngineStore((s) => s.swing);
  const addToChain = useEngineStore((s) => s.addToChain);
  const setSongMode = useEngineStore((s) => s.setSongMode);
  const chain = useEngineStore((s) => s.chain);

  const [selectedArrangement, setSelectedArrangement] = useState<number>(0);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  const trackData = useMemo(
    () => tracks.map((t, i) => ({ name: t.customSampleName || DEFAULT_KIT[i]?.name || `Track ${i + 1}`, steps: t.steps })),
    [tracks]
  );

  const analysis = useMemo(
    () => getPatternAnalysis(trackData, bpm, swing),
    [trackData, bpm, swing]
  );

  const arrangements = useMemo(
    () => suggestArrangements(trackData, bpm, swing),
    [trackData, bpm, swing]
  );

  const current = arrangements[selectedArrangement] ?? arrangements[0];

  const applyArrangement = useCallback(() => {
    if (!current) return;
    // Enable song mode and build a chain that represents the arrangement
    setSongMode(true);
    // For now, we use the current pattern repeated with section context
    // A full implementation would create pattern variations per section
    const patternCount = Math.min(current.sections.length, 8);
    for (let i = 0; i < patternCount; i++) {
      addToChain(i % 8);
    }
  }, [current, setSongMode, addToChain]);

  return (
    <div className="flex flex-col gap-3">
      {/* Pattern Analysis */}
      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Pattern analysis</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
            {analysis.genre}
          </span>
          <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] text-soft">
            Energy: {Math.round(analysis.energy * 100)}%
          </span>
          <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] text-soft">
            Density: {Math.round(analysis.avgDensity * 100)}%
          </span>
          {analysis.hasBass && (
            <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-400">Bass ✓</span>
          )}
          {analysis.hasMelody && (
            <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-400">Melodic ✓</span>
          )}
        </div>
      </div>

      {/* Arrangement selector */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Arrangement</span>
        <div className="flex gap-1">
          {arrangements.map((a, i) => (
            <button
              key={i}
              onClick={() => setSelectedArrangement(i)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                i === selectedArrangement
                  ? "bg-accent text-[#1a1408]"
                  : "bg-surface-2 text-muted hover:bg-surface-3"
              }`}
            >
              {a.genre}
            </button>
          ))}
        </div>
      </div>

      {/* Arrangement description */}
      {current && (
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground">{current.name}</span>
            <span className="text-[9px] text-muted">{current.totalBars} bars</span>
          </div>
          <p className="mt-1 text-[10px] text-soft">{current.description}</p>
        </div>
      )}

      {/* Timeline visualization */}
      {current && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Timeline</span>
          <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-1.5">
            {current.sections.map((section, i) => {
              const widthPct = (section.bars / current.totalBars) * 100;
              const isExpanded = expandedSection === i;
              return (
                <button
                  key={i}
                  onClick={() => setExpandedSection(isExpanded ? null : i)}
                  className="relative overflow-hidden rounded-md transition-all hover:brightness-110"
                  style={{
                    width: `${widthPct}%`,
                    minWidth: "24px",
                    height: isExpanded ? "80px" : "36px",
                    backgroundColor: SECTION_COLORS[section.type],
                  }}
                  title={`${section.type} — ${section.bars} bars`}
                >
                  <div className="flex h-full flex-col items-center justify-center gap-0.5 p-1">
                    <span className="text-[14px]">{SECTION_EMOJIS[section.type]}</span>
                    <span className="text-[8px] font-bold uppercase text-white/90">{section.type}</span>
                    <span className="text-[7px] text-white/60">{section.bars}b</span>
                    {isExpanded && (
                      <span className="mt-0.5 text-[7px] leading-tight text-white/70">
                        {section.patternModifications.description}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section details */}
      {expandedSection !== null && current?.sections[expandedSection] && (
        <SectionDetail section={current.sections[expandedSection]} />
      )}

      {/* Apply button */}
      <button
        onClick={applyArrangement}
        className="button-primary rounded-lg px-3 py-2 text-[11px] font-bold"
      >
        ✨ Apply to Song Chain
      </button>

      {/* Current chain status */}
      {chain.length > 0 && (
        <div className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[10px] text-soft">
          Chain: {chain.length} patterns · Song mode on
        </div>
      )}
    </div>
  );
}

function SectionDetail({ section }: { section: ArrangementSection }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[16px]">{SECTION_EMOJIS[section.type]}</span>
        <div>
          <span className="text-[11px] font-bold capitalize text-foreground">{section.type}</span>
          <span className="ml-2 text-[9px] text-muted">{section.bars} bars</span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-soft">{section.patternModifications.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {Object.entries(section.patternModifications.trackDensities).map(([track, density]) => (
          <div key={track} className="flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5">
            <span className="text-[8px] capitalize text-muted">{track}</span>
            <div className="h-1.5 w-8 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${density * 100}%`,
                  backgroundColor: SECTION_COLORS[section.type],
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-3 text-[9px] text-muted">
        <span>Vel: ×{section.patternModifications.velocityMultiplier.toFixed(2)}</span>
        {section.patternModifications.swingAdjust !== 0 && (
          <span>Swing: {section.patternModifications.swingAdjust > 0 ? "+" : ""}{section.patternModifications.swingAdjust.toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}
