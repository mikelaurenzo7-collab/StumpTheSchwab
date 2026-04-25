"use client";

import { useEngineStore, type AutomationLane, type AutomationTarget } from "@/store/engine";
import { useState, useRef, useCallback, useEffect } from "react";

export function AutomationEditor() {
  const {
    patterns,
    currentPattern,
    selectedAutomationLane,
    addAutomationLane,
    removeAutomationLane,
    toggleAutomationLane,
    selectAutomationLane,
  } = useEngineStore();

  const currentPatternData = patterns[currentPattern];
  const automationLanes = currentPatternData?.automation ?? [];

  const [showAddLane, setShowAddLane] = useState(false);
  const [newTarget, setNewTarget] = useState<AutomationTarget>("master.volume");

  const handleAddLane = () => {
    const presets: Record<AutomationTarget, { min: number; max: number }> = {
      "bpm": { min: 60, max: 180 },
      "master.volume": { min: 0, max: 1 },
      "track.0.volume": { min: 0, max: 1 },
      "track.0.pan": { min: -1, max: 1 },
      "track.0.effects.filterFreq": { min: 100, max: 20000 },
      "track.0.effects.delayWet": { min: 0, max: 1 },
      "track.0.effects.reverbWet": { min: 0, max: 1 },
      "track.1.volume": { min: 0, max: 1 },
      "track.1.pan": { min: -1, max: 1 },
      "track.1.effects.filterFreq": { min: 100, max: 20000 },
      "track.1.effects.delayWet": { min: 0, max: 1 },
      "track.1.effects.reverbWet": { min: 0, max: 1 },
      "track.2.volume": { min: 0, max: 1 },
      "track.2.pan": { min: -1, max: 1 },
      "track.2.effects.filterFreq": { min: 100, max: 20000 },
      "track.2.effects.delayWet": { min: 0, max: 1 },
      "track.2.effects.reverbWet": { min: 0, max: 1 },
      "track.3.volume": { min: 0, max: 1 },
      "track.3.pan": { min: -1, max: 1 },
      "track.3.effects.filterFreq": { min: 100, max: 20000 },
      "track.3.effects.delayWet": { min: 0, max: 1 },
      "track.3.effects.reverbWet": { min: 0, max: 1 },
      "track.4.volume": { min: 0, max: 1 },
      "track.4.pan": { min: -1, max: 1 },
      "track.4.effects.filterFreq": { min: 100, max: 20000 },
      "track.4.effects.delayWet": { min: 0, max: 1 },
      "track.4.effects.reverbWet": { min: 0, max: 1 },
      "track.5.volume": { min: 0, max: 1 },
      "track.5.pan": { min: -1, max: 1 },
      "track.5.effects.filterFreq": { min: 100, max: 20000 },
      "track.5.effects.delayWet": { min: 0, max: 1 },
      "track.5.effects.reverbWet": { min: 0, max: 1 },
      "track.6.volume": { min: 0, max: 1 },
      "track.6.pan": { min: -1, max: 1 },
      "track.6.effects.filterFreq": { min: 100, max: 20000 },
      "track.6.effects.delayWet": { min: 0, max: 1 },
      "track.6.effects.reverbWet": { min: 0, max: 1 },
      "track.7.volume": { min: 0, max: 1 },
      "track.7.pan": { min: -1, max: 1 },
      "track.7.effects.filterFreq": { min: 100, max: 20000 },
      "track.7.effects.delayWet": { min: 0, max: 1 },
      "track.7.effects.reverbWet": { min: 0, max: 1 },
    };

    const range = presets[newTarget] ?? { min: 0, max: 1 };
    addAutomationLane(currentPattern, newTarget, range.min, range.max);
    setShowAddLane(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#0a0f18]/80 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Automation</h3>
        <button
          onClick={() => setShowAddLane(!showAddLane)}
          className="rounded bg-teal-500/20 px-3 py-1.5 text-xs text-teal-400 hover:bg-teal-500/30"
        >
          + Add Lane
        </button>
      </div>

      {/* Add Lane Form */}
      {showAddLane && (
        <div className="flex flex-col gap-2 rounded border border-teal-400/20 bg-teal-500/5 p-3">
          <label className="text-xs font-medium text-white/80">Parameter</label>
          <select
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value as AutomationTarget)}
            className="rounded border border-white/10 bg-[#070b12] px-2 py-1.5 text-sm text-white/90"
          >
            <option value="bpm">Global BPM</option>
            <option value="master.volume">Master Volume</option>
            <optgroup label="Track 0 (Kick)">
              <option value="track.0.volume">Volume</option>
              <option value="track.0.pan">Pan</option>
              <option value="track.0.effects.filterFreq">Filter Freq</option>
              <option value="track.0.effects.delayWet">Delay Wet</option>
              <option value="track.0.effects.reverbWet">Reverb Wet</option>
            </optgroup>
            <optgroup label="Track 1 (Snare)">
              <option value="track.1.volume">Volume</option>
              <option value="track.1.pan">Pan</option>
              <option value="track.1.effects.filterFreq">Filter Freq</option>
              <option value="track.1.effects.delayWet">Delay Wet</option>
              <option value="track.1.effects.reverbWet">Reverb Wet</option>
            </optgroup>
            {/* Add more tracks as needed */}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAddLane}
              className="flex-1 rounded bg-teal-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600"
            >
              Create
            </button>
            <button
              onClick={() => setShowAddLane(false)}
              className="flex-1 rounded bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Automation Lanes List */}
      <div className="flex flex-col gap-2">
        {automationLanes.length === 0 ? (
          <div className="rounded border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
            No automation lanes yet. Add one to get started.
          </div>
        ) : (
          automationLanes.map((lane) => (
            <AutomationLaneItem
              key={lane.id}
              lane={lane}
              patternIndex={currentPattern}
              isSelected={selectedAutomationLane === lane.id}
              onSelect={() => selectAutomationLane(lane.id)}
              onToggle={() => toggleAutomationLane(currentPattern, lane.id)}
              onRemove={() => removeAutomationLane(currentPattern, lane.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface AutomationLaneItemProps {
  lane: AutomationLane;
  patternIndex: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

function AutomationLaneItem({
  lane,
  patternIndex,
  isSelected,
  onSelect,
  onToggle,
  onRemove,
}: AutomationLaneItemProps) {
  const { addAutomationPoint, removeAutomationPoint } = useEngineStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatTarget = (target: string) => {
    return target
      .replace("track.", "Trk ")
      .replace("effects.", "")
      .replace("master.", "Master ");
  };

  const formatValue = (value: number, target: string) => {
    if (target.includes("filterFreq")) return `${Math.round(value)} Hz`;
    if (target.includes("pan")) return value.toFixed(2);
    if (target === "bpm") return `${Math.round(value)} BPM`;
    return value.toFixed(2);
  };

  // Draw automation curve
  const drawCurve = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw automation curve
    if (lane.points.length < 2) return;

    ctx.strokeStyle = lane.enabled ? "rgba(94, 234, 212, 0.8)" : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sortedPoints = [...lane.points].sort((a, b) => a.position - b.position);

    sortedPoints.forEach((point, i) => {
      const x = point.position * width;
      const normalized = (point.value - lane.min) / (lane.max - lane.min);
      const y = height - normalized * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    sortedPoints.forEach((point) => {
      const x = point.position * width;
      const normalized = (point.value - lane.min) / (lane.max - lane.min);
      const y = height - normalized * height;

      ctx.fillStyle = lane.enabled ? "rgba(94, 234, 212, 1)" : "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [lane]);

  // Redraw whenever points or enabled state changes
  useEffect(() => {
    drawCurve();
  }, [drawCurve]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const position = x / rect.width;
    const normalized = 1 - y / rect.height;
    const value = lane.min + normalized * (lane.max - lane.min);

    addAutomationPoint(patternIndex, lane.id, position, value);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Find closest point
    let closestIdx = -1;
    let closestDist = Infinity;

    lane.points.forEach((point, i) => {
      const pointX = point.position * rect.width;
      const dist = Math.abs(x - pointX);
      if (dist < closestDist && dist < 10) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    if (closestIdx !== -1 && lane.points.length > 2) {
      removeAutomationPoint(patternIndex, lane.id, closestIdx);
    }
  };

  return (
    <div
      className={`flex flex-col gap-2 rounded border p-3 ${
        isSelected
          ? "border-teal-400/50 bg-teal-500/5"
          : lane.enabled
            ? "border-white/10 bg-white/[0.02]"
            : "border-white/5 bg-white/[0.01] opacity-50"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`h-5 w-5 rounded ${
              lane.enabled ? "bg-teal-500" : "bg-white/20"
            } flex items-center justify-center text-xs`}
          >
            {lane.enabled && "✓"}
          </button>
          <span className="text-sm font-medium text-white/90">{formatTarget(lane.target)}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded px-2 py-1 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
        >
          Remove
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={300}
        height={80}
        className="w-full cursor-crosshair rounded border border-white/10 bg-black/20"
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
      />

      <div className="flex items-center justify-between text-xs text-white/60">
        <span>{formatValue(lane.min, lane.target)}</span>
        <span>{lane.points.length} points</span>
        <span>{formatValue(lane.max, lane.target)}</span>
      </div>
    </div>
  );
}
