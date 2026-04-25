"use client";

import { useEngineStore, type Sample } from "@/store/engine";
import { useState, useRef } from "react";
import { RecorderModal } from "./RecorderModal";

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
    <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-[#0a0f18]/80 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Sample Browser</h3>
        <div className="flex gap-2">
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

      {/* Upload Section */}
      {showUpload && (
        <div className="flex flex-col gap-2 rounded border border-purple-400/20 bg-purple-500/5 p-3">
          <label className="text-xs font-medium text-white/80">Upload Audio Files</label>
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
        className="rounded border border-white/10 bg-[#070b12] px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-purple-400/50 focus:outline-none"
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
      <div className="flex flex-col gap-2 rounded border border-white/10 bg-white/[0.02] p-3">
        <label className="text-xs font-medium text-white/70">Load samples to track:</label>
        <select
          value={selectedTrack === null ? "" : selectedTrack}
          onChange={(e) =>
            setSelectedTrack(e.target.value === "" ? null : parseInt(e.target.value))
          }
          className="rounded border border-white/10 bg-[#070b12] px-3 py-2 text-sm text-white/90"
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
          <div className="rounded border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
            {searchQuery
              ? `No samples found for "${searchQuery}"`
              : "No samples in this category. Upload some to get started!"}
          </div>
        ) : (
          displaySamples.map((sample) => (
            <div
              key={sample.id}
              className="flex items-center justify-between rounded border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.04]"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-white/90">{sample.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-white/60">
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
                        className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50"
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
                      ? "cursor-not-allowed bg-white/5 text-white/30"
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
