"use client";

import { useDAWStore } from "@/store/daw-store";

interface PlayheadProps {
  zoomLevel: number;
  scrollLeft: number;
}

const BEAT_WIDTH_BASE = 40;

export default function Playhead({ zoomLevel, scrollLeft }: PlayheadProps) {
  const { currentBeat, transportState } = useDAWStore();
  const beatWidth = BEAT_WIDTH_BASE * zoomLevel;
  const x = currentBeat * beatWidth - scrollLeft;

  if (transportState === "stopped" && currentBeat === 0) return null;

  return (
    <div
      className="absolute top-0 bottom-0 w-px pointer-events-none z-20"
      style={{
        left: x,
        background: "var(--accent)",
        boxShadow: "0 0 6px var(--accent)",
      }}
    >
      <div
        className="w-2.5 h-2.5 -ml-[5px] -mt-0.5"
        style={{
          background: "var(--accent)",
          clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)",
        }}
      />
    </div>
  );
}
