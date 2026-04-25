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
    <kbd className="inline-block px-1.5 py-0.5 rounded bg-surface-3 border border-border text-[10px] font-mono text-foreground shadow-[0_1px_0_0_rgba(0,0,0,0.4)]">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onClick={() => setOpen(false)}
    >
      <div
        className="panel max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[1.8rem] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-accent-hover">Shortcut map</p>
            <h2 className="text-xl font-black tracking-[-0.03em] text-foreground">Keyboard Shortcuts</h2>
            <p className="mt-0.5 text-xs text-muted">
              Make better music, faster.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="button-secondary rounded-full px-3 py-1 text-xl leading-none"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {SHORTCUTS.map((group) => (
            <div key={group.title}>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-accent">
                  {group.title}
                </h3>
                <ul className="flex flex-col gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
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

        <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[10px] text-muted">
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
