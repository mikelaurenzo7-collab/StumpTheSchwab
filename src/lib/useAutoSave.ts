import { useEffect, useRef } from 'react';
import { useEngine, type Snapshot } from '../store/engine';

const STORAGE_KEY = 'sts-session';

export function useAutoSave() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: Snapshot = JSON.parse(raw);
        if (data.tracks?.length) {
          useEngine.getState().loadSession(data);
        }
      }
    } catch {
      // ignore corrupted data
    }
  }, []);

  useEffect(() => {
    let timeout: number;
    const unsub = useEngine.subscribe(() => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        try {
          const snap = useEngine.getState().getSnapshot();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
        } catch {
          // storage full
        }
      }, 500);
    });

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);
}
