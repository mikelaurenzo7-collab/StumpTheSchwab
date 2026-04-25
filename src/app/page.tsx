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
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(155,92,255,0.08),transparent_28rem),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.05),transparent_24rem)]" />
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
      <header className="relative px-5 pb-3 pt-4">
        <div className="panel relative overflow-hidden rounded-[2rem] px-5 py-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(155,92,255,0.24),transparent_22rem),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.12),transparent_18rem)]" />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-2 flex items-center gap-2">
                  <span className="pill-badge rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-accent-hover">
                    StumpTheSchwab
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan/80">
                    Idea-to-groove workstation
                  </span>
                </div>
                <h1 className="max-w-3xl text-2xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                  Capture, mutate, arrange, and bounce polished grooves in real time.
                </h1>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="pill-badge rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">
                    Responsive step editing
                  </span>
                  <span className="pill-badge rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">
                    AI groove direction
                  </span>
                  <span className="pill-badge rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">
                    Offline bounce + MIDI
                  </span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:w-[24rem] xl:grid-cols-1">
                <div className="panel-soft rounded-[1.4rem] px-4 py-3 text-right sm:block">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                    Workflow
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    Generate → Sequence → Arrange → Mix
                  </div>
                </div>
                <div className="panel-soft rounded-[1.4rem] px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                    Mood board
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-semibold text-foreground/85">
                    <div className="rounded-2xl bg-white/[0.05] px-3 py-2 text-center">Neon</div>
                    <div className="rounded-2xl bg-white/[0.05] px-3 py-2 text-center">Punch</div>
                    <div className="rounded-2xl bg-white/[0.05] px-3 py-2 text-center">Depth</div>
                  </div>
                </div>
              </div>
            </div>
            <Transport onInit={initAudio} lastSaved={lastSaved} />
          </div>
        </div>
      </header>

      <main className="relative grid min-h-0 flex-1 grid-cols-1 gap-4 px-5 pb-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
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
              <span className="pill-badge rounded-full bg-cyan/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan">
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
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3">
                <span className="font-bold text-white">Paint</span> steps by dragging across the grid.
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3">
                <span className="font-bold text-white">Shape</span> a hit by double-clicking a lit step.
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3">
                <span className="font-bold text-white">Mutate</span> patterns from the Generate button.
              </div>
            </div>
          </div>
        </aside>
      </main>

      <footer className="relative px-5 pb-5">
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
