"use client";

import { useCallback, useState } from "react";
import { useEngineStore, type MacroControl, type AutomationTarget } from "@/store/engine";

// Automation targets a macro can control
const MACRO_TARGETS: Array<{ label: string; target: AutomationTarget; min: number; max: number }> = [
  { label: "Master Volume", target: "master.volume", min: 0, max: 1 },
  { label: "BPM", target: "bpm", min: 60, max: 200 },
  ...Array.from({ length: 8 }, (_, i) => [
    { label: `Track ${i + 1} Volume`, target: `track.${i}.volume` as AutomationTarget, min: 0, max: 1 },
    { label: `Track ${i + 1} Pan`, target: `track.${i}.pan` as AutomationTarget, min: -1, max: 1 },
    { label: `Track ${i + 1} Filter`, target: `track.${i}.effects.filterFreq` as AutomationTarget, min: 200, max: 20000 },
    { label: `Track ${i + 1} Delay`, target: `track.${i}.effects.delayWet` as AutomationTarget, min: 0, max: 1 },
    { label: `Track ${i + 1} Reverb`, target: `track.${i}.effects.reverbWet` as AutomationTarget, min: 0, max: 1 },
  ]).flat(),
];

function MacroKnob({ macro, trackNames }: { macro: MacroControl; trackNames: string[] }) {
  const setMacroValue = useEngineStore((s) => s.setMacroValue);
  const removeMacro = useEngineStore((s) => s.removeMacro);
  const upsertMacro = useEngineStore((s) => s.upsertMacro);
  const [expanded, setExpanded] = useState(false);

  const addTarget = useCallback(
    (targetObj: (typeof MACRO_TARGETS)[number]) => {
      if (macro.targets.some((t) => t.target === targetObj.target)) return;
      upsertMacro({
        ...macro,
        targets: [
          ...macro.targets,
          { target: targetObj.target, min: targetObj.min, max: targetObj.max, curve: "linear" },
        ],
      });
    },
    [macro, upsertMacro]
  );

  const removeTarget = useCallback(
    (target: AutomationTarget) => {
      upsertMacro({
        ...macro,
        targets: macro.targets.filter((t) => t.target !== target),
      });
    },
    [macro, upsertMacro]
  );

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        {/* Knob */}
        <div className="flex flex-col items-center gap-0.5">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={macro.value}
            onChange={(e) => setMacroValue(macro.id, parseFloat(e.target.value))}
            className="h-16 w-4 cursor-pointer appearance-none"
            style={{ accentColor: "#8b5cf6", writingMode: "vertical-lr", direction: "rtl" }}
          />
          <span className="text-[9px] font-mono text-accent">{Math.round(macro.value * 100)}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-foreground truncate">{macro.name}</span>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[9px] text-muted hover:text-foreground px-1"
                title="Edit targets"
              >
                {expanded ? "▲" : "▼"}
              </button>
              <button
                onClick={() => removeMacro(macro.id)}
                className="text-[9px] text-muted hover:text-danger"
                title="Remove macro"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Targets summary */}
          <div className="text-[9px] text-muted mt-0.5 truncate">
            {macro.targets.length === 0
              ? "No targets — add below"
              : macro.targets
                  .map((t) => MACRO_TARGETS.find((m) => m.target === t.target)?.label ?? t.target)
                  .join(", ")}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1.5 border-t border-border pt-2">
          {/* Current targets */}
          {macro.targets.map((t) => {
            const info = MACRO_TARGETS.find((m) => m.target === t.target);
            return (
              <div key={t.target} className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-soft truncate">{info?.label ?? t.target}</span>
                <button
                  onClick={() => removeTarget(t.target)}
                  className="shrink-0 text-[9px] text-muted hover:text-danger"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {/* Add target dropdown */}
          <select
            value=""
            onChange={(e) => {
              const found = MACRO_TARGETS.find((t) => t.target === e.target.value);
              if (found) addTarget(found);
            }}
            className="w-full bg-surface-3 border border-border rounded px-1.5 py-0.5 text-[10px] text-muted"
          >
            <option value="">+ Add target…</option>
            {MACRO_TARGETS.filter(
              (t) => !macro.targets.some((existing) => existing.target === t.target)
            ).map((t) => (
              <option key={t.target} value={t.target}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function MacroPanel() {
  const macros = useEngineStore((s) => s.patterns[s.currentPattern]?.macros ?? []);
  const tracks = useEngineStore((s) => s.tracks);
  const upsertMacro = useEngineStore((s) => s.upsertMacro);

  const trackNames = tracks.map((t) => t.customSampleName ?? t.sound.name);

  const addMacro = useCallback(() => {
    const id = `macro-${Date.now()}`;
    upsertMacro({ id, name: `Macro ${macros.length + 1}`, value: 0, targets: [] });
  }, [macros.length, upsertMacro]);

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Macros</div>
          <div className="text-[11px] text-soft">Multi-target parameter modulators</div>
        </div>
        <button
          onClick={addMacro}
          disabled={macros.length >= 8}
          className="button-primary rounded-md px-2.5 py-1 text-[10px] font-bold disabled:opacity-40"
          title="Add macro (max 8)"
        >
          + Add
        </button>
      </div>

      {macros.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted">
          No macros yet. Add up to 8 multi-target knobs.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {macros.map((macro) => (
            <MacroKnob key={macro.id} macro={macro} trackNames={trackNames} />
          ))}
        </div>
      )}
    </div>
  );
}
