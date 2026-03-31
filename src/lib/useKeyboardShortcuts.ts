"use client";

import { useEffect, useRef } from "react";
import { useEngineStore } from "@/store/engine";

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

export function useKeyboardShortcuts(onInit: () => Promise<void>) {
  const initRef = useRef(onInit);
  useEffect(() => {
    initRef.current = onInit;
  }, [onInit]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Undo: Ctrl/Cmd+Z (no shift)
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        useEngineStore.getState().undo();
        return;
      }

      // Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
      if ((mod && e.key === "z" && e.shiftKey) || (mod && e.key === "y")) {
        e.preventDefault();
        useEngineStore.getState().redo();
        return;
      }

      // Skip remaining shortcuts if user is typing in an input
      if (isInputFocused()) return;

      // Space: play/pause toggle
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        const state = useEngineStore.getState();
        initRef.current().then(() => {
          if (state.playbackState === "playing") {
            state.pause();
          } else {
            state.play();
          }
        });
        return;
      }

      // Escape: stop
      if (e.key === "Escape") {
        e.preventDefault();
        initRef.current().then(() => {
          useEngineStore.getState().stop();
        });
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
