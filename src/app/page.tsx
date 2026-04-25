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
import { useAudioEngine } from "@/lib/useAudioEngine";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useAutoSave } from "@/lib/useAutoSave";
import "@/store/history";

export default function DAW() {
  const {
    initAudio,
    getTrackMeter,
    getMasterMeter,
    getMasterSpectrum,
    getMasterWaveform,
    triggerTrack,
  } = useAudioEngine();
  useKeyboardShortcuts(initAudio, triggerTrack);

  const { lastSaved, recoverAutosave, clearAutosave } = useAutoSave();
  const [mixerOpen, setMixerOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"arrange" | "groove" | "automation" | "performance" | "samples">("arrange");
  const [recoveryBanner, setRecoveryBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("sts_session___autosave") !== null; } catch { return false; }
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
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.1),transparent_30rem),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.08),transparent_24rem)]" />
      {recoveryBanner && (
        <div className="relative mx-4 mt-3 flex items-center justify-between rounded-[1.6rem] border border-accent/30 bg-accent/15 px-4 py-3 text-sm shadow-lg shadow-accent/10 backdrop-blur">
          <span className="text-foreground/90">
            Autosave found a recent groove. Restore the session?
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleRecover}
              className="button-primary rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em]"
            >
              Restore
            </button>
            <button
              onClick={handleDismiss}
              className="button-secondary rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <header className="relative px-4 pb-2 pt-3 md:px-5">
        <div className="panel relative overflow-hidden rounded-[1.6rem] px-4 py-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(20,184,166,0.2),transparent_20rem),radial-gradient(circle_at_86%_18%,rgba(251,146,60,0.14),transparent_18rem)]" />
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="pill-badge rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-accent-hover">
                    StumpTheSchwab
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan/80">
                    Composer-first workflow
                  </span>
                </div>
                <h1 className="max-w-4xl text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                  Build, shape, arrange, and export grooves with a clear full-width composition canvas.
                </h1>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em]">
                <span className="pill-badge rounded-full px-3 py-1.5">Generate</span>
                <span className="pill-badge rounded-full px-3 py-1.5">Sequence</span>
                <span className="pill-badge rounded-full px-3 py-1.5">Arrange</span>
                <span className="pill-badge rounded-full px-3 py-1.5">Mix</span>
              </div>
            </div>
            <Transport onInit={initAudio} lastSaved={lastSaved} />
          </div>
        </div>
      </header>

      <main className="relative grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-3 md:px-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="panel flex min-h-0 flex-col overflow-hidden rounded-[1.35rem]">
          <StepSequencer />
          <PianoRoll />
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {/* Tab Navigation */}
          <div className="panel-soft flex gap-1 rounded-[1.2rem] p-1.5">
            {[
              { id: "arrange", label: "Arrange", icon: "🎵" },
              { id: "groove", label: "Groove", icon: "🎛️" },
              { id: "automation", label: "Auto", icon: "📊" },
              { id: "performance", label: "Perf", icon: "🎭" },
              { id: "samples", label: "Samples", icon: "📦" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id as typeof sidebarTab)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                  sidebarTab === tab.id
                    ? "bg-teal-500/20 text-teal-400"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {sidebarTab === "arrange" && (
            <>
              <div className="panel rounded-[1.35rem] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-accent-hover">
                      Arrange
                    </p>
                    <h2 className="text-base font-black tracking-tight text-white">
                      Song chain
                    </h2>
                  </div>
                  <span className="pill-badge rounded-full bg-cyan/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan">
                    Visible
                  </span>
                </div>
                <SongChain />
              </div>

              <div className="panel-soft rounded-[1.2rem] p-3.5">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">
                  Fast moves
                </p>
                <div className="mt-2.5 grid gap-2 text-sm text-foreground/80">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
                    <span className="font-bold text-white">Paint</span> steps by dragging across the grid.
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
                    <span className="font-bold text-white">Shape</span> a hit by double-clicking a lit step.
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
                    <span className="font-bold text-white">Mutate</span> patterns from the Generate button.
                  </div>
                </div>
              </div>
            </>
          )}

          {sidebarTab === "groove" && <GroovePanel />}
          {sidebarTab === "automation" && <AutomationEditor />}
          {sidebarTab === "performance" && <PerformanceMode />}
          {sidebarTab === "samples" && <SampleBrowser />}
        </aside>
      </main>

      <footer className="relative px-4 pb-4 md:px-5 md:pb-5">
        <div className="panel overflow-hidden rounded-[1.35rem]">
          <button
            onClick={() => setMixerOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3 text-left"
            aria-expanded={mixerOpen}
            aria-controls="studio-mixer"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan">
                Mix Dock
              </p>
              <h2 className="text-sm font-black tracking-tight text-white">
                {mixerOpen ? "Mixer and master view" : "Keep the composition canvas dominant until you need mix controls"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="pill-badge rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/80">
                {mixerOpen ? "Expanded" : "Collapsed"}
              </span>
              <span className="button-secondary rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
                {mixerOpen ? "Hide" : "Open"}
              </span>
            </div>
          </button>
          {mixerOpen ? (
            <div id="studio-mixer">
              <Mixer
                getTrackMeter={getTrackMeter}
                getMasterMeter={getMasterMeter}
                getMasterSpectrum={getMasterSpectrum}
                getMasterWaveform={getMasterWaveform}
              />
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-foreground/72">
              Open the dock for metering, master visualization, sample loading, channel FX, and export context while keeping the sequencer front and center.
            </div>
          )}
        </div>
      </footer>
      <HelpOverlay />
      <GeneratorModal />
    </div>
  );
}
