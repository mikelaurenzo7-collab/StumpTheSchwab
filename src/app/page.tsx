"use client";

import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { Mixer } from "@/components/Mixer";
import { MacroPanel } from "@/components/MacroPanel";
import { GenerateBar } from "@/components/GenerateBar";

export default function Home() {
  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="brand">
          <div className="orbital-mark" aria-hidden="true"><span /></div>
          <div className="brand-text">
            <h1>StumpTheSchwab</h1>
            <p>Make better music, faster.</p>
          </div>
        </div>
      </header>

      <Transport />
      <GenerateBar />

      <section className="studio-grid">
        <div className="studio-main">
          <StepSequencer />
          <Mixer />
        </div>
        <MacroPanel />
      </section>
    </main>
  );
}
