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
      />
      <HelpOverlay />
      <GeneratorModal />
    </div>
  );
}
