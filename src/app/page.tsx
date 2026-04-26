"use client";

import { useState, useCallback } from "react";
import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { PianoRoll } from "@/components/PianoRoll";
import { Mixer } from "@/components/Mixer";
import { SongChain } from "@/components/SongChain";
import { HelpOverlay } from "@/components/HelpOverlay";
import { GeneratorModal } from "@/components/GeneratorModal";
import { GroovePanel } from "@/components/GroovePanel";
import { AutomationEditor } from "@/components/AutomationEditor";
import { PerformanceMode } from "@/components/PerformanceMode";
import { SampleBrowser } from "@/components/SampleBrowser";
import { CoproducerPanel } from "@/components/CoproducerPanel";
import { StatusBar } from "@/components/StatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { useAudioEngine } from "@/lib/useAudioEngine";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useAutoSave } from "@/lib/useAutoSave";
import "@/store/history";

const TABS = [
  { id: "arrange", label: "Arrange" },
  { id: "groove", label: "Groove" },
  { id: "automation", label: "Auto" },
  { id: "performance", label: "Perf" },
  { id: "samples", label: "Samples" },
  { id: "ai", label: "AI" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DAW() {
  const {
    initAudio,
    getTrackMeter,
    getMasterMeter,
    getMasterSpectrum,
    getMasterWaveform,
    getMasterLoudness,
    getMasterTruePeak,
    triggerTrack,
  } = useAudioEngine();
  useKeyboardShortcuts(initAudio, triggerTrack);

  const { lastSaved, recoverAutosave, clearAutosave } = useAutoSave();
  const [mixerOpen, setMixerOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<TabId>("arrange");
  const [recoveryBanner, setRecoveryBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("sts_session___autosave") !== null;
    } catch {
      return false;
    }
  });

  const handleRecover = useCallback(() => {
    recoverAutosave();
    setRecoveryBanner(false);
  }, [recoverAutosave]);

  const handleDismiss = useCallback(() => {
    clearAutosave();
    setRecoveryBanner(false);
  }, [clearAutosave]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ─── Recovery banner ─────────────────────────────────── */}
      {recoveryBanner && (
        <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
          <span className="text-soft">
            Autosave found a recent session.
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleRecover}
              className="button-primary rounded-md px-3 py-1 text-[11px]"
            >
              Restore
            </button>
            <button
              onClick={handleDismiss}
              className="button-secondary rounded-md px-3 py-1 text-[11px]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ─── Top bar: brand + transport ──────────────────────── */}
      <header className="flex items-center gap-4 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-tight text-foreground">
              StumpTheSchwab
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
              Studio
            </div>
          </div>
        </div>

        <div className="mx-3 h-7 w-px bg-border" />

        <div className="min-w-0 flex-1">
          <Transport onInit={initAudio} lastSaved={lastSaved} />
        </div>
      </header>

      {/* ─── Main: sequencer + sidebar ───────────────────────── */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="panel flex min-h-0 flex-col overflow-hidden rounded-lg">
          <StepSequencer />
          <PianoRoll />
        </section>

        <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {/* Tab strip */}
          <div className="flex gap-0.5 rounded-lg border border-border bg-surface p-1">
            {TABS.map((tab) => {
              const active = sidebarTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSidebarTab(tab.id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
                    active
                      ? "bg-accent text-[#1a1408]"
                      : "text-muted hover:bg-surface-3 hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {sidebarTab === "arrange" && (
            <>
              <div className="panel rounded-lg p-3">
                <SectionHeader eyebrow="Arrange" title="Song chain" />
                <SongChain />
              </div>

              <div className="panel-soft rounded-lg p-3">
                <SectionHeader eyebrow="Tips" title="Workflow" />
                <ul className="mt-2 space-y-1.5 text-[12px] text-soft">
                  <li className="flex gap-2">
                    <span className="text-accent">▸</span>
                    <span>Drag across the grid to paint steps.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent">▸</span>
                    <span>Double-click a lit step to shape its hit.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent">▸</span>
                    <span>
                      Press <kbd className="kbd">G</kbd> for AI generation.
                    </span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {sidebarTab === "groove" && <GroovePanel />}
          {sidebarTab === "automation" && <AutomationEditor />}
          {sidebarTab === "performance" && <PerformanceMode />}
          {sidebarTab === "samples" && <SampleBrowser />}
          {sidebarTab === "ai" && <CoproducerPanel />}
        </aside>
      </main>

      {/* ─── Mixer dock ──────────────────────────────────────── */}
      <footer className="border-t border-border bg-surface">
        <button
          onClick={() => setMixerOpen((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-surface-2"
          aria-expanded={mixerOpen}
          aria-controls="studio-mixer"
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-[11px] transition-transform ${
                mixerOpen ? "rotate-90" : ""
              }`}
            >
              ▸
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              Mixer
            </span>
            <span className="text-[12px] text-soft">
              {mixerOpen ? "Channel strips, FX, master" : "Click to open mix view"}
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted">
            {mixerOpen ? "ESC to close" : "M to toggle"}
          </span>
        </button>
        {mixerOpen && (
          <div id="studio-mixer" className="border-t border-border">
            <Mixer
              getTrackMeter={getTrackMeter}
              getMasterMeter={getMasterMeter}
              getMasterSpectrum={getMasterSpectrum}
              getMasterWaveform={getMasterWaveform}
              getLoudness={getMasterLoudness}
              getTruePeak={getMasterTruePeak}
            />
          </div>
        )}
      </footer>

      <HelpOverlay />
      <GeneratorModal />
      <CommandPalette onInit={initAudio} />

      <StatusBar getMasterMeter={getMasterMeter} getMasterWaveform={getMasterWaveform} />

      <style jsx global>{`
        .kbd {
          display: inline-block;
          padding: 0 5px;
          margin: 0 1px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--foreground-soft);
          background: var(--surface-3);
          border: 1px solid var(--border-strong);
          border-bottom-width: 2px;
          border-radius: 4px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

// ─── Brand mark — minimal monogram ─────────────────────────────
function BrandMark() {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-accent to-[#c97e08] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_10px_rgba(245,165,36,0.3)]">
      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M3 5c0-1.5 1.5-2 3-2s2 1 2 1M3 11c0 1.5 1.5 2 3 2s7-1 7-3-3-2-5-2"
          stroke="#1a1408"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ─── Compact section header ────────────────────────────────────
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-[13px] font-bold tracking-tight text-foreground">{title}</h2>
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
        {eyebrow}
      </span>
    </div>
  );
}
