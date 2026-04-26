"use client";

import { memo, useEffect, useState } from "react";
import {
  clearMemory,
  loadMemory,
  removeLearning,
  type Learning,
} from "@/lib/projectMemory";

const CATEGORY_TINT: Record<Learning["category"], string> = {
  preference: "bg-accent/20 text-accent",
  style:      "bg-purple-500/20 text-purple-400",
  context:    "bg-blue-500/20 text-blue-400",
  skill:      "bg-emerald-500/20 text-emerald-400",
  fact:       "bg-surface-3 text-soft",
};

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export const MemoryDrawer = memo(function MemoryDrawer({
  onClose,
}: {
  onClose: () => void;
}) {
  const [learnings, setLearnings] = useState<Learning[]>(() => loadMemory().learnings);

  useEffect(() => {
    const refresh = () => setLearnings(loadMemory().learnings);
    if (typeof window === "undefined") return;
    window.addEventListener("sts-memory-changed", refresh);
    return () => window.removeEventListener("sts-memory-changed", refresh);
  }, []);

  const handleDelete = (id: string) => {
    removeLearning(id);
    // refresh handled by sts-memory-changed event
  };

  const handleClear = () => {
    if (window.confirm(`Clear all ${learnings.length} memories?`)) {
      clearMemory();
    }
  };

  return (
    <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[280px] overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
      <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
          Project Memory · {learnings.length}
        </span>
        <button
          onClick={onClose}
          className="text-[14px] leading-none text-muted hover:text-foreground"
          aria-label="Close memory drawer"
        >
          ×
        </button>
      </div>

      {learnings.length === 0 ? (
        <p className="px-3 py-6 text-center text-[11px] text-muted">
          No memories yet. The Co-Producer will save useful patterns here as you work.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {learnings.map((l) => (
            <li key={l.id} className="flex items-start gap-2 px-3 py-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${CATEGORY_TINT[l.category]}`}
              >
                {l.category}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] leading-tight text-foreground">{l.text}</p>
                <span className="text-[9px] text-muted">{relativeTime(l.createdAt)}</span>
              </div>
              <button
                onClick={() => handleDelete(l.id)}
                className="shrink-0 text-[12px] leading-none text-muted hover:text-red-400"
                aria-label="Delete memory"
                title="Forget this"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {learnings.length > 0 && (
        <div className="sticky bottom-0 border-t border-border bg-surface px-3 py-2">
          <button
            onClick={handleClear}
            className="w-full rounded-md border border-red-500/30 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10"
          >
            Clear all memories
          </button>
        </div>
      )}
    </div>
  );
});
