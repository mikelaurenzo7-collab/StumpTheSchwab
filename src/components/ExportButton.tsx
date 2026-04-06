"use client";

import { useState, useRef, useEffect } from "react";
import { exportAudio, type ExportMode } from "@/lib/exportAudio";
import { useEngineStore } from "@/store/engine";

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const songMode = useEngineStore((s) => s.songMode);
  const songArrangement = useEngineStore((s) => s.songArrangement);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleExport = async (mode: ExportMode) => {
    setShowMenu(false);
    setIsExporting(true);
    try {
      await exportAudio(mode);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider font-bold transition-all ${
          isExporting
            ? "bg-accent/30 text-accent animate-pulse cursor-wait"
            : "bg-surface-2 hover:bg-accent/20 text-muted hover:text-accent"
        }`}
      >
        {isExporting ? "Rendering..." : "Export"}
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden z-50 min-w-[180px]">
          {/* Export current pattern */}
          <button
            onClick={() => handleExport("pattern")}
            className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface-2 transition-colors flex items-center gap-2"
          >
            <span className="text-accent text-base">&#9654;</span>
            <div>
              <div className="font-medium">Export Pattern</div>
              <div className="text-[10px] text-muted">Current pattern as WAV</div>
            </div>
          </button>

          {/* Export full song */}
          <button
            onClick={() => handleExport("song")}
            disabled={songArrangement.length <= 1 && !songMode}
            className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 border-t border-border ${
              songArrangement.length <= 1 && !songMode
                ? "text-muted/40 cursor-not-allowed"
                : "text-foreground hover:bg-surface-2"
            }`}
          >
            <span className="text-accent text-base">&#9835;</span>
            <div>
              <div className="font-medium">Export Song</div>
              <div className="text-[10px] text-muted">
                Full arrangement ({songArrangement.length} blocks)
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
