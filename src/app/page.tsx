"use client";

import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { PianoRoll } from "@/components/PianoRoll";
import { Mixer } from "@/components/Mixer";
import { Arrangement } from "@/components/Arrangement";
import { useAudioEngine } from "@/lib/useAudioEngine";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import "@/store/history";

export default function DAW() {
  const { initAudio, getTrackMeter, getMasterMeter } = useAudioEngine();
  useKeyboardShortcuts(initAudio);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Transport onInit={initAudio} />
      <Arrangement />
      <StepSequencer />
      <PianoRoll />
      <Mixer getTrackMeter={getTrackMeter} getMasterMeter={getMasterMeter} />
    </div>
  );
}
