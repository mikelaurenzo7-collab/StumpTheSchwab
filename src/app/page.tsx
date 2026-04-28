"use client";

import { useCallback, useEffect } from "react";
import { useEngineStore } from "@/store/engine";
import { useAudioEngine } from "@/lib/useAudioEngine";
import Transport from "@/components/Transport";
import StepSequencer from "@/components/StepSequencer";
import MacroPanel from "@/components/MacroPanel";
import GenerateBar from "@/components/GenerateBar";

export default function Home() {
  const { toggle } = useAudioEngine();
  const regenerate = useEngineStore((s) => s.regenerate);
  const mutate = useEngineStore((s) => s.mutate);
  const clearAll = useEngineStore((s) => s.clearAll);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          toggle();
          break;
        case "KeyG": {
          e.preventDefault();
          const input = document.querySelector<HTMLInputElement>(
            "[data-generate-input]"
          );
          input?.focus();
          break;
        }
        case "KeyR":
          e.preventDefault();
          regenerate();
          break;
        case "KeyM":
          e.preventDefault();
          mutate();
          break;
        case "KeyC":
          e.preventDefault();
          clearAll();
          break;
        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5":
        case "Digit6": {
          const idx = Number(e.code.replace("Digit", "")) - 1;
          const tracks = useEngineStore.getState().tracks;
          if (tracks[idx]) {
            e.preventDefault();
            useEngineStore.getState().toggleMute(tracks[idx].id);
          }
          break;
        }
      }
    },
    [toggle, regenerate, mutate, clearAll]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <main className="studio-shell">
      <section className="hero-panel">
        <div className="brand-block">
          <div className="orbital-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <p className="eyebrow">StumpTheSchwab</p>
            <h1>Future studio for beats.</h1>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary-action" onClick={toggle}>
            <span className="key-badge">Space</span>
            Start engine
          </button>
          <button className="ghost-action" onClick={regenerate}>
            <span className="key-badge">R</span>
            Generate world
          </button>
          <button className="ghost-action" onClick={mutate}>
            <span className="key-badge">M</span>
            Fracture pattern
          </button>
          <button className="ghost-action" onClick={clearAll}>
            <span className="key-badge">C</span>
            Clear all
          </button>
        </div>
      </section>

      <GenerateBar />
      <Transport onTogglePlay={toggle} />

      <section className="studio-grid">
        <StepSequencer />
        <MacroPanel />
      </section>

      <footer className="shortcuts-footer">
        <span><kbd>Space</kbd> Play/Pause</span>
        <span><kbd>G</kbd> Generate</span>
        <span><kbd>R</kbd> Regenerate</span>
        <span><kbd>M</kbd> Mutate</span>
        <span><kbd>C</kbd> Clear</span>
        <span><kbd>1-6</kbd> Mute track</span>
      </footer>
    </main>
  );
}
