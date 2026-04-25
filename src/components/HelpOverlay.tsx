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
    <kbd className="inline-block rounded-[0.7rem] border border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)),rgba(17,23,34,0.92)] px-2 py-1 text-[10px] font-mono text-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.08),0_8px_16px_rgba(0,0,0,0.18)]">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,6,12,0.82)] p-4 backdrop-blur-md"
      onClick={() => setOpen(false)}
    >
      <div
        className="panel max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid gap-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="border-b border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015)),rgba(8,12,18,0.82)] p-5 lg:border-b-0 lg:border-r">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-accent-hover">Shortcut map</p>
            <h2 className="text-2xl font-black tracking-[-0.03em] text-foreground">Control room</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Keep the groove moving without leaving the keyboard.
            </p>

            <div className="mt-5 space-y-3">
              <div className="panel-soft rounded-[1.2rem] p-3">
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan">Fast start</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-foreground/80">
                  <span className="pill-badge rounded-full px-2.5 py-1">Space to play</span>
                  <span className="pill-badge rounded-full px-2.5 py-1">G to generate</span>
                  <span className="pill-badge rounded-full px-2.5 py-1">? for help</span>
                </div>
              </div>

              <div className="panel-soft rounded-[1.2rem] p-3 text-[11px] leading-relaxed text-muted">
                Right-click a step for micro edits. Ctrl or Cmd click cycles chance. Drag across the grid to paint rhythm quickly.
              </div>
            </div>
          </aside>

          <section className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black tracking-tight text-white">Keyboard shortcuts</h3>
                <p className="mt-1 text-xs text-muted">Playback, arrangement, editing, and performance in one view.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="button-secondary rounded-full px-3 py-1 text-xl leading-none"
                title="Close (Esc)"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {SHORTCUTS.map((group) => (
                <div key={group.title} className="panel-soft rounded-[1.35rem] p-4">
                  <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-accent">
                    {group.title}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {group.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 text-xs"
                      >
                        <span className="text-foreground/82">{item.label}</span>
                        <span className="flex shrink-0 items-center gap-1">
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

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4 text-[10px] text-muted">
              <span>
                Tip: use pattern switching and track triggers together to improvise structure live.
              </span>
              <span className="flex items-center gap-2">
                <Key>?</Key>
                <span>toggle</span>
                <Key>Esc</Key>
                <span>close</span>
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
