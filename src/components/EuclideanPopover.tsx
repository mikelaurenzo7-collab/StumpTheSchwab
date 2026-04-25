"use client";

import { euclideanPattern, useEngineStore } from "@/store/engine";
import { useEffect, useMemo, useRef, useState } from "react";

interface EuclideanPopoverProps {
  trackId: number;
  trackName: string;
  trackColor: string;
  onClose: () => void;
}

export function EuclideanPopover({
  trackId,
  trackName,
  trackColor,
  onClose,
}: EuclideanPopoverProps) {
  const totalSteps = useEngineStore((s) => s.totalSteps);
  const euclideanFill = useEngineStore((s) => s.euclideanFill);

  const [hits, setHits] = useState(() => Math.max(1, Math.round(totalSteps / 4)));
  const [rotation, setRotation] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Derive clamped values so a shrinking totalSteps can't push us past the max.
  // The euclidean algorithm clamps internally, but apply() uses these too.
  const safeHits = Math.min(Math.max(0, hits), totalSteps);
  const safeRotation = Math.min(Math.max(0, rotation), Math.max(0, totalSteps - 1));

  // Live preview pattern (visual only — no audio side-effect)
  const preview = useMemo(
    () => euclideanPattern(safeHits, totalSteps, safeRotation),
    [safeHits, totalSteps, safeRotation]
  );

  // Click-outside / Escape to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        euclideanFill(trackId, safeHits, safeRotation);
        onClose();
      }
    };
    // defer the click listener so the click that opened us doesn't close it
    const t = setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    document.addEventListener("keydown", handleKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, euclideanFill, trackId, safeHits, safeRotation]);

  const apply = () => {
    euclideanFill(trackId, safeHits, safeRotation);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute z-30 left-0 top-full mt-1 p-3 bg-surface-2 border border-border rounded-lg shadow-2xl shadow-black/50 min-w-[280px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: trackColor }}
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
            Euclidean — {trackName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] text-muted hover:text-foreground"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Preview ring */}
      <div className="grid grid-cols-16 gap-0.5 mb-3" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}>
        {preview.map((on, i) => (
          <div
            key={i}
            className={`h-3 rounded-sm transition-colors ${
              i % 4 === 0 ? "ml-px" : ""
            }`}
            style={{
              backgroundColor: on ? trackColor : "var(--surface-3)",
              opacity: on ? 1 : 0.4,
            }}
          />
        ))}
      </div>

      {/* Hits slider */}
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[9px] uppercase tracking-wider text-muted w-12">Hits</label>
        <input
          type="range"
          min={0}
          max={totalSteps}
          step={1}
          value={safeHits}
          onChange={(e) => setHits(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-[10px] font-mono text-foreground w-10 text-right">
          {safeHits}/{totalSteps}
        </span>
      </div>

      {/* Rotation slider */}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-[9px] uppercase tracking-wider text-muted w-12">Rotate</label>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          step={1}
          value={safeRotation}
          onChange={(e) => setRotation(Number(e.target.value))}
          className="flex-1"
          disabled={totalSteps <= 1}
        />
        <span className="text-[10px] font-mono text-foreground w-10 text-right">
          {safeRotation}
        </span>
      </div>

      {/* Quick presets */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {[
          { label: "4-on-floor", h: Math.max(1, Math.round(totalSteps / 4)), r: 0 },
          { label: "Tresillo", h: 3, r: 0 },
          { label: "Cinquillo", h: 5, r: 0 },
          { label: "Off", h: Math.max(1, Math.round(totalSteps / 4)), r: 2 },
        ]
          .filter((p) => p.h <= totalSteps)
          .map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setHits(p.h);
                setRotation(Math.min(p.r, totalSteps - 1));
              }}
              className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-surface text-muted hover:bg-surface-3 hover:text-foreground transition-colors"
              title={`${p.h} hits, rotation ${p.r}`}
            >
              {p.label}
            </button>
          ))}
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[9px] text-muted/70">Enter to apply · Esc to close</span>
        <button
          onClick={apply}
          className="px-3 py-1 rounded bg-accent hover:bg-accent-hover text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
