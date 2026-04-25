"use client";

import { useUiStore } from "@/store/ui";
import { useEffect } from "react";

interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Playback",
    items: [
      { keys: ["Space"], label: "Play / Pause" },
      { keys: ["Esc"], label: "Stop (or close piano roll first)" },
      { keys: ["↑", "↓"], label: "BPM ±1 (Shift = ±10)" },
    ],
  },
  {
    title: "Patterns",
    items: [
      { keys: ["1", "–", "8"], label: "Switch to pattern A–H" },
      { keys: ["←", "→"], label: "Previous / next pattern" },
    ],
  },
  {
    title: "Step editing",
    items: [
      { keys: ["Click"], label: "Toggle step on/off (drag to paint)" },
      { keys: ["Right-click"], label: "Open step detail (velocity, probability, nudge)" },
      { keys: ["Ctrl/⌘ + Click"], label: "Cycle step probability" },
    ],
  },
  {
    title: "Track tools",
    items: [
      { keys: ["Hover", "→", "C"], label: "Copy track pattern" },
      { keys: ["Hover", "→", "P"], label: "Paste track pattern" },
      { keys: ["Hover", "→", "~"], label: "Humanize this track" },
      { keys: ["Hover", "→", "E"], label: "Euclidean fill" },
      { keys: ["Hover", "→", "✕"], label: "Clear track" },
    ],
  },
  {
    title: "History",
    items: [
      { keys: ["Ctrl/⌘ + Z"], label: "Undo" },
      { keys: ["Ctrl/⌘ + Shift + Z"], label: "Redo" },
      { keys: ["Ctrl/⌘ + Y"], label: "Redo (alt)" },
    ],
  },
  {
    title: "Performance",
    items: [
      { keys: ["Q", "W", "E", "R"], label: "Trigger tracks 1–4" },
      { keys: ["T", "Y", "U", "I"], label: "Trigger tracks 5–8" },
    ],
  },
  {
    title: "Global",
    items: [
      { keys: ["G"], label: "Generate beat with Claude" },
      { keys: ["H"], label: "Humanize all tracks" },
      { keys: ["?"], label: "Toggle this help overlay" },
    ],
  },
];

function Key({ children }: { children: React.ReactNode }) {
  // Render plain separator chars (–, →) without a key-cap
  if (typeof children === "string" && (children === "–" || children === "→")) {
    return <span className="text-muted/60 mx-0.5">{children}</span>;
  }
  return (
    <kbd className="inline-block px-1.5 py-0.5 rounded-sm bg-surface-3 border border-border text-[10px] font-mono text-foreground shadow-[inset_0_-2px_0_rgba(0,0,0,0.4),_0_1px_0_rgba(255,255,255,0.05)]">
      {children}
    </kbd>
  );
}

export function HelpOverlay() {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setHelpOpen);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-surface border border-border/60 rounded-2xl shadow-2xl p-6 max-w-3xl w-[90%] max-h-[85vh] overflow-y-auto"
        style={{ animation: "fade-in-up 0.22s cubic-bezier(0.22,1,0.36,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2"><span className="text-accent">⌨</span> Keyboard Shortcuts</h2>
            <p className="text-xs text-muted mt-0.5">
              Make better music, faster.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted hover:text-foreground text-xl leading-none px-2"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {SHORTCUTS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-accent mb-2">
                {group.title}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-muted">{item.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, ki) => (
                        <Key key={ki}>{k}</Key>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-[10px] text-muted">
          <span>
            Tip: right-click a step to cycle velocity, ctrl-click to set
            probability.
          </span>
          <span>
            <Key>?</Key> to toggle · <Key>Esc</Key> to close
          </span>
        </div>
      </div>
    </div>
  );
}
