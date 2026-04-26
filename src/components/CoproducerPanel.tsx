"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useEngineStore, type GeneratedBeat } from "@/store/engine";
import {
  addLearning,
  buildMemoryContext,
  clearMemory,
  loadMemory,
  type LearningCategory,
} from "@/lib/projectMemory";
import {
  applyMixPatch,
  applyMixPatches,
  type MixPatch,
} from "@/lib/patchValidation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  chips?: ActionChip[];
}

interface ActionChip {
  label: string;
}

// ── Project state serializer ──────────────────────────────────────────────────

function useProjectState(): () => string {
  return useCallback(() => {
    const s = useEngineStore.getState();
    const trackNames = ["kick","snare","hihat","openhat","clap","tom","perc","bass"];
    return JSON.stringify({
      bpm: s.bpm,
      swing: s.swing,
      totalSteps: s.totalSteps,
      songMode: s.songMode,
      activeKitPackId: s.activeKitPackId,
      currentPattern: s.currentPattern,
      patternNames: s.patterns.map((p) => p.name),
      tracks: s.tracks.slice(0, 8).map((t, i) => ({
        id: i,
        name: trackNames[i] ?? `track${i}`,
        synth: t.sound.synth,
        volume: Math.round(t.volume * 100) / 100,
        pan: Math.round(t.pan * 100) / 100,
        muted: t.muted,
        solo: t.solo,
      })),
      master: {
        volume:             s.master.volume,
        compressorOn:       s.master.compressorOn,
        compressorThreshold:s.master.compressorThreshold,
        limiterOn:          s.master.limiterOn,
        limiterThreshold:   s.master.limiterThreshold,
        eqOn:               s.master.eqOn,
        eqLow:              s.master.eqLow,
        eqMid:              s.master.eqMid,
        eqHigh:             s.master.eqHigh,
        tapeOn:             s.master.tapeOn,
        tapeAmount:         s.master.tapeAmount,
        widthOn:            s.master.widthOn,
        width:              s.master.width,
        loudnessTarget:     s.master.loudnessTarget,
      },
    });
  }, []);
}

// ── Tool dispatcher ───────────────────────────────────────────────────────────

function useToolDispatcher() {
  const applyGeneratedBeat   = useEngineStore((s) => s.applyGeneratedBeat);
  const setTrackSynthType    = useEngineStore((s) => s.setTrackSynthType);
  const setTrackSoundOptions = useEngineStore((s) => s.setTrackSoundOptions);
  const setBpm               = useEngineStore((s) => s.setBpm);
  const setSwing             = useEngineStore((s) => s.setSwing);
  const setSongMode          = useEngineStore((s) => s.setSongMode);
  const setTotalSteps        = useEngineStore((s) => s.setTotalSteps);
  const loadKitPack          = useEngineStore((s) => s.loadKitPack);

  return useCallback(
    (name: string, input: Record<string, unknown>): ActionChip => {
      switch (name) {
        case "create_beat": {
          applyGeneratedBeat(input as unknown as GeneratedBeat);
          const beatName = typeof input.name === "string" ? input.name : "beat";
          return { label: `Beat: "${beatName}"` };
        }

        case "apply_mix_patches": {
          const patches = Array.isArray(input.patches) ? (input.patches as MixPatch[]) : [];
          const applied = applyMixPatches(patches);
          return { label: `Mix: ${applied} patch${applied !== 1 ? "es" : ""}` };
        }

        case "design_sound": {
          const trackId = typeof input.trackId === "number" ? input.trackId : 0;
          const synth   = typeof input.synth   === "string" ? input.synth   : "synth";
          const options = typeof input.options === "object" && input.options !== null
            ? (input.options as Record<string, unknown>)
            : {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setTrackSynthType(trackId, synth as any);
          setTrackSoundOptions(trackId, options);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sts-track-play", { detail: { index: trackId } }));
          }
          const trackNames = ["kick","snare","hihat","openhat","clap","tom","perc","bass"];
          return { label: `Sound: ${trackNames[trackId] ?? `track ${trackId}`}` };
        }

        case "set_transport": {
          const labels: string[] = [];
          if (typeof input.bpm        === "number")  { setBpm(input.bpm);              labels.push(`${input.bpm} BPM`); }
          if (typeof input.swing      === "number")  { setSwing(input.swing);           labels.push(`swing ${Math.round(input.swing * 100)}%`); }
          if (typeof input.songMode   === "boolean") { setSongMode(input.songMode);     labels.push(input.songMode ? "song on" : "song off"); }
          if (typeof input.totalSteps === "number")  { setTotalSteps(input.totalSteps); labels.push(`${input.totalSteps} steps`); }
          return { label: `Transport: ${labels.join(", ") || "updated"}` };
        }

        case "set_master_fx": {
          const key = typeof input.key === "string" ? input.key : "";
          if (key) {
            applyMixPatch({ type: "master", key, value: input.value });
          }
          return { label: `Master: ${key}` };
        }

        case "load_kit_pack": {
          const packId     = typeof input.packId     === "string"  ? input.packId     : "boombap";
          const applyTempo = typeof input.applyTempo === "boolean" ? input.applyTempo : false;
          loadKitPack(packId, applyTempo);
          return { label: `Kit: ${packId}` };
        }

        case "remember": {
          const text     = typeof input.text     === "string" ? input.text     : "";
          const category = typeof input.category === "string" ? input.category : "fact";
          if (text) {
            addLearning(text, category as LearningCategory);
          }
          return { label: `Remembered` };
        }

        default:
          return { label: name };
      }
    },
    [applyGeneratedBeat, setTrackSynthType, setTrackSoundOptions, setBpm,
     setSwing, setSongMode, setTotalSteps, loadKitPack],
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export const CoproducerPanel = memo(function CoproducerPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  const getProjectState = useProjectState();
  const dispatchTool    = useToolDispatcher();

  // streaming accumulator
  const streamTextRef  = useRef("");
  const streamChipsRef = useRef<ActionChip[]>([]);

  // Memory count — re-read on memory-changed event so chips update live
  const [memoryCount, setMemoryCount] = useState(0);
  useEffect(() => {
    const update = () => setMemoryCount(loadMemory().learnings.length);
    update();
    if (typeof window === "undefined") return;
    window.addEventListener("sts-memory-changed", update);
    return () => window.removeEventListener("sts-memory-changed", update);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setStreaming(true);
    streamTextRef.current  = "";
    streamChipsRef.current = [];

    // Add a placeholder assistant message that we'll update in-place
    setMessages((prev) => [...prev, { role: "assistant", content: "", chips: [] }]);

    try {
      const res = await fetch("/api/coproduce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          projectState: getProjectState(),
          memory: buildMemoryContext(),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const updateLastMessage = (content: string, chips?: ActionChip[]) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content, chips: chips ?? next[next.length - 1].chips };
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.startsWith("data: ") ? part.slice(6) : part;
          if (!line.trim()) continue;

          let evt: Record<string, unknown>;
          try { evt = JSON.parse(line); }
          catch { continue; }

          if (evt.type === "text_delta" && typeof evt.text === "string") {
            streamTextRef.current += evt.text;
            updateLastMessage(streamTextRef.current);
          } else if (evt.type === "tool_use") {
            const chip = dispatchTool(
              evt.name as string,
              (evt.input ?? {}) as Record<string, unknown>,
            );
            streamChipsRef.current = [...streamChipsRef.current, chip];
            updateLastMessage(streamTextRef.current, [...streamChipsRef.current]);
          } else if (evt.type === "done") {
            const fullText = typeof evt.fullText === "string" ? evt.fullText : streamTextRef.current;
            updateLastMessage(fullText, [...streamChipsRef.current]);
          } else if (evt.type === "error") {
            updateLastMessage(`⚠ ${evt.message ?? "Unknown error"}`);
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `⚠ ${err instanceof Error ? err.message : "Connection failed"}`,
        };
        return next;
      });
    } finally {
      setStreaming(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [input, messages, streaming, getProjectState, dispatchTool]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">AI Co-Producer</span>
        {memoryCount > 0 && (
          <button
            onClick={() => {
              if (window.confirm(`Clear ${memoryCount} learning${memoryCount !== 1 ? "s" : ""}?`)) {
                clearMemory();
              }
            }}
            title="Click to clear project memory"
            className="ml-auto rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold text-accent hover:bg-accent/30"
          >
            🧠 {memoryCount}
          </button>
        )}
        <span className={`text-[10px] text-muted ${memoryCount > 0 ? "" : "ml-auto"}`}>Opus 4.7</span>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
        style={{ scrollbarWidth: "none" }}
      >
        {messages.length === 0 && (
          <div className="mt-4 space-y-2 text-center text-[11px] text-muted">
            <p className="font-medium text-soft">Your AI co-producer is ready.</p>
            <p>Try: &ldquo;make a dark trap beat at 140&rdquo;</p>
            <p>or: &ldquo;add reverb to the snare&rdquo;</p>
            <p>or: &ldquo;make the bass feel warmer&rdquo;</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-2 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent text-[#1a1408]"
                  : "bg-surface-2 text-foreground"
              }`}
            >
              {msg.content
                ? msg.content
                : msg.role === "assistant"
                ? <span className="animate-pulse text-muted">thinking…</span>
                : null}

              {/* Action chips */}
              {msg.chips && msg.chips.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {msg.chips.map((chip, ci) => (
                    <span
                      key={ci}
                      className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                    >
                      ✓ {chip.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Streaming cursor */}
        {streaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
          <div className="mb-2 flex justify-start">
            <div className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px]">
              <span className="animate-pulse text-muted">thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything…"
            rows={1}
            disabled={streaming}
            className="min-h-[32px] flex-1 resize-none rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50"
            style={{ maxHeight: "80px", lineHeight: "1.5" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            className="button-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[13px] disabled:opacity-40"
            aria-label="Send"
          >
            {streaming ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#1a1408] border-t-transparent" />
            ) : (
              "↑"
            )}
          </button>
        </div>
        <p className="mt-1 text-[9px] text-muted">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
});
