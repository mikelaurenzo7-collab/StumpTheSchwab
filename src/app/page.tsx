"use client";

import { useState, useCallback } from "react";
import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { PianoRoll } from "@/components/PianoRoll";
import { Mixer } from "@/components/Mixer";
import { SongChain } from "@/components/SongChain";
import { HelpOverlay } from "@/components/HelpOverlay";
import { GeneratorModal } from "@/components/GeneratorModal";
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
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {recoveryBanner && (
        <div className="mx-4 mt-3 rounded-2xl border border-accent/30 bg-accent/15 px-4 py-3 text-sm shadow-lg shadow-accent/10 backdrop-blur flex items-center justify-between">
          <span className="text-foreground/90">
            Autosave found a recent groove. Restore the session?
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleRecover}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white hover:bg-accent-hover"
            >
              Restore
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-muted hover:bg-white/10 hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <header className="px-5 pb-3 pt-4">
        <div className="panel relative overflow-hidden rounded-[2rem] px-5 py-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(155,92,255,0.24),transparent_22rem),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.12),transparent_18rem)]" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full border border-accent/30 bg-accent/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-accent-hover">
                    StumpTheSchwab
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan/80">
                    Idea-to-groove workstation
                  </span>
                </div>
                <h1 className="max-w-3xl text-2xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                  Build, mutate, arrange, and bounce grooves before the idea cools off.
                </h1>
              </div>
              <div className="hidden rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right sm:block">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                  Workflow
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  Generate → Sequence → Arrange → Mix
                </div>
              </div>
            </div>
            <Transport onInit={initAudio} lastSaved={lastSaved} />
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-5 pb-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="panel flex min-h-0 flex-col overflow-hidden rounded-[1.75rem]">
          <StepSequencer />
          <PianoRoll />
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <div className="panel rounded-[1.75rem] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-accent-hover">
                  Arrange
                </p>
                <h2 className="text-lg font-black tracking-tight text-white">
                  Song chain
                </h2>
              </div>
              <span className="rounded-full bg-cyan/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan">
                Visible
              </span>
            </div>
            <SongChain />
          </div>

          <div className="panel-soft rounded-[1.5rem] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">
              Fast moves
            </p>
            <div className="mt-3 grid gap-2 text-sm text-foreground/80">
              <div className="rounded-2xl bg-white/[0.04] p-3">
                <span className="font-bold text-white">Paint</span> steps by dragging across the grid.
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3">
                <span className="font-bold text-white">Shape</span> a hit by double-clicking a lit step.
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-3">
                <span className="font-bold text-white">Mutate</span> patterns from the Generate button.
              </div>
            </div>
          </div>
        </aside>
      </main>

      <footer className="px-5 pb-5">
        <div className="panel overflow-hidden rounded-[1.75rem]">
          <Mixer
            getTrackMeter={getTrackMeter}
            getMasterMeter={getMasterMeter}
            getMasterSpectrum={getMasterSpectrum}
            getMasterWaveform={getMasterWaveform}
          />
        </div>
      </footer>
      <HelpOverlay />
      <GeneratorModal />
    </div>
  );
}
