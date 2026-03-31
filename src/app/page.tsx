"use client";

import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { Mixer } from "@/components/Mixer";
import { PatternBank } from "@/components/PatternBank";
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

      {/* Bottom: Pattern Bank + Mixer */}
      <PatternBank />
      <Mixer />
    </div>
  );
}
