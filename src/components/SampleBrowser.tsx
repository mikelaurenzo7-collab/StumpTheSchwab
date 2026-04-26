"use client";

import { useEngineStore, type Sample } from "@/store/engine";
import { useState, useRef, useCallback } from "react";
import { RecorderModal } from "./RecorderModal";
import { analyzeReference, type ReferenceDescriptor } from "@/lib/refAnalyzer";
import type { RefMatchResult } from "@/app/api/ref-match/route";
import { applyMixPatches, type MixPatch } from "@/lib/patchValidation";

export function SampleBrowser() {
  const {
    sampleLibrary,
    sampleCategories,
    tracks,
    addSampleToLibrary,
    removeSampleFromLibrary,
    loadSampleFromLibrary,
    filterSamplesByCategory,
    searchSamples,
  } = useEngineStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);

  // Reference match state
  const [showRefMatch, setShowRefMatch]   = useState(false);
  const [analyzing, setAnalyzing]         = useState(false);
  const [refDescriptor, setRefDescriptor] = useState<ReferenceDescriptor | null>(null);
  const [refResult, setRefResult]         = useState<RefMatchResult | null>(null);
  const [refError, setRefError]           = useState<string | null>(null);
  const [appliedRef, setAppliedRef]       = useState(false);

  const refFileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    setBpm, setSwing, loadKitPack,
  } = useEngineStore();

  const displaySamples =
    searchQuery.trim() !== ""
      ? searchSamples(searchQuery)
      : selectedCategory
        ? filterSamplesByCategory(selectedCategory)
        : sampleLibrary;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const sample: Sample = {
        id: `sample-${Date.now()}-${Math.random()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url,
        category: "Custom",
        tags: [],
      };
      addSampleToLibrary(sample);
    });

    setShowUpload(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLoadSample = (sampleId: string) => {
    if (selectedTrack === null) {
      alert("Please select a track first");
      return;
    }
    loadSampleFromLibrary(selectedTrack, sampleId);
  };

  // ── Reference match handlers ───────────────────────────────────────────────

  const buildProjectState = useCallback(() => {
    const s = useEngineStore.getState();
    return JSON.stringify({
      bpm: s.bpm,
      swing: s.swing,
      activeKitPackId: s.activeKitPackId,
      tracks: s.tracks.slice(0, 8).map((t, i) => ({
        id: i,
        volume: t.volume,
        pan: t.pan,
        muted: t.muted,
      })),
      master: {
        volume: s.master.volume,
        eqLow: s.master.eqLow,
        eqMid: s.master.eqMid,
        eqHigh: s.master.eqHigh,
        eqOn: s.master.eqOn,
        compressorOn: s.master.compressorOn,
        tapeOn: s.master.tapeOn,
        widthOn: s.master.widthOn,
      },
    });
  }, []);

  const handleRefFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefError(null);
    setRefResult(null);
    setRefDescriptor(null);
    setAppliedRef(false);
    setAnalyzing(true);
    try {
      const descriptor = await analyzeReference(file);
      setRefDescriptor(descriptor);
    } catch (err) {
      setRefError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
      if (refFileRef.current) refFileRef.current.value = "";
    }
  }, []);

  const runRefMatch = useCallback(async () => {
    if (!refDescriptor) return;
    setRefError(null);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ref-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: refDescriptor, projectState: buildProjectState() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRefResult(json as RefMatchResult);
    } catch (err) {
      setRefError(err instanceof Error ? err.message : "Match failed");
    } finally {
      setAnalyzing(false);
    }
  }, [refDescriptor, buildProjectState]);

  const applyRefPatches = useCallback(() => {
    if (!refResult) return;
    applyMixPatches(refResult.mix_patches as MixPatch[]);
    if (refResult.bpm)   setBpm(refResult.bpm);
    if (refResult.swing != null) setSwing(refResult.swing);
    if (refResult.kit_suggestion) loadKitPack(refResult.kit_suggestion, false);
    setAppliedRef(true);
  }, [refResult, setBpm, setSwing, loadKitPack]);

  return (
    <>
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-[#0a0f18]/80 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Sample Browser</h3>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowRefMatch((v) => !v); setRefResult(null); setRefDescriptor(null); setRefError(null); }}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${showRefMatch ? "bg-accent/30 text-accent" : "bg-accent/10 text-accent hover:bg-accent/20"}`}
          >
            ✦ Match Ref
          </button>
          <button
            onClick={() => setShowRecorder(true)}
            className="flex items-center gap-1 flex-row rounded bg-yellow-500/20 px-3 py-1.5 text-xs text-yellow-400 hover:bg-yellow-500/30"
          >
            ● Record
          </button>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="rounded bg-purple-500/20 px-3 py-1.5 text-xs text-purple-400 hover:bg-purple-500/30"
          >
            + Upload
          </button>
        </div>
      </div>

      {/* ── Reference Match panel ─────────────────────────────── */}
      {showRefMatch && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <p className="mb-2 text-[11px] font-semibold text-accent">AI Reference Match</p>
          <p className="mb-3 text-[10px] text-muted">
            Drop a reference track — Claude analyses its tonal balance and suggests patches to shift your mix toward it.
          </p>

          {/* File picker */}
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-accent/40 bg-accent/5 px-3 py-2 text-[11px] text-soft hover:bg-accent/10">
            <span>{refDescriptor ? "✓ Analysed" : "Choose audio file…"}</span>
            <input
              ref={refFileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleRefFile}
              disabled={analyzing}
            />
          </label>

          {/* Descriptor preview */}
          {refDescriptor && !refResult && (
            <div className="mt-2 rounded-md bg-surface-2 p-2 text-[10px] text-muted">
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span>⏱ {Math.round(refDescriptor.durationSeconds)}s</span>
                {refDescriptor.estimatedBpm && <span>♩ ~{refDescriptor.estimatedBpm} BPM</span>}
                <span>Peak {Math.round(refDescriptor.peakLinear * 100)}%</span>
                <span>RMS {(20 * Math.log10(Math.max(refDescriptor.overallRms, 1e-6))).toFixed(1)} dB</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px]">
                {(["sub","bass","loMid","mid","presence","air"] as const).map((z) => (
                  <span key={z} className="text-soft">
                    {z} {(20 * Math.log10(Math.max(refDescriptor.zones[z], 1e-6))).toFixed(0)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Match button */}
          {refDescriptor && !refResult && (
            <button
              onClick={runRefMatch}
              disabled={analyzing}
              className="mt-2 w-full rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-[#1a1408] disabled:opacity-50"
            >
              {analyzing ? "Analysing…" : "Match with Claude"}
            </button>
          )}

          {/* Results */}
          {refResult && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-soft">{refResult.explanation}</p>

              {/* Suggestions summary */}
              <div className="flex flex-wrap gap-1">
                {refResult.bpm && (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-foreground">
                    ♩ {refResult.bpm} BPM
                  </span>
                )}
                {refResult.kit_suggestion && (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-foreground">
                    Kit: {refResult.kit_suggestion}
                  </span>
                )}
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-foreground">
                  {refResult.mix_patches.length} patch{refResult.mix_patches.length !== 1 ? "es" : ""}
                </span>
              </div>

              <button
                onClick={applyRefPatches}
                disabled={appliedRef}
                className="w-full rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-[#1a1408] disabled:opacity-60"
              >
                {appliedRef ? "✓ Applied" : "Apply All"}
              </button>

              <button
                onClick={() => { setRefResult(null); setRefDescriptor(null); setAppliedRef(false); }}
                className="w-full rounded-md border border-border px-3 py-1 text-[10px] text-muted hover:text-foreground"
              >
                Try another reference
              </button>
            </div>
          )}

          {/* Error */}
          {refError && (
            <p className="mt-2 text-[11px] text-red-400">⚠ {refError}</p>
          )}
        </div>
      )}

      {/* Upload Section */}
      {showUpload && (
        <div className="flex flex-col gap-2 rounded border border-purple-400/20 bg-purple-500/5 p-3">
          <label className="text-xs font-medium text-soft">Upload Audio Files</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileUpload}
            className="text-xs text-white/70"
          />
          <div className="text-xs text-white/50">
            Supports: WAV, MP3, OGG, FLAC (browser-dependent)
          </div>
        </div>
      )}

      {/* Search Bar */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search samples..."
        className="rounded border border-border bg-[#070b12] px-3 py-2 text-sm text-foreground placeholder:text-white/30 focus:border-purple-400/50 focus:outline-none"
      />

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setSelectedCategory(null);
            setSearchQuery("");
          }}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            selectedCategory === null
              ? "bg-purple-500 text-white"
              : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          All
        </button>
        {sampleCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setSelectedCategory(cat);
              setSearchQuery("");
            }}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              selectedCategory === cat
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Target Track Selector */}
      <div className="flex flex-col gap-2 rounded border border-border bg-surface-3 p-3">
        <label className="text-xs font-medium text-white/70">Load samples to track:</label>
        <select
          value={selectedTrack === null ? "" : selectedTrack}
          onChange={(e) =>
            setSelectedTrack(e.target.value === "" ? null : parseInt(e.target.value))
          }
          className="rounded border border-border bg-[#070b12] px-3 py-2 text-sm text-foreground"
        >
          <option value="">Select a track...</option>
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>
              Track {track.id + 1}: {track.sound.name}
            </option>
          ))}
        </select>
      </div>

      {/* Sample List */}
      <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
        {displaySamples.length === 0 ? (
          <div className="rounded border border-dashed border-border p-8 text-center text-sm text-white/40">
            {searchQuery
              ? `No samples found for "${searchQuery}"`
              : "No samples in this category. Upload some to get started!"}
          </div>
        ) : (
          displaySamples.map((sample) => (
            <div
              key={sample.id}
              className="flex items-center justify-between rounded border border-border bg-surface-3 p-3 hover:bg-surface-3"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{sample.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-400">
                    {sample.category}
                  </span>
                  {sample.bpm && <span>{sample.bpm} BPM</span>}
                  {sample.key && <span>{sample.key}</span>}
                </div>
                {sample.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {sample.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-white/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleLoadSample(sample.id)}
                  disabled={selectedTrack === null}
                  className={`rounded px-3 py-1.5 text-xs font-medium ${
                    selectedTrack === null
                      ? "cursor-not-allowed bg-surface-3 text-white/30"
                      : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                  }`}
                >
                  Load
                </button>
                <button
                  onClick={() => removeSampleFromLibrary(sample.id)}
                  className="rounded px-2 py-1 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-2 border-t border-white/5 pt-3 text-xs text-white/50">
        <div className="mb-1 font-medium">Browser Tips:</div>
        <ul className="ml-3 list-disc space-y-0.5 text-[11px]">
          <li>Select a target track before loading samples</li>
          <li>Use search or category filters to find sounds quickly</li>
          <li>Upload your own samples for custom sound design</li>
          <li>Samples are stored locally in your browser</li>
        </ul>
      </div>
    </div>
      {showRecorder && <RecorderModal onClose={() => setShowRecorder(false)} />}
    </>
  );
}
