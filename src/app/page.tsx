"use client";

import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { PianoRoll } from "@/components/PianoRoll";
import { Mixer } from "@/components/Mixer";
import { SongChain } from "@/components/SongChain";
import { HelpOverlay } from "@/components/HelpOverlay";
import { GeneratorModal } from "@/components/GeneratorModal";
import { useAudioEngine } from "@/lib/useAudioEngine";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Transport onInit={initAudio} />
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
