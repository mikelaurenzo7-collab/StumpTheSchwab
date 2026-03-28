"use client";

import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { Mixer } from "@/components/Mixer";
import { useAudioEngine } from "@/lib/useAudioEngine";

export default function DAW() {
  const { initAudio } = useAudioEngine();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top: Transport Bar */}
      <Transport onInit={initAudio} />

      {/* Middle: Step Sequencer */}
      <StepSequencer />

      {/* Bottom: Mixer */}
      <Mixer />
    </div>
  );
}
