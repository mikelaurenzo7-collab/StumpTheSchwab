import { useEffect } from 'react';
import { useEngine } from '../store/engine';

export function useKeyboardShortcuts(toggle: () => void, exportWav: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const mod = e.metaKey || e.ctrlKey;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          toggle();
          break;
        case 'z':
          if (mod && !e.shiftKey) { e.preventDefault(); useEngine.getState().undo(); }
          if (mod && e.shiftKey) { e.preventDefault(); useEngine.getState().redo(); }
          break;
        case 'y':
          if (mod) { e.preventDefault(); useEngine.getState().redo(); }
          break;
        case 'r':
          if (!mod) { e.preventDefault(); useEngine.getState().regenerate(); }
          break;
        case 'f':
          if (!mod) { e.preventDefault(); useEngine.getState().mutate(); }
          break;
        case 'e':
          if (mod) { e.preventDefault(); exportWav(); }
          break;
        case 'ArrowUp':
          e.preventDefault();
          useEngine.getState().setBpm(Math.min(178, useEngine.getState().bpm + 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          useEngine.getState().setBpm(Math.max(72, useEngine.getState().bpm - 1));
          break;
        case '1': case '2': case '3': case '4': case '5': case '6': {
          if (mod) break;
          const idx = parseInt(e.key) - 1;
          const tracks = useEngine.getState().tracks;
          if (tracks[idx]) {
            useEngine.getState().setTrackMuted(tracks[idx].id, !tracks[idx].muted);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, exportWav]);
}
