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
        className="button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs uppercase tracking-wider"
      >
        <span className="h-2 w-2 rounded-full bg-cyan shadow-[0_0_12px_rgba(94,234,212,0.8)]" />
        Sessions
      </button>

      {/* Flash notification */}
      {flash && (
        <div className="button-primary absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded-xl px-2 py-1 text-xs shadow-accent-soft">
          {flash}
        </div>
      )}

      {/* Panel */}
      {showPanel && (
        <div className="panel absolute right-0 top-full z-50 mt-2 flex w-80 flex-col gap-3 rounded-[1.45rem] p-3">
          <div className="rounded-[1.1rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02)),rgba(10,16,24,0.72)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan">
                  Session vault
                </p>
                <h3 className="mt-1 text-sm font-black tracking-tight text-white">
                  Save takes, recover ideas fast
                </h3>
              </div>
              <span className="pill-badge rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em]">
                {sessions.length} saved
              </span>
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-1.5">
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
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-[1.1rem] border border-white/[0.06] bg-black/15 p-1.5">
              {sessions.map((name) => (
                <div
                  key={name}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015)),rgba(8,12,18,0.65)] px-2.5 py-2 hover:border-cyan/20 hover:bg-white/[0.08]"
                >
                  <button
                    onClick={() => handleLoad(name)}
                    className="flex-1 truncate text-left"
                  >
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {name}
                    </span>
                    <span className="block text-[9px] uppercase tracking-[0.16em] text-muted/70">
                      Click to load
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(name)}
                    className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted/0 transition-colors group-hover:text-muted hover:bg-danger/15 hover:text-danger"
                  >
                    Del
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.1rem] border border-dashed border-white/10 bg-black/10 px-4 py-5 text-center text-xs text-muted">
              No saved sessions yet
            </div>
          )}

          <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.16em] text-muted/60">
            <span>Autosaving every 10s</span>
            <span>Local only</span>
          </div>
        </div>
      )}
    </div>
  );
}
