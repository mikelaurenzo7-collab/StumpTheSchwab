"use client";

import { useEffect, useState, useCallback } from "react";
import { useDAWStore } from "@/store/daw-store";
import { audioEngine } from "@/engine/audio-engine";
import Transport from "./transport/Transport";
import TrackList from "./tracks/TrackList";
import Timeline from "./timeline/Timeline";
import MixerPanel from "./mixer/MixerPanel";

export default function DAWWorkspace() {
  const [audioReady, setAudioReady] = useState(false);
  const { tracks, transportState, viewMode, play, stop, addTrack } = useDAWStore();

  const handleStartAudio = useCallback(async () => {
    await audioEngine.ensureStarted();
    setAudioReady(true);
  }, []);

  useEffect(() => {
    const unsub = useDAWStore.subscribe((state, prevState) => {
      for (const track of state.tracks) {
        audioEngine.syncTrack(track);
      }
      audioEngine.applySolo(state.tracks);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (transportState === "playing") {
            audioEngine.stop();
            stop();
          } else {
            audioEngine.play();
            play();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [transportState, play, stop]);

  // Seed default tracks on first audio start
  useEffect(() => {
    if (audioReady && tracks.length === 0) {
      addTrack("Melody");
      addTrack("Bass");
      addTrack("Drums");
      addTrack("Pad");
    }
  }, [audioReady, tracks.length, addTrack]);

  if (!audioReady) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center gap-6 cursor-pointer"
        style={{ background: "var(--bg-primary)" }}
        onClick={handleStartAudio}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
            style={{ background: "var(--accent)" }}
          >
            S
          </div>
          <h1 className="text-2xl font-bold tracking-tight">StumpTheSchwab</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Produce higher quality music, faster.
          </p>
        </div>
        <button
          className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{
            background: "var(--accent)",
            color: "#fff",
            boxShadow: "0 4px 24px var(--accent-dim)",
          }}
        >
          Start Session
        </button>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Click anywhere or press the button to enable audio
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Transport */}
      <Transport />

      {/* Main workspace */}
      <div className="flex flex-1 min-h-0">
        {viewMode === "arrange" ? (
          <>
            {/* Track list sidebar */}
            <TrackList />
            {/* Timeline */}
            <Timeline />
          </>
        ) : (
          <div className="flex-1">
            <MixerPanel />
          </div>
        )}
      </div>

      {/* Mixer (visible in arrange mode at bottom) */}
      {viewMode === "arrange" && (
        <div style={{ height: 280 }}>
          <MixerPanel />
        </div>
      )}
    </div>
  );
}
