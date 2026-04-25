"use client";

import { useEngineStore } from "@/store/engine";

export function GroovePanel() {
  const {
    grooveTemplates,
    activeGroove,
    globalVelocityHumanize,
    globalTimingHumanize,
    currentPattern,
    setActiveGroove,
    applyGrooveToPattern,
    setGlobalHumanization,
  } = useEngineStore();

  const activeTemplate = grooveTemplates.find((g) => g.id === activeGroove);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[#0a0f18]/80 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Groove & Feel</h3>
        {activeGroove && activeGroove !== "none" && (
          <button
            onClick={() => setActiveGroove(null)}
            className="rounded px-2 py-1 text-xs text-white/60 hover:bg-white/5 hover:text-white/90"
          >
            Clear
          </button>
        )}
      </div>

      {/* Groove Template Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-white/70">Template</label>
        <select
          value={activeGroove ?? "none"}
          onChange={(e) => setActiveGroove(e.target.value === "none" ? null : e.target.value)}
          className="rounded border border-white/10 bg-[#070b12] px-3 py-2 text-sm text-white/90 hover:border-white/20 focus:border-teal-400/50 focus:outline-none"
        >
          {grooveTemplates.map((groove) => (
            <option key={groove.id} value={groove.id}>
              {groove.name}
            </option>
          ))}
        </select>
      </div>

      {/* Active Groove Details */}
      {activeTemplate && activeTemplate.id !== "none" && (
        <div className="rounded border border-white/5 bg-white/[0.02] p-3 text-xs text-white/70">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-white/90">{activeTemplate.name}</span>
            <button
              onClick={() => applyGrooveToPattern(currentPattern, activeTemplate.id)}
              className="rounded bg-teal-500/20 px-2 py-1 text-teal-400 hover:bg-teal-500/30"
            >
              Apply to Pattern
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>Swing: {Math.round(activeTemplate.swing * 100)}%</div>
            <div>Vel Var: {Math.round(activeTemplate.velocityVariation * 100)}%</div>
            <div className="col-span-2">
              Timing Var: {Math.round(activeTemplate.timingVariation * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* Global Humanization */}
      <div className="flex flex-col gap-3 border-t border-white/5 pt-3">
        <div className="text-xs font-medium text-white/70">Global Humanization</div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Velocity</span>
            <span className="text-white/80">{Math.round(globalVelocityHumanize * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={globalVelocityHumanize}
            onChange={(e) =>
              setGlobalHumanization(parseFloat(e.target.value), globalTimingHumanize)
            }
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-teal-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Timing</span>
            <span className="text-white/80">{Math.round(globalTimingHumanize * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={globalTimingHumanize}
            onChange={(e) =>
              setGlobalHumanization(globalVelocityHumanize, parseFloat(e.target.value))
            }
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-teal-400"
          />
        </div>
      </div>

      <div className="text-xs text-white/50">
        <div className="mb-1 font-medium">Tips:</div>
        <ul className="ml-3 list-disc space-y-0.5 text-[11px]">
          <li>Templates set swing and humanization presets</li>
          <li>&quot;Apply to Pattern&quot; bakes groove into step data</li>
          <li>Global controls affect live playback only</li>
        </ul>
      </div>
    </div>
  );
}
