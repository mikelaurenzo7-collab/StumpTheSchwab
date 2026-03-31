"use client";

import { usePatternStore } from "@/store/patterns";
import { useCallback, useEffect, useRef, useState, memo } from "react";

// ── Pattern Slot ──────────────────────────────────────────────
const PatternSlot = memo(function PatternSlot({
  id,
  name,
  isActive,
  onLoad,
  onOverwrite,
  onDelete,
  onRename,
}: {
  id: string;
  name: string;
  isActive: boolean;
  onLoad: (id: string) => void;
  onOverwrite: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== name) {
      onRename(id, trimmed);
    } else {
      setEditName(name);
    }
    setEditing(false);
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded group transition-colors ${
        isActive
          ? "bg-accent/20 border border-accent/40"
          : "bg-surface-2 border border-transparent hover:border-border"
      }`}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setEditName(name);
              setEditing(false);
            }
          }}
          className="bg-transparent text-xs text-foreground outline-none border-b border-accent w-20 font-medium"
        />
      ) : (
        <button
          onClick={() => onLoad(id)}
          onDoubleClick={() => {
            setEditName(name);
            setEditing(true);
          }}
          className="text-xs font-medium text-foreground truncate max-w-[80px] text-left"
          title={`Load "${name}" (double-click to rename)`}
        >
          {name}
        </button>
      )}

      {/* Overwrite */}
      {isActive && (
        <button
          onClick={() => onOverwrite(id)}
          className="text-[10px] text-muted hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
          title="Overwrite with current state"
        >
          save
        </button>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(id)}
        className="text-[10px] text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100 ml-auto"
        title="Delete pattern"
      >
        ✕
      </button>
    </div>
  );
});

// ── Pattern Bank ──────────────────────────────────────────────
export function PatternBank() {
  const patterns = usePatternStore((s) => s.patterns);
  const activePatternId = usePatternStore((s) => s.activePatternId);
  const savePattern = usePatternStore((s) => s.savePattern);
  const overwritePattern = usePatternStore((s) => s.overwritePattern);
  const loadPattern = usePatternStore((s) => s.loadPattern);
  const deletePattern = usePatternStore((s) => s.deletePattern);
  const renamePattern = usePatternStore((s) => s.renamePattern);
  const hydrate = usePatternStore((s) => s._hydrate);

  // Hydrate from localStorage on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const saveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSave) saveInputRef.current?.focus();
  }, [showSave]);

  const handleSave = useCallback(() => {
    const name = saveName.trim() || `Pattern ${patterns.length + 1}`;
    savePattern(name);
    setSaveName("");
    setShowSave(false);
  }, [saveName, patterns.length, savePattern]);

  const handleLoad = useCallback(
    (id: string) => loadPattern(id),
    [loadPattern]
  );
  const handleOverwrite = useCallback(
    (id: string) => overwritePattern(id),
    [overwritePattern]
  );
  const handleDelete = useCallback(
    (id: string) => deletePattern(id),
    [deletePattern]
  );
  const handleRename = useCallback(
    (id: string, name: string) => renamePattern(id, name),
    [renamePattern]
  );

  return (
    <div className="border-t border-border bg-surface px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted uppercase tracking-wider shrink-0">
          Patterns
        </span>

        {/* Pattern slots */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
          {patterns.map((p) => (
            <PatternSlot
              key={p.id}
              id={p.id}
              name={p.name}
              isActive={p.id === activePatternId}
              onLoad={handleLoad}
              onOverwrite={handleOverwrite}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}

          {patterns.length === 0 && (
            <span className="text-[10px] text-muted/50 italic">
              No saved patterns
            </span>
          )}
        </div>

        {/* Save new */}
        {showSave ? (
          <div className="flex items-center gap-1 shrink-0">
            <input
              ref={saveInputRef}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setSaveName("");
                  setShowSave(false);
                }
              }}
              placeholder={`Pattern ${patterns.length + 1}`}
              className="w-24 bg-surface-2 border border-border rounded px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleSave}
              className="px-2 py-0.5 rounded bg-accent hover:bg-accent-hover text-white text-[10px] font-medium transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setSaveName("");
                setShowSave(false);
              }}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSave(true)}
            className="px-2.5 py-1 rounded bg-surface-2 hover:bg-accent/20 text-muted hover:text-accent text-[10px] uppercase tracking-wider font-medium transition-colors shrink-0"
          >
            + Save
          </button>
        )}
      </div>
    </div>
  );
}
