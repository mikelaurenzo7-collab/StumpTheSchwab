"use client";

import { useEngineStore } from "@/store/engine";
import { useState, useEffect, useCallback, useRef } from "react";

const AUTOSAVE_KEY = "__autosave__";
const AUTOSAVE_INTERVAL = 10_000; // 10 seconds

export function SessionManager() {
  const saveSession = useEngineStore((s) => s.saveSession);
  const loadSession = useEngineStore((s) => s.loadSession);
  const deleteSession = useEngineStore((s) => s.deleteSession);
  const getSavedSessions = useEngineStore((s) => s.getSavedSessions);

  const [showPanel, setShowPanel] = useState(false);
  const [sessions, setSessions] = useState<string[]>([]);
  const [saveName, setSaveName] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refreshSessions = useCallback(() => {
    setSessions(getSavedSessions().filter((n) => n !== AUTOSAVE_KEY));
  }, [getSavedSessions]);

  // Autosave on interval
  useEffect(() => {
    const interval = setInterval(() => {
      saveSession(AUTOSAVE_KEY);
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [saveSession]);

  // Load autosave on mount
  useEffect(() => {
    loadSession(AUTOSAVE_KEY);
  }, [loadSession]);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 2000);
  }, []);

  const handleSave = useCallback(() => {
    const name = saveName.trim();
    if (!name) return;
    saveSession(name);
    setSaveName("");
    refreshSessions();
    showFlash(`Saved "${name}"`);
  }, [saveName, saveSession, refreshSessions, showFlash]);

  const handleLoad = useCallback(
    (name: string) => {
      const ok = loadSession(name);
      if (ok) showFlash(`Loaded "${name}"`);
      else showFlash("Failed to load session");
    },
    [loadSession, showFlash]
  );

  const handleDelete = useCallback(
    (name: string) => {
      deleteSession(name);
      refreshSessions();
      showFlash(`Deleted "${name}"`);
    },
    [deleteSession, refreshSessions, showFlash]
  );

  return (
    <div className="relative">
      <button
        onClick={() => {
          setShowPanel(!showPanel);
          if (!showPanel) refreshSessions();
        }}
        className="px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground text-xs uppercase tracking-wider transition-colors"
      >
        Sessions
      </button>

      {/* Flash notification */}
      {flash && (
        <div
          className="absolute top-full mt-2 right-0 px-3 py-1.5 text-white text-xs rounded-lg whitespace-nowrap z-50 font-medium"
          style={{ backgroundColor: "var(--accent)", boxShadow: "0 0 16px var(--accent-glow)", animation: "fade-in-up 0.15s ease-out both" }}
        >
          {flash}
        </div>
      )}

      {/* Panel */}
      {showPanel && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-surface border border-border/70 rounded-xl shadow-2xl z-50 p-3 flex flex-col gap-3" style={{ animation: "fade-in-up 0.18s ease-out both" }}>
          {/* Save */}
          <div className="flex gap-1">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Session name..."
              className="flex-1 bg-surface-2 border border-border rounded px-2 py-1 text-xs text-foreground placeholder-muted focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="px-2 py-1 bg-accent hover:bg-accent-hover disabled:opacity-30 text-white text-xs rounded transition-colors"
            >
              Save
            </button>
          </div>

          {/* Saved sessions list */}
          {sessions.length > 0 ? (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {sessions.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-1 px-2.5 py-1.5 bg-surface-2 rounded-lg hover:bg-surface-3 group border border-transparent hover:border-border/40 transition-all"
                >
                  <button
                    onClick={() => handleLoad(name)}
                    className="flex-1 text-left text-xs text-foreground truncate"
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => handleDelete(name)}
                    className="text-muted/0 group-hover:text-muted hover:text-danger text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted text-center py-2">
              No saved sessions yet
            </span>
          )}

          <div className="text-[9px] text-muted/50 text-center">
            Autosaving every 10s
          </div>
        </div>
      )}
    </div>
  );
}
