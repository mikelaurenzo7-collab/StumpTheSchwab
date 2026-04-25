"use client";

import { useEngineStore, PATTERN_LABELS } from "@/store/engine";
import { useState } from "react";

export function PerformanceMode() {
  const {
    patterns,
    scenes,
    performanceMode,
    activeScenes,
    playbackState,
    setPerformanceMode,
    createScene,
    deleteScene,
    triggerScene,
    stopScene,
  } = useEngineStore();

  const [showCreateScene, setShowCreateScene] = useState(false);
  const [newSceneName, setNewSceneName] = useState("");
  const [newSceneSlots, setNewSceneSlots] = useState<(number | null)[]>(
    Array(8).fill(null)
  );
  const [newSceneDuration, setNewSceneDuration] = useState(4);

  const handleCreateScene = () => {
    if (!newSceneName.trim()) return;
    createScene(newSceneName, newSceneSlots, newSceneDuration);
    setNewSceneName("");
    setNewSceneSlots(Array(8).fill(null));
    setNewSceneDuration(4);
    setShowCreateScene(false);
  };

  const handleTrigger = (sceneId: string) => {
    if (activeScenes.has(sceneId)) {
      stopScene(sceneId);
    } else {
      triggerScene(sceneId);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[#0a0f18]/80 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white/90">Performance Mode</h3>
          <button
            onClick={() => setPerformanceMode(!performanceMode)}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              performanceMode
                ? "bg-orange-500 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {performanceMode ? "ON" : "OFF"}
          </button>
        </div>
        <button
          onClick={() => setShowCreateScene(!showCreateScene)}
          className="rounded bg-teal-500/20 px-3 py-1.5 text-xs text-teal-400 hover:bg-teal-500/30"
        >
          + New Scene
        </button>
      </div>

      {!performanceMode && (
        <div className="rounded border border-dashed border-white/10 p-6 text-center text-sm text-white/50">
          Enable Performance Mode to trigger scenes live during playback
        </div>
      )}

      {/* Create Scene Form */}
      {showCreateScene && (
        <div className="flex flex-col gap-3 rounded border border-orange-400/20 bg-orange-500/5 p-4">
          <label className="text-xs font-medium text-white/80">Scene Name</label>
          <input
            type="text"
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            placeholder="e.g., Verse, Chorus, Drop"
            className="rounded border border-white/10 bg-[#070b12] px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-orange-400/50 focus:outline-none"
          />

          <label className="text-xs font-medium text-white/80">Pattern Slots</label>
          <div className="grid grid-cols-8 gap-2">
            {newSceneSlots.map((slot, idx) => (
              <select
                key={idx}
                value={slot === null ? "" : slot}
                onChange={(e) => {
                  const value = e.target.value === "" ? null : parseInt(e.target.value);
                  const updated = [...newSceneSlots];
                  updated[idx] = value;
                  setNewSceneSlots(updated);
                }}
                className="rounded border border-white/10 bg-[#070b12] px-2 py-1.5 text-xs text-white/90"
              >
                <option value="">—</option>
                {patterns.map((_, i) => (
                  <option key={i} value={i}>
                    {PATTERN_LABELS[i]}
                  </option>
                ))}
              </select>
            ))}
          </div>

          <label className="text-xs font-medium text-white/80">Duration (bars)</label>
          <input
            type="number"
            min="1"
            max="32"
            value={newSceneDuration}
            onChange={(e) => setNewSceneDuration(parseInt(e.target.value))}
            className="w-24 rounded border border-white/10 bg-[#070b12] px-3 py-2 text-sm text-white/90 focus:border-orange-400/50 focus:outline-none"
          />

          <div className="flex gap-2">
            <button
              onClick={handleCreateScene}
              className="flex-1 rounded bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600"
            >
              Create Scene
            </button>
            <button
              onClick={() => setShowCreateScene(false)}
              className="flex-1 rounded bg-white/10 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Scene Launcher Grid */}
      {performanceMode && (
        <div className="flex flex-col gap-2">
          {scenes.length === 0 ? (
            <div className="rounded border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
              No scenes yet. Create your first scene to start performing.
            </div>
          ) : (
            scenes.map((scene) => {
              const isActive = activeScenes.has(scene.id);
              const isPlaying = playbackState === "playing";

              return (
                <div
                  key={scene.id}
                  className={`flex items-center gap-3 rounded border p-3 transition-colors ${
                    isActive
                      ? "border-orange-400/50 bg-orange-500/10"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    onClick={() => handleTrigger(scene.id)}
                    disabled={!isPlaying}
                    className={`flex h-12 w-12 items-center justify-center rounded font-bold transition-all ${
                      !isPlaying
                        ? "cursor-not-allowed bg-white/5 text-white/30"
                        : isActive
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    {isActive ? "■" : "▶"}
                  </button>

                  <div className="flex-1">
                    <div className="text-sm font-medium text-white/90">{scene.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
                      <span>
                        {scene.patternSlots.filter((s) => s !== null).length}{" "}
                        {scene.patternSlots.filter((s) => s !== null).length === 1
                          ? "pattern"
                          : "patterns"}
                      </span>
                      <span>•</span>
                      <span>
                        {scene.duration} {scene.duration === 1 ? "bar" : "bars"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      {scene.patternSlots.map((slot, idx) =>
                        slot !== null ? (
                          <span
                            key={idx}
                            className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] text-teal-400"
                          >
                            {PATTERN_LABELS[slot]}
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteScene(scene.id)}
                    className="rounded px-2 py-1 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="mt-2 text-xs text-white/50">
        <div className="mb-1 font-medium">Performance Tips:</div>
        <ul className="ml-3 list-disc space-y-0.5 text-[11px]">
          <li>Scenes trigger patterns across multiple tracks simultaneously</li>
          <li>Press play first, then click scene buttons to trigger</li>
          <li>Click again to stop a scene</li>
          <li>Use keyboard 1-8 to trigger first 8 scenes (coming soon)</li>
        </ul>
      </div>
    </div>
  );
}
