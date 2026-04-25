"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEngineStore } from "@/store/engine";

const AUTOSAVE_KEY = "sts_session___autosave";
const AUTOSAVE_INTERVAL = 30_000;

export function useAutoSave() {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const save = useCallback(() => {
    try {
      const state = useEngineStore.getState();
      const hasContent = state.tracks.some((t) => t.steps.some((s) => s > 0));
      if (!hasContent) return;

      const data = {
        bpm: state.bpm,
        swing: state.swing,
        totalSteps: state.totalSteps,
        currentPattern: state.currentPattern,
        tracks: state.tracks.map((t) => ({
          steps: t.steps,
          notes: t.notes,
          probabilities: t.probabilities,
          volume: t.volume,
          pan: t.pan,
          muted: t.muted,
          solo: t.solo,
          effects: t.effects,
          customSampleUrl: t.customSampleUrl,
          customSampleName: t.customSampleName,
          noteLength: t.noteLength,
          nudge: t.nudge,
        })),
        patterns: state.patterns.map((p) => ({
          name: p.name,
          steps: p.steps,
          probabilities: p.probabilities,
        })),
        chain: state.chain,
        songMode: state.songMode,
        master: state.master,
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      setLastSaved(new Date());
    } catch {}
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(save, AUTOSAVE_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [save]);

  const hasAutosave = useCallback((): boolean => {
    try {
      return localStorage.getItem(AUTOSAVE_KEY) !== null;
    } catch {
      return false;
    }
  }, []);

  const recoverAutosave = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      return useEngineStore.getState().loadSession("__autosave");
    } catch {
      return false;
    }
  }, []);

  const clearAutosave = useCallback(() => {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch {}
  }, []);

  return { lastSaved, save, hasAutosave, recoverAutosave, clearAutosave };
}
