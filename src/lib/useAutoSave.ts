"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEngineStore } from "@/store/engine";

// Must match the key that SessionManager.tsx uses so both systems share one slot.
const AUTOSAVE_NAME = "__autosave__";
const AUTOSAVE_INTERVAL = 30_000;

export function useAutoSave() {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const save = useCallback(() => {
    try {
      const state = useEngineStore.getState();
      const hasContent = state.tracks.some((t) => t.steps.some((s) => s > 0));
      if (!hasContent) return;
      state.saveSession(AUTOSAVE_NAME);
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
      return useEngineStore.getState().getSavedSessions().includes(AUTOSAVE_NAME);
    } catch {
      return false;
    }
  }, []);

  const recoverAutosave = useCallback((): boolean => {
    try {
      return useEngineStore.getState().loadSession(AUTOSAVE_NAME);
    } catch {
      return false;
    }
  }, []);

  const clearAutosave = useCallback(() => {
    try {
      useEngineStore.getState().deleteSession(AUTOSAVE_NAME);
    } catch {}
  }, []);

  return { lastSaved, save, hasAutosave, recoverAutosave, clearAutosave };
}
