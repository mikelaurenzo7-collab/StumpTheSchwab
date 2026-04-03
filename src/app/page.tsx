"use client";

import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { PianoRoll } from "@/components/PianoRoll";
import { Mixer } from "@/components/Mixer";
import { useAudioEngine } from "@/lib/useAudioEngine";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";

export default function DAW() {
  const { initAudio } = useAudioEngine();
  useKeyboardShortcuts(initAudio);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top: Transport Bar */}
      <Transport onInit={initAudio} />

      {/* Middle: Step Sequencer */}
      <StepSequencer />

      {/* Piano Roll (appears when a melodic track is selected) */}
      <PianoRoll />

      {/* Bottom: Mixer */}
      <Mixer />
    </div>
  );
}
