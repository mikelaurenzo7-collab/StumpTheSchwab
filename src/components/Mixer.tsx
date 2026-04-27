"use client";

import { useEngine } from "@/store/engine";
import { VOICES } from "@/lib/sounds";

export function Mixer() {
  const patterns = useEngine((s) => s.patterns);
  const currentPattern = useEngine((s) => s.currentPattern);
  const setTrackLevel = useEngine((s) => s.setTrackLevel);
  const toggleMute = useEngine((s) => s.toggleMute);
  const toggleSolo = useEngine((s) => s.toggleSolo);

  const tracks = patterns[currentPattern]?.tracks ?? [];
  const anySoloed = tracks.some((t) => t.soloed);

  return (
    <div className="mixer-card">
      <div className="section-heading">
        <p>Channel strip</p>
        <h2>Mix.</h2>
      </div>
      <div className="mixer-channels">
        {tracks.map((track, i) => {
          const dimmed = anySoloed && !track.soloed;
          return (
            <div
              key={track.id}
              className={`mixer-channel ${track.muted || dimmed ? "is-muted" : ""}`}
              style={{ "--track-hue": track.hue } as React.CSSProperties}
            >
              <span className="mixer-label">{VOICES[track.voice]?.short ?? track.voice}</span>
              <input
                className="mixer-fader"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={track.level}
                onChange={(e) => setTrackLevel(i, Number(e.target.value))}
                aria-label={`${track.name} volume`}
              />
              <div className="mixer-level-num">{Math.round(track.level * 100)}</div>
              <div className="mixer-btns">
                <button
                  className={`mixer-btn mute-btn ${track.muted ? "is-on" : ""}`}
                  onClick={() => toggleMute(i)}
                  aria-label={`${track.muted ? "Unmute" : "Mute"} ${track.name}`}
                >
                  M
                </button>
                <button
                  className={`mixer-btn solo-btn ${track.soloed ? "is-on" : ""}`}
                  onClick={() => toggleSolo(i)}
                  aria-label={`${track.soloed ? "Unsolo" : "Solo"} ${track.name}`}
                >
                  S
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
