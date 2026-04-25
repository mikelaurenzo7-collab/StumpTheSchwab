"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { PianoRoll } from "@/components/PianoRoll";
import { Mixer } from "@/components/Mixer";
import { SongChain } from "@/components/SongChain";
import { HelpOverlay } from "@/components/HelpOverlay";
import { GeneratorModal } from "@/components/GeneratorModal";
import { MixDoctorPanel } from "@/components/MixDoctorPanel";
import { useAudioEngine } from "@/lib/useAudioEngine";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useAutoSave } from "@/lib/useAutoSave";
import { useUiStore } from "@/store/ui";
import "@/store/history";

export default function DAW() {
  const {
    initAudio,
    getTrackMeter,
    getMasterMeter,
    getMasterSpectrum,
    getMasterWaveform,
    getTrackSpectrum,
    getLoudness,
    getTruePeak,
    triggerTrack,
  } = useAudioEngine();
  useKeyboardShortcuts(initAudio, triggerTrack);

  const { lastSaved, recoverAutosave, clearAutosave } = useAutoSave();
  const [recoveryBanner, setRecoveryBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("sts_session___autosave") !== null; } catch { return false; }
  });

  const accentTheme = useUiStore((s) => s.accentTheme);

  // Apply accent theme class to <body>
  useEffect(() => {
    const THEMES = ["theme-warm", "theme-cobalt", "theme-lime"];
    document.body.classList.remove(...THEMES);
    if (accentTheme !== "violet") {
      document.body.classList.add(`theme-${accentTheme}`);
    }
  }, [accentTheme]);

  const [mixDoctorOpen, setMixDoctorOpen] = useState(false);
  // Live conflict state bubbled up from the Sonic X-Ray canvas so the Mix
  // Doctor gets real-time zone collision data without re-computing it.
  const [xrayConflicts, setXrayConflicts] = useState<Record<string, string[]>>({});

  // D key opens/closes the Mix Doctor
  const mixDoctorRef = useRef(mixDoctorOpen);
  mixDoctorRef.current = mixDoctorOpen;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "d" || e.key === "D") {
        setMixDoctorOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleRecover = useCallback(() => {
    recoverAutosave();
    setRecoveryBanner(false);
  }, [recoverAutosave]);

  const handleDismiss = useCallback(() => {
    clearAutosave();
    setRecoveryBanner(false);
  }, [clearAutosave]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {recoveryBanner && (
        <div className="bg-accent/20 border-b border-accent/30 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-foreground">
            Unsaved session recovered. Restore it?
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleRecover}
              className="px-3 py-0.5 bg-accent text-white rounded text-xs font-medium hover:bg-accent/80"
            >
              Restore
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-0.5 bg-surface-2 text-muted rounded text-xs font-medium hover:bg-surface-3"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <Transport onInit={initAudio} lastSaved={lastSaved} />
      <SongChain />
      <StepSequencer />
      <PianoRoll />
      <Mixer
        getTrackMeter={getTrackMeter}
        getMasterMeter={getMasterMeter}
        getMasterSpectrum={getMasterSpectrum}
        getMasterWaveform={getMasterWaveform}
        getTrackSpectrum={getTrackSpectrum}
        getLoudness={getLoudness}
        getTruePeak={getTruePeak}
        onConflictsChange={setXrayConflicts}
        onOpenMixDoctor={() => setMixDoctorOpen(true)}
      />
      <HelpOverlay />
      <GeneratorModal />

      {/* Mix Doctor — floating overlay, D key to toggle */}
      <MixDoctorPanel
        getLoudness={getLoudness}
        getTruePeak={getTruePeak}
        conflicts={xrayConflicts}
        isOpen={mixDoctorOpen}
        onClose={() => setMixDoctorOpen(false)}
      />

      {/* Mix Doctor entry point — always-visible fab when closed */}
      {!mixDoctorOpen && (
        <button
          onClick={() => setMixDoctorOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white text-[11px] font-bold shadow-lg hover:bg-accent-hover transition-all"
          title="Open Mix Doctor (D)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
          Mix Doctor
          <span className="text-white/50 text-[9px]">D</span>
        </button>
      )}
    </div>
  );
}
