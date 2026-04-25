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
        className="button-secondary rounded-xl px-3 py-1.5 text-xs uppercase tracking-wider"
      >
        Sessions
      </button>

      {/* Flash notification */}
      {flash && (
        <div className="button-primary absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded-xl px-2 py-1 text-xs">
          {flash}
        </div>
      )}

      {/* Panel */}
      {showPanel && (
        <div className="panel absolute right-0 top-full z-50 mt-2 flex w-72 flex-col gap-3 rounded-[1.35rem] p-3">
          {/* Save */}
          <div className="flex gap-1">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Session name..."
              className="control-input flex-1 rounded-xl px-3 py-2 text-xs"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="button-primary rounded-xl px-3 py-2 text-xs font-bold"
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
                  className="group flex items-center justify-between gap-1 rounded-xl border border-white/[0.06] bg-white/[0.04] px-2 py-1.5 hover:bg-white/[0.08]"
                >
                  <button
                    onClick={() => handleLoad(name)}
                    className="flex-1 truncate text-left text-xs text-foreground"
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
