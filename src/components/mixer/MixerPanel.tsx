"use client";

import { useDAWStore } from "@/store/daw-store";
import ChannelStrip from "./ChannelStrip";

export default function MixerPanel() {
  const { tracks } = useDAWStore();

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "var(--bg-primary)",
        borderTop: "1px solid var(--border-primary)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center px-3 h-7 shrink-0"
        style={{
          background: "var(--bg-tertiary)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <span
          className="text-[10px] font-semibold tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          MIXER
        </span>
      </div>

      {/* Channel strips */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex items-stretch gap-2 p-2 h-full">
          {tracks.length === 0 ? (
            <div
              className="flex items-center justify-center flex-1"
              style={{ color: "var(--text-muted)" }}
            >
              <span className="text-xs">No tracks</span>
            </div>
          ) : (
            <>
              {tracks.map((track) => (
                <ChannelStrip key={track.id} track={track} />
              ))}

              {/* Master strip placeholder */}
              <div
                className="flex flex-col items-center justify-center px-3 py-3 rounded-lg shrink-0"
                style={{
                  width: 80,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-primary)",
                }}
              >
                <div className="flex flex-col items-center gap-1 w-full">
                  <div
                    className="w-full h-1 rounded-full"
                    style={{ background: "var(--text-secondary)" }}
                  />
                  <span className="text-[10px] font-semibold">MASTER</span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                    v0.2
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
