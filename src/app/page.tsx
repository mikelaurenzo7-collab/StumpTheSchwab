"use client";

import { useState, useCallback, useEffect } from "react";
import { Transport } from "@/components/Transport";
import { StepSequencer } from "@/components/StepSequencer";
import { PianoRoll } from "@/components/PianoRoll";
import { Mixer } from "@/components/Mixer";
import { SongChain } from "@/components/SongChain";
import { HelpOverlay } from "@/components/HelpOverlay";
import { GeneratorModal } from "@/components/GeneratorModal";
import { GroovePanel } from "@/components/GroovePanel";
import { AutomationEditor } from "@/components/AutomationEditor";
import { PerformanceMode } from "@/components/PerformanceMode";
import { SampleBrowser } from "@/components/SampleBrowser";
import { CoproducerPanel } from "@/components/CoproducerPanel";
import { CoverSongModal } from "@/components/CoverSongModal";
import { StatusBar } from "@/components/StatusBar";
import { PatternMatrix } from "@/components/PatternMatrix";
import { FillEnginePanel } from "@/components/FillEnginePanel";
import { AutoMixPanel } from "@/components/AutoMixPanel";
import { ArrangementPanel } from "@/components/ArrangementPanel";
import { CommandPalette } from "@/components/CommandPalette";
import { MidiPanel } from "@/components/MidiPanel";
import { useAudioEngine } from "@/lib/useAudioEngine";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useMidi } from "@/lib/useMidi";
import { useAutoSave } from "@/lib/useAutoSave";
import { useEngineStore } from "@/store/engine";
import { useUiStore } from "@/store/ui";
import "@/store/history";

const TABS = [
  { id: "matrix",       label: "Matrix",  icon: "matrix" },
  { id: "arrange",      label: "Arrange", icon: "arrange" },
  { id: "groove",       label: "Groove",  icon: "groove" },
  { id: "automation",   label: "Auto",    icon: "auto" },
  { id: "fill",         label: "Fill",    icon: "fill" },
  { id: "mix",          label: "Mix",     icon: "mix" },
  { id: "arrange-ai",   label: "Arr+",    icon: "arrange-ai" },
  { id: "performance",  label: "Perf",    icon: "perf" },
  { id: "samples",      label: "Smpl",    icon: "samples" },
  { id: "ai",           label: "Coproducer", icon: "ai" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DAW() {
  const {
    initAudio,
    getTrackMeter,
    getMasterMeter,
    getMasterSpectrum,
    getMasterWaveform,
    getMasterLoudness,
    getMasterTruePeak,
    triggerTrack,
  } = useAudioEngine();
  useKeyboardShortcuts(initAudio, triggerTrack);
  const { status: midiStatus, enable: enableMidi } = useMidi(initAudio, triggerTrack);

  const { lastSaved, recoverAutosave, clearAutosave } = useAutoSave();
  const [mixerOpen, setMixerOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<TabId>("matrix");
  const [coverOpen, setCoverOpen] = useState(false);
  const playbackState = useEngineStore((s) => s.playbackState);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail;
      if (TABS.some((t) => t.id === tab)) {
        setSidebarTab(tab as TabId);
      }
    };
    window.addEventListener("sts-focus-tab", handler);
    return () => window.removeEventListener("sts-focus-tab", handler);
  }, []);

  const [recoveryBanner, setRecoveryBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("sts_session___autosave") !== null;
    } catch {
      return false;
    }
  });

  const handleRecover = useCallback(() => {
    recoverAutosave();
    setRecoveryBanner(false);
  }, [recoverAutosave]);

  const handleDismiss = useCallback(() => {
    clearAutosave();
    setRecoveryBanner(false);
  }, [clearAutosave]);

  const activeTabIndex = TABS.findIndex((t) => t.id === sidebarTab);
  const activeTab = TABS[activeTabIndex] ?? TABS[0];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {recoveryBanner && (
        <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-xl border border-aurora bg-surface-2/80 px-3.5 py-2.5 text-xs shadow-accent-soft backdrop-blur">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-aurora text-white shadow-[0_4px_12px_rgba(168,85,247,0.35)]">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
                <path d="M3 8a5 5 0 1 1 1.46 3.54M3 8V4M3 8h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-soft">Autosave found a recent session.</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRecover} className="button-primary rounded-md px-3 py-1 text-[11px]">Restore</button>
            <button onClick={handleDismiss} className="button-secondary rounded-md px-3 py-1 text-[11px]">Dismiss</button>
          </div>
        </div>
      )}

      <header className="relative flex items-center gap-3 border-b border-border bg-surface/85 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <BrandMark isPlaying={playbackState === "playing"} />
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold tracking-tight text-foreground">
              Stump<span className="text-aurora">The</span>Schwab
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-muted">Studio · Aurora</div>
          </div>
        </div>
        <div className="mx-2 h-7 w-px bg-border" />
        <div className="min-w-0 flex-1">
          <Transport onInit={initAudio} lastSaved={lastSaved} />
        </div>
        <div className={`sts-aurora-line pointer-events-none absolute inset-x-0 -bottom-px ${playbackState === "playing" ? "is-playing" : ""}`} />
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Vertical activity rail ───────────────────────── */}
        <nav
          aria-label="Workspace"
          className="sts-rail hidden md:flex"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSidebarTab(tab.id)}
              className={`sts-rail-btn ${sidebarTab === tab.id ? "is-active" : ""}`}
              aria-pressed={sidebarTab === tab.id}
              aria-label={tab.label}
              title={tab.label}
            >
              <RailIcon name={tab.icon} />
              <span className="sts-rail-label">{tab.label}</span>
            </button>
          ))}
          <div className="mt-auto">
            <div className="sts-rail-divider" />
            <button
              type="button"
              onClick={() => useUiStore.getState().setHelpOpen(true)}
              className="sts-rail-btn"
              aria-label="Help"
              title="Help & shortcuts"
            >
              <RailIcon name="help" />
              <span className="sts-rail-label">Help</span>
            </button>
          </div>
        </nav>

        {/* ── Center canvas + right panel ──────────────────── */}
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-1.5 p-1.5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="panel flex min-h-0 flex-col overflow-hidden rounded-xl">
            <StepSequencer />
            <PianoRoll />
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl panel">
            {/* Mobile/tab strip — only when rail is hidden */}
            <div className="md:hidden border-b border-border p-1.5">
              <div className="sts-tabbar">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSidebarTab(tab.id)}
                    className={`sts-tab ${sidebarTab === tab.id ? "is-active" : ""}`}
                    aria-pressed={sidebarTab === tab.id}
                    title={tab.label}
                  >
                    <TabIcon name={tab.icon} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right panel header — shows active workspace */}
            <div className="hidden md:flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-2/60 px-3 py-2 backdrop-blur">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-aurora text-white shadow-[0_4px_12px_rgba(168,85,247,0.30)]">
                  <RailIcon name={activeTab.icon} small />
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted truncate">Workspace</div>
                  <div className="text-[12px] font-bold tracking-tight text-foreground truncate">{activeTab.label}</div>
                </div>
              </div>
              <span className="rounded-full border border-border bg-surface-3 px-2 py-0.5 font-mono text-[9px] tracking-wider text-muted">
                {String((activeTabIndex < 0 ? 0 : activeTabIndex) + 1).padStart(2, "0")} / {String(TABS.length).padStart(2, "0")}
              </span>
            </div>

            {/* Scrollable panel body */}
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
              {sidebarTab === "matrix" && (
                <div className="panel rounded-xl p-3">
                  <SectionHeader eyebrow="Launch" title="Pattern matrix" />
                  <PatternMatrix />
                </div>
              )}

              {sidebarTab === "arrange" && (
                <>
                  <QuickStartPanel />
                  <div className="panel rounded-xl p-2">
                    <SectionHeader eyebrow="Arrange" title="Song chain" />
                    <SongChain />
                  </div>
                </>
              )}

              {sidebarTab === "groove" && <GroovePanel />}
              {sidebarTab === "automation" && <AutomationEditor />}

              {sidebarTab === "fill" && (
                <div className="panel rounded-xl p-3">
                  <SectionHeader eyebrow="Smart" title="Fill engine" />
                  <FillEnginePanel />
                </div>
              )}

              {sidebarTab === "mix" && (
                <div className="panel rounded-xl p-3">
                  <SectionHeader eyebrow="AI" title="AutoMix" />
                  <AutoMixPanel />
                </div>
              )}

              {sidebarTab === "arrange-ai" && (
                <div className="panel rounded-xl p-3">
                  <SectionHeader eyebrow="Smart" title="Arrangement AI" />
                  <ArrangementPanel />
                </div>
              )}

              {sidebarTab === "performance" && <PerformanceMode />}
              {sidebarTab === "samples" && <SampleBrowser />}
              {sidebarTab === "ai" && (
                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                  <button
                    onClick={() => setCoverOpen(true)}
                    className="group flex items-center justify-between rounded-xl border border-aurora bg-surface-2/70 px-3 py-2.5 text-left text-[11px] shadow-accent-soft transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-aurora text-white shadow-[0_4px_12px_rgba(168,85,247,0.35)]">
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                          <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div>
                        <div className="font-bold text-foreground">Cover a Song</div>
                        <div className="text-[10px] text-muted">Drop in audio → remix-ready arrangement</div>
                      </div>
                    </div>
                    <span className="text-[14px] text-accent transition-transform group-hover:translate-x-0.5">›</span>
                  </button>
                  <CoproducerPanel />
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>

      <footer className={`relative border-t border-border bg-surface/90 backdrop-blur-md ${playbackState === "playing" && mixerOpen ? "sts-master-hot" : ""}`}>
        <button
          onClick={() => setMixerOpen((open) => !open)}
          className="group flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-surface-2"
        >
          <div className="flex items-center gap-2.5">
            <span className={`text-[10px] text-muted transition-transform ${mixerOpen ? "rotate-90 text-accent" : ""}`}>▸</span>
            <MixerEqGlyph isPlaying={playbackState === "playing"} />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">Mixer</span>
            <span className="text-[11px] text-soft">{mixerOpen ? "Channel strips, FX, master" : "Click to open mix view"}</span>
          </div>
          <span className="text-[10px] font-mono text-muted">{mixerOpen ? "Esc to close" : "Click to open"}</span>
        </button>
        {mixerOpen && (
          <div className="border-t border-border">
            <Mixer
              getTrackMeter={getTrackMeter}
              getMasterMeter={getMasterMeter}
              getMasterSpectrum={getMasterSpectrum}
              getMasterWaveform={getMasterWaveform}
              getLoudness={getMasterLoudness}
              getTruePeak={getMasterTruePeak}
            />
          </div>
        )}
      </footer>

      <HelpOverlay />
      <GeneratorModal />
      <CoverSongModal open={coverOpen} onClose={() => setCoverOpen(false)} />
      <CommandPalette onInit={initAudio} />
      <MidiPanel status={midiStatus} onEnable={enableMidi} />

      <StatusBar getMasterMeter={getMasterMeter} getMasterWaveform={getMasterWaveform} midiStatus={midiStatus} />

      <style jsx global>{`
        .kbd {
          display: inline-block;
          padding: 0 5px;
          margin: 0 1px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--foreground-soft);
          background: var(--surface-3);
          border: 1px solid var(--border-strong);
          border-bottom-width: 2px;
          border-radius: 4px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

function QuickStartPanel() {
  const headingId = "quick-start-heading";
  return (
    <section aria-labelledby={headingId} className="panel rounded-xl p-2.5 shadow-accent-soft">
      <SectionHeader id={headingId} eyebrow="Start here" title="Make a beat in 3 moves" />
      <ol className="mt-1.5 space-y-1.5 text-[11px] text-soft">
        <li className="flex gap-2">
          <span className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-aurora text-[9px] font-bold text-white shadow-[0_2px_6px_rgba(168,85,247,0.4)]">1</span>
          <span><strong className="text-foreground">Generate</strong> for an instant idea, or paint the grid.</span>
        </li>
        <li className="flex gap-2">
          <span className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-aurora text-[9px] font-bold text-white shadow-[0_2px_6px_rgba(168,85,247,0.4)]">2</span>
          <span><strong className="text-foreground">Play</strong>, then drag steps to add or remove hits.</span>
        </li>
        <li className="flex gap-2">
          <span className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-aurora text-[9px] font-bold text-white shadow-[0_2px_6px_rgba(168,85,247,0.4)]">3</span>
          <span>Double-click any lit step to shape velocity, chance, timing, and notes.</span>
        </li>
      </ol>
      <div className="mt-2.5 flex gap-1.5">
        <button onClick={() => useUiStore.getState().setGeneratorOpen(true)} className="button-primary flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">Start with AI</button>
        <button onClick={() => useUiStore.getState().setHelpOpen(true)} className="button-secondary rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]">Help</button>
      </div>
    </section>
  );
}

function BrandMark({ isPlaying }: { isPlaying?: boolean }) {
  return (
    <div
      className={`relative flex h-8 w-8 items-center justify-center rounded-lg sts-brand-aurora shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_18px_rgba(168,85,247,0.4)] ${isPlaying ? "sts-brand-breathe" : ""}`}
      aria-hidden="true"
    >
      {/* Inner glass */}
      <span className="pointer-events-none absolute inset-[2px] rounded-md bg-[rgba(8,8,14,0.55)] backdrop-blur-[2px]" />
      {/* Stylized "S" waveform monogram */}
      <svg viewBox="0 0 16 16" fill="none" className="relative h-4 w-4" aria-hidden="true">
        <defs>
          <linearGradient id="sts-mono" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#fbcfe8" />
          </linearGradient>
        </defs>
        <path
          d="M11.5 4.2c-.9-.7-2-1.1-3.2-1.1-1.9 0-3.4 1-3.4 2.5 0 3 6.6 1.5 6.6 4.7 0 1.6-1.6 2.7-3.6 2.7-1.4 0-2.6-.5-3.5-1.3"
          stroke="url(#sts-mono)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="8" r="0.9" fill="#ffffff" opacity="0.95" />
      </svg>
    </div>
  );
}

function SectionHeader({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <h2 {...(id ? { id } : {})} className="flex items-center text-[12px] font-bold tracking-tight text-foreground">
        <span className="sts-section-rule" aria-hidden="true" />
        {title}
      </h2>
      <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted">{eyebrow}</span>
    </div>
  );
}

function MixerEqGlyph({ isPlaying }: { isPlaying?: boolean }) {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
      {[0.45, 0.85, 0.6, 1.0, 0.55].map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-sm bg-aurora"
          style={{
            height: `${h * 100}%`,
            opacity: isPlaying ? 0.95 : 0.55,
            animation: isPlaying ? `sts-breathe ${0.45 + i * 0.07}s ease-in-out infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
}

function TabIcon({ name }: { name: string }) {
  return <Icon name={name} size={12} />;
}

function RailIcon({ name, small = false }: { name: string; small?: boolean }) {
  return <Icon name={name} size={small ? 12 : 18} className="sts-rail-icon" />;
}

function Icon({ name, size, className }: { name: string; size: number; className?: string }) {
  const common = {
    className: className ?? "sts-tab-icon",
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "matrix":
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="3" height="3" rx="0.6" />
          <rect x="6.5" y="2.5" width="3" height="3" rx="0.6" />
          <rect x="10.5" y="2.5" width="3" height="3" rx="0.6" />
          <rect x="2.5" y="6.5" width="3" height="3" rx="0.6" />
          <rect x="6.5" y="6.5" width="3" height="3" rx="0.6" fill="currentColor" />
          <rect x="10.5" y="6.5" width="3" height="3" rx="0.6" />
          <rect x="2.5" y="10.5" width="3" height="3" rx="0.6" />
          <rect x="6.5" y="10.5" width="3" height="3" rx="0.6" />
          <rect x="10.5" y="10.5" width="3" height="3" rx="0.6" fill="currentColor" />
        </svg>
      );
    case "arrange":
      return (
        <svg {...common}>
          <rect x="2"  y="4"  width="4" height="3" rx="0.6" fill="currentColor" />
          <rect x="6.5" y="4" width="3" height="3" rx="0.6" />
          <rect x="10" y="4" width="4" height="3" rx="0.6" />
          <rect x="2"  y="9"  width="3" height="3" rx="0.6" />
          <rect x="5.5" y="9" width="5" height="3" rx="0.6" fill="currentColor" />
          <rect x="11" y="9" width="3" height="3" rx="0.6" />
        </svg>
      );
    case "groove":
      return (
        <svg {...common}>
          <path d="M2 8c1.5-3 3-3 4 0s2.5 3 4 0 2.5-3 4 0" />
        </svg>
      );
    case "auto":
      return (
        <svg {...common}>
          <path d="M2 12 6 6l3 4 5-7" />
          <circle cx="6" cy="6" r="1" fill="currentColor" />
          <circle cx="9" cy="10" r="1" fill="currentColor" />
        </svg>
      );
    case "fill":
      return (
        <svg {...common}>
          <path d="M2 13V3M5 13V6M8 13V8M11 13V5M14 13V9" />
        </svg>
      );
    case "mix":
      return (
        <svg {...common}>
          <path d="M4 2v12M9 2v12M14 2v12" />
          <circle cx="4"  cy="6"  r="1.6" fill="currentColor" />
          <circle cx="9"  cy="10" r="1.6" fill="currentColor" />
          <circle cx="14" cy="5"  r="1.6" fill="currentColor" />
        </svg>
      );
    case "arrange-ai":
      return (
        <svg {...common}>
          <path d="M3 4h10M3 8h7M3 12h10" />
          <path d="M12.5 7.5l1 1.6 1.6 1-1.6 1-1 1.6-1-1.6-1.6-1 1.6-1z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "perf":
      return (
        <svg {...common}>
          <rect x="2.5" y="9" width="2.5" height="4" rx="0.5" fill="currentColor" />
          <rect x="6.5" y="6" width="2.5" height="7" rx="0.5" fill="currentColor" />
          <rect x="10.5" y="3" width="2.5" height="10" rx="0.5" fill="currentColor" />
        </svg>
      );
    case "samples":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
          <path d="M8 2.5v2.5M8 11v2.5M2.5 8h2.5M11 8h2.5" />
        </svg>
      );
    case "ai":
      return (
        <svg {...common}>
          <path d="M8 2l1.4 3.2L12.6 6 9.8 7.6 8 11l-1.8-3.4L3.4 6l3.2-.8z" fill="currentColor" stroke="none" />
          <circle cx="13" cy="12" r="1.2" fill="currentColor" />
          <circle cx="3.5" cy="12.5" r="0.8" fill="currentColor" />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M6.3 6.2c.2-.9 1-1.5 1.9-1.5 1 0 1.8.7 1.8 1.7 0 .8-.5 1.2-1.1 1.6-.5.3-.9.6-.9 1.3" />
          <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}
