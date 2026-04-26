"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEngineStore, MAX_PATTERNS } from "@/store/engine";
import { useUiStore } from "@/store/ui";
import { useHistoryStore } from "@/store/history";
import { useExport } from "@/lib/useExport";

interface CommandPaletteProps {
  onInit: () => Promise<void>;
}

interface Action {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string;
  run: () => void | Promise<void>;
}

const PATTERN_LETTERS = "ABCDEFGH";

/**
 * Cmd/Ctrl+K command palette — searchable action menu.
 * Pulls actions live from the stores so labels reflect current state.
 */
export function CommandPalette({ onInit }: CommandPaletteProps) {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const { exportWAV } = useExport();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Build action list lazily via getState() so we don't subscribe to everything.
  const actions = useMemo<Action[]>(() => {
    if (!open) return [];
    const eng = useEngineStore.getState();
    const ui = useUiStore.getState();
    const hist = useHistoryStore.getState();

    const acts: Action[] = [
      {
        id: "transport.toggle",
        group: "Transport",
        label: eng.playbackState === "playing" ? "Pause" : "Play",
        hint: "Space",
        run: async () => {
          await onInit();
          if (useEngineStore.getState().playbackState === "playing") {
            useEngineStore.getState().pause();
          } else {
            useEngineStore.getState().play();
          }
        },
      },
      {
        id: "transport.stop",
        group: "Transport",
        label: "Stop",
        hint: "Esc",
        run: () => useEngineStore.getState().stop(),
      },
      {
        id: "transport.bpmUp",
        group: "Transport",
        label: `BPM +1 (${eng.bpm} → ${eng.bpm + 1})`,
        hint: "↑",
        run: () => useEngineStore.getState().setBpm(useEngineStore.getState().bpm + 1),
      },
      {
        id: "transport.bpmDown",
        group: "Transport",
        label: `BPM −1 (${eng.bpm} → ${eng.bpm - 1})`,
        hint: "↓",
        run: () => useEngineStore.getState().setBpm(useEngineStore.getState().bpm - 1),
      },
      {
        id: "edit.undo",
        group: "Edit",
        label: "Undo",
        hint: "⌘Z",
        run: () => hist.undo(),
      },
      {
        id: "edit.redo",
        group: "Edit",
        label: "Redo",
        hint: "⌘⇧Z",
        run: () => hist.redo(),
      },
      {
        id: "edit.clear",
        group: "Edit",
        label: "Clear all steps",
        keywords: "wipe reset zero",
        run: () => useEngineStore.getState().clearAll(),
      },
      {
        id: "edit.humanize",
        group: "Edit",
        label: "Humanize all tracks",
        hint: "H",
        keywords: "groove swing nudge",
        run: () => useEngineStore.getState().humanize(null, 0.15),
      },
      {
        id: "ai.generate",
        group: "AI",
        label: "Generate beat with AI",
        hint: "G",
        keywords: "claude prompt write compose",
        run: () => ui.setGeneratorOpen(true),
      },
      {
        id: "view.help",
        group: "View",
        label: ui.helpOpen ? "Close help overlay" : "Open help overlay",
        hint: "?",
        keywords: "shortcuts keys docs",
        run: () => ui.toggleHelp(),
      },
      {
        id: "export.wav",
        group: "Export",
        label: "Export pattern as WAV (2× loops)",
        keywords: "render bounce mixdown audio",
        run: () => {
          setOpen(false);
          void exportWAV(2);
        },
      },
      {
        id: "song.toggle",
        group: "Song",
        label: eng.songMode ? "Disable song mode" : "Enable song mode",
        keywords: "chain arrange",
        run: () => useEngineStore.getState().setSongMode(!useEngineStore.getState().songMode),
      },
    ];

    // Pattern switchers A..H
    for (let i = 0; i < MAX_PATTERNS; i++) {
      acts.push({
        id: `pattern.${i}`,
        group: "Patterns",
        label: `Switch to pattern ${PATTERN_LETTERS[i]}${eng.currentPattern === i ? " (current)" : ""}`,
        hint: `${i + 1}`,
        keywords: `pattern ${PATTERN_LETTERS[i].toLowerCase()}`,
        run: () => useEngineStore.getState().setCurrentPattern(i),
      });
    }

    // Per-track piano roll openers
    eng.tracks.forEach((t, idx) => {
      acts.push({
        id: `pianoroll.${idx}`,
        group: "Tracks",
        label: `Open piano roll: ${t.sound.name}`,
        keywords: `melody notes track ${idx + 1}`,
        run: () => useEngineStore.getState().setPianoRollTrack(idx),
      });
    });

    return acts;
  }, [open, onInit, exportWAV, setOpen]);

  // Fuzzy filter — simple substring across label + keywords + group.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    const tokens = q.split(/\s+/);
    return actions.filter((a) => {
      const hay = `${a.label} ${a.group} ${a.keywords ?? ""}`.toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [actions, query]);

  // Reset state when (re)opened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Defer focus so the input is mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clamp active index when filter changes.
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIdx]);

  // Scroll active item into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  if (!open) return null;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const action = filtered[activeIdx];
      if (action) {
        setOpen(false);
        void action.run();
      }
    }
  };

  // Group items for rendering, but keep linear index for keyboard nav.
  const grouped = filtered.reduce<Record<string, { action: Action; idx: number }[]>>(
    (acc, a, i) => {
      (acc[a.group] ??= []).push({ action: a, idx: i });
      return acc;
    },
    {},
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-border-strong bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
          <span className="text-[11px] font-mono text-muted">⌘K</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKey}
            placeholder="Type a command…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="text-[10px] font-mono text-muted">
            {filtered.length}/{actions.length}
          </span>
        </div>

        <ul
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto p-1"
          role="listbox"
          aria-activedescendant={filtered[activeIdx] ? `cmd-${filtered[activeIdx].id}` : undefined}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted">
              No commands match
            </li>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <li key={group}>
                <div className="px-2 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
                  {group}
                </div>
                <ul>
                  {items.map(({ action, idx }) => {
                    const active = idx === activeIdx;
                    return (
                      <li key={action.id}>
                        <button
                          type="button"
                          id={`cmd-${action.id}`}
                          data-idx={idx}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => {
                            setOpen(false);
                            void action.run();
                          }}
                          className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                            active
                              ? "bg-accent/15 text-foreground"
                              : "text-soft hover:bg-surface-2"
                          }`}
                        >
                          <span className="truncate">{action.label}</span>
                          {action.hint && (
                            <span className="shrink-0 font-mono text-[10px] text-muted">
                              {action.hint}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-border bg-surface-2 px-3 py-1.5 text-[10px] font-mono text-muted">
          <span>
            <kbd className="kbd">↑↓</kbd> nav <kbd className="kbd">↵</kbd> run
          </span>
          <span>
            <kbd className="kbd">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
