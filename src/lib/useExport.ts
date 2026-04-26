"use client";

import JSZip from "jszip";
import { useCallback, useState } from "react";
import * as Tone from "tone";
import { PATTERN_LABELS, useEngineStore, type MasterBus, type Track } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";
import { getStepDurationSeconds, getStepSubdivision, type StepSubdivision } from "@/lib/stepTiming";

type SynthNode =
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.NoiseSynth
  | Tone.Synth
  | Tone.AMSynth
  | Tone.FMSynth
  | Tone.MonoSynth
  | Tone.Sampler;

function createOfflineSynth(sound: TrackSound): SynthNode {
  const opts = (sound.options ?? {}) as Record<string, unknown>;
  switch (sound.synth) {
    case "membrane":
      return new Tone.MembraneSynth(opts as ConstructorParameters<typeof Tone.MembraneSynth>[0]);
    case "metal":
      return new Tone.MetalSynth(opts as ConstructorParameters<typeof Tone.MetalSynth>[0]);
    case "noise":
      return new Tone.NoiseSynth(opts as ConstructorParameters<typeof Tone.NoiseSynth>[0]);
    case "am":
      return new Tone.AMSynth(opts as ConstructorParameters<typeof Tone.AMSynth>[0]);
    case "fm":
      return new Tone.FMSynth(opts as ConstructorParameters<typeof Tone.FMSynth>[0]);
    case "monosynth":
      return new Tone.MonoSynth(opts as ConstructorParameters<typeof Tone.MonoSynth>[0]);
    case "mic":
      // Live mode uses Tone.UserMedia (mic input). Offline render can't
      // capture mic — but if the user has saved a recording it will have
      // been loaded as a sample and the sampler branch above takes over.
      // For an empty mic slot, return a silent placeholder so steps don't
      // trigger an audible Tone.Synth fallback.
      console.warn("[export] mic track without a recording — exporting as silent.");
      return new Tone.Synth({ volume: -Infinity });
    case "synth":
    default:
      return new Tone.Synth(opts as ConstructorParameters<typeof Tone.Synth>[0]);
  }
}

// WAV encoding lives in wavEncoder.ts so songAnalyzer (Cover Song) can share it.
import { encodeWAV } from "./wavEncoder";

type PatternRenderData = {
  steps: number[][];
  notes?: string[][];
  probabilities?: number[][];
  nudge?: number[][];
};

interface PreparedTrackRender {
  sourceTrack: Track;
  steps: number[];
  probabilities: number[];
  notes: string[];
  nudge: number[];
  audible: boolean;
}

interface PreparedRenderData {
  bpm: number;
  swing: number;
  totalSteps: number;
  loops: number;
  chain: number[];
  currentPattern: number;
  currentPatternName: string;
  patternNames: string[];
  master: MasterBus;
  tracks: PreparedTrackRender[];
  inSongMode: boolean;
  sequenceLength: number;
  totalDuration: number;
  stepDurationSeconds: number;
  stepSubdivision: StepSubdivision;
  baseName: string;
}

type TriggerPlan = boolean[][][];

export type StemRenderMode =
  | "dry-pre-fader"
  | "dry-post-fader"
  | "fx-pre-fader"
  | "fx-post-fader";

export interface StemExportOptions {
  loops: number;
  renderMode: StemRenderMode;
  includeMasterPrint: boolean;
}

export const STEM_RENDER_MODE_OPTIONS: Array<{
  value: StemRenderMode;
  label: string;
  hint: string;
}> = [
  {
    value: "fx-post-fader",
    label: "FX Post",
    hint: "Per-track FX plus current level and pan.",
  },
  {
    value: "fx-pre-fader",
    label: "FX Pre",
    hint: "Per-track FX at unity gain and centered pan.",
  },
  {
    value: "dry-post-fader",
    label: "Dry Post",
    hint: "Dry source with current level and pan.",
  },
  {
    value: "dry-pre-fader",
    label: "Dry Pre",
    hint: "Dry source at unity gain and centered pan.",
  },
];

interface RenderPassOptions {
  isolatedTrackIndex: number | null;
  includeTrackFX: boolean;
  includeTrackFader: boolean;
  applyMasterProcessing: boolean;
}

interface StemRenderSettings {
  value: StemRenderMode;
  label: string;
  fileToken: string;
  includeTrackFX: boolean;
  includeTrackFader: boolean;
  description: string;
}

interface ExportMarker {
  markerName: string;
  sectionLabel: string;
  patternLabel: string;
  patternName: string;
  loop: number;
  startSeconds: number;
  startBar: number;
  lengthBars: number;
}

interface ExportMixArtifact {
  fileName: string;
  kind: "premaster-reference" | "master-print";
}

function getStemRenderSettings(renderMode: StemRenderMode): StemRenderSettings {
  switch (renderMode) {
    case "dry-pre-fader":
      return {
        value: renderMode,
        label: "Dry Pre",
        fileToken: "dry-pre-fader",
        includeTrackFX: false,
        includeTrackFader: false,
        description: "Dry source, centered pan, unity gain.",
      };
    case "dry-post-fader":
      return {
        value: renderMode,
        label: "Dry Post",
        fileToken: "dry-post-fader",
        includeTrackFX: false,
        includeTrackFader: true,
        description: "Dry source with current channel balance and pan.",
      };
    case "fx-pre-fader":
      return {
        value: renderMode,
        label: "FX Pre",
        fileToken: "fx-pre-fader",
        includeTrackFX: true,
        includeTrackFader: false,
        description: "Per-track FX printed at unity gain, centered pan.",
      };
    case "fx-post-fader":
    default:
      return {
        value: "fx-post-fader",
        label: "FX Post",
        fileToken: "fx-post-fader",
        includeTrackFX: true,
        includeTrackFader: true,
        description: "Per-track FX plus current level and pan.",
      };
  }
}

/**
 * Concatenates one per-track pattern field across the song chain.
 * Uses live track values for the current pattern, stored pattern values for
 * other chain entries, and the provided fill value for older saved sessions.
 */
function flattenPatternArray<T>(
  tracks: Track[],
  patterns: PatternRenderData[],
  inSongMode: boolean,
  chain: number[],
  currentPattern: number,
  totalSteps: number,
  getLiveValues: (track: Track) => T[],
  getPatternValues: (pattern: PatternRenderData | undefined, trackIndex: number) => T[] | undefined,
  fill: T,
): T[][] {
  return tracks.map((track, trackIdx) => {
    if (!inSongMode) return [...getLiveValues(track)];
    const out: T[] = [];
    for (const patternIdx of chain) {
      const src =
        patternIdx === currentPattern
          ? getLiveValues(track)
          : getPatternValues(patterns[patternIdx], trackIdx) ?? Array(totalSteps).fill(fill);
      for (let step = 0; step < totalSteps; step++) out.push(src[step] ?? fill);
    }
    return out;
  });
}

function isTrackAudible(track: Track, hasSolo: boolean): boolean {
  return hasSolo ? track.solo && !track.muted : !track.muted;
}

function sanitizeFileSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "track";
}

function triggerOfflineSynth(
  synth: SynthNode,
  track: Track,
  time: number,
  velocity: number,
  duration: number,
  noteOverride?: string,
) {
  if (synth instanceof Tone.NoiseSynth) {
    synth.triggerAttackRelease(duration, time, velocity);
  } else if (synth instanceof Tone.Sampler) {
    if (!synth.loaded) return;
    const note = noteOverride || track.sound.note;
    synth.triggerAttackRelease(note, duration, time, velocity);
  } else {
    const note = noteOverride || track.sound.note;
    (synth as Tone.Synth).triggerAttackRelease(note, duration, time, velocity);
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildBaseName(
  bpm: number,
  totalSteps: number,
  inSongMode: boolean,
  chain: number[],
  currentPattern: number,
  currentPatternName: string,
  loops: number,
): string {
  const singlePatternLabel = PATTERN_LABELS[currentPattern]?.toLowerCase() ?? `p${currentPattern + 1}`;
  const singlePatternName = sanitizeFileSegment(currentPatternName);
  const singlePatternToken =
    singlePatternName && singlePatternName !== singlePatternLabel
      ? `${singlePatternLabel}-${singlePatternName}`
      : singlePatternLabel;

  const chainToken = chain.map((patternIndex) => PATTERN_LABELS[patternIndex]?.toLowerCase() ?? "p").join("");
  const arrangementToken =
    inSongMode && chain.length > 0
      ? `song-${chainToken.length <= 8 ? chainToken : `${chainToken.slice(0, 8)}-x${chain.length}`}`
      : singlePatternToken;

  return `sts-${bpm}bpm-${totalSteps}steps-${arrangementToken}${loops > 1 ? `-${loops}x` : ""}`;
}

function prepareRenderData(
  state: ReturnType<typeof useEngineStore.getState>,
  loops: number,
): PreparedRenderData {
  const { bpm, swing, totalSteps, tracks, master, songMode, chain, currentPattern, patterns } = state;

  const inSongMode = songMode && chain.length > 0;
  const sequenceLength = inSongMode ? totalSteps * chain.length : totalSteps;

  const flatSteps = flattenPatternArray(
    tracks,
    patterns,
    inSongMode,
    chain,
    currentPattern,
    totalSteps,
    (track) => track.steps,
    (pattern, trackIdx) => pattern?.steps[trackIdx],
    0,
  );
  const flatProbs = flattenPatternArray(
    tracks,
    patterns,
    inSongMode,
    chain,
    currentPattern,
    totalSteps,
    (track) => track.probabilities,
    (pattern, trackIdx) => pattern?.probabilities?.[trackIdx],
    1,
  );
  const flatNotes = flattenPatternArray(
    tracks,
    patterns,
    inSongMode,
    chain,
    currentPattern,
    totalSteps,
    (track) => track.notes,
    (pattern, trackIdx) => pattern?.notes?.[trackIdx],
    "",
  );
  const flatNudge = flattenPatternArray(
    tracks,
    patterns,
    inSongMode,
    chain,
    currentPattern,
    totalSteps,
    (track) => track.nudge,
    (pattern, trackIdx) => pattern?.nudge?.[trackIdx],
    0,
  );

  const hasSolo = tracks.some((track) => track.solo);
  const stepDurationSeconds = getStepDurationSeconds(bpm, totalSteps);
  const loopDuration = sequenceLength * stepDurationSeconds;
  const tail = 0.5;

  return {
    bpm,
    swing,
    totalSteps,
    loops,
    chain,
    currentPattern,
    currentPatternName: state.patterns[currentPattern]?.name ?? PATTERN_LABELS[currentPattern],
    patternNames: state.patterns.map((pattern, index) => pattern.name ?? PATTERN_LABELS[index]),
    master,
    tracks: tracks.map((track, index) => ({
      sourceTrack: track,
      steps: flatSteps[index],
      probabilities: flatProbs[index],
      notes: flatNotes[index],
      nudge: flatNudge[index],
      audible: isTrackAudible(track, hasSolo),
    })),
    inSongMode,
    sequenceLength,
    totalDuration: loopDuration * loops + tail,
    stepDurationSeconds,
    stepSubdivision: getStepSubdivision(totalSteps),
    baseName: buildBaseName(
      bpm,
      totalSteps,
      inSongMode,
      chain,
      currentPattern,
      state.patterns[currentPattern]?.name ?? PATTERN_LABELS[currentPattern],
      loops,
    ),
  };
}

function buildTriggerPlan(renderData: PreparedRenderData): TriggerPlan {
  return renderData.tracks.map((track) =>
    Array.from({ length: renderData.loops }, () =>
      track.steps.map((velocity, stepIndex) => {
        if (!track.audible || velocity <= 0) return false;
        const probability = track.probabilities[stepIndex] ?? 1.0;
        return probability >= 1.0 ? true : Math.random() <= probability;
      }),
    ),
  );
}

function createOfflineMasterOutput(master: MasterBus, applyMasterProcessing: boolean): Tone.Gain {
  if (!applyMasterProcessing) {
    return new Tone.Gain(1).toDestination();
  }

  const limiter = new Tone.Limiter(master.limiterOn ? master.limiterThreshold : 0).toDestination();
  const compressor = new Tone.Compressor(
    master.compressorOn
      ? {
          threshold: master.compressorThreshold,
          ratio: master.compressorRatio,
          attack: master.compressorAttack,
          release: master.compressorRelease,
        }
      : { threshold: 0, ratio: 1 },
  ).connect(limiter);
  const masterEq = new Tone.EQ3({
    low: master.eqOn ? master.eqLow : 0,
    mid: master.eqOn ? master.eqMid : 0,
    high: master.eqOn ? master.eqHigh : 0,
  }).connect(compressor);
  const widener = new Tone.StereoWidener({
    width: master.widthOn ? master.width : 0.5,
  }).connect(masterEq);
  const tape = new Tone.Distortion({
    distortion: master.tapeOn ? master.tapeAmount * 0.4 : 0,
    wet: master.tapeOn ? 1 : 0,
    oversample: "2x",
  }).connect(widener);

  return new Tone.Gain(master.volume).connect(tape);
}

async function renderOfflineAudio(
  renderData: PreparedRenderData,
  triggerPlan: TriggerPlan,
  passOptions: RenderPassOptions,
): Promise<AudioBuffer> {
  const buffer = await Tone.Offline(({ transport }) => {
    transport.bpm.value = renderData.bpm;
    transport.swing = renderData.swing;

    const masterOutput = createOfflineMasterOutput(renderData.master, passOptions.applyMasterProcessing);
    const duckGains = new Map<number, Tone.Gain>();

    renderData.tracks.forEach((trackRender, trackIndex) => {
      if (!trackRender.audible) return;

      const shouldOutput =
        passOptions.isolatedTrackIndex === null || passOptions.isolatedTrackIndex === trackIndex;
      let synth: SynthNode | null = null;

      if (shouldOutput) {
        const panner = new Tone.Panner(
          passOptions.includeTrackFader ? trackRender.sourceTrack.pan : 0,
        ).connect(masterOutput);
        const duckGain = new Tone.Gain(1).connect(panner);
        duckGains.set(trackIndex, duckGain);
        const gain = new Tone.Gain(
          passOptions.includeTrackFader ? trackRender.sourceTrack.volume : 1,
        ).connect(duckGain);

        if (passOptions.includeTrackFX && trackRender.sourceTrack.effects.panLfoOn) {
          const lfo = new Tone.LFO({
            frequency: trackRender.sourceTrack.effects.panLfoRate,
            type: trackRender.sourceTrack.effects.panLfoShape,
            min: -trackRender.sourceTrack.effects.panLfoDepth,
            max: trackRender.sourceTrack.effects.panLfoDepth,
          });
          lfo.connect(panner.pan);
          lfo.start(0);
        }

        synth = trackRender.sourceTrack.customSampleUrl
          ? new Tone.Sampler({ urls: { [trackRender.sourceTrack.sound.note]: trackRender.sourceTrack.customSampleUrl } })
          : createOfflineSynth(trackRender.sourceTrack.sound);

        if (passOptions.includeTrackFX) {
          const drive = new Tone.Distortion({
            distortion: trackRender.sourceTrack.effects.driveOn
              ? trackRender.sourceTrack.effects.driveAmount
              : 0,
            wet: trackRender.sourceTrack.effects.driveOn ? 1 : 0,
            oversample: "2x",
          });
          const filter = new Tone.Filter({
            frequency: trackRender.sourceTrack.effects.filterOn
              ? trackRender.sourceTrack.effects.filterFreq
              : 20000,
            type: trackRender.sourceTrack.effects.filterOn
              ? trackRender.sourceTrack.effects.filterType
              : "lowpass",
            Q: trackRender.sourceTrack.effects.filterOn
              ? trackRender.sourceTrack.effects.filterQ
              : 1,
          });
          drive.connect(filter);

          const dryGain = new Tone.Gain(1).connect(gain);
          filter.connect(dryGain);

          if (trackRender.sourceTrack.effects.delayOn) {
            const delay = new Tone.FeedbackDelay({
              delayTime: trackRender.sourceTrack.effects.delayTime,
              feedback: trackRender.sourceTrack.effects.delayFeedback,
              wet: 1,
            });
            const delayGain = new Tone.Gain(trackRender.sourceTrack.effects.delayWet).connect(gain);
            filter.connect(delay);
            delay.connect(delayGain);
          }

          if (trackRender.sourceTrack.effects.reverbOn) {
            const reverb = new Tone.Reverb({
              decay: trackRender.sourceTrack.effects.reverbDecay,
              wet: 1,
            });
            // Kick off IR generation immediately so the convolver has a tail
            // by the time the offline render starts hitting it.
            void reverb.generate();
            const reverbGain = new Tone.Gain(trackRender.sourceTrack.effects.reverbWet).connect(gain);
            filter.connect(reverb);
            reverb.connect(reverbGain);
          }

          synth.connect(drive);
        } else {
          synth.connect(gain);
        }
      }

      const absoluteStepIndices = Array.from(
        { length: renderData.sequenceLength * renderData.loops },
        (_, index) => index,
      );
      const noteDuration = renderData.stepDurationSeconds * (trackRender.sourceTrack.noteLength ?? 1.0);

      const sequence = new Tone.Sequence(
        (time, absoluteStepIndex) => {
          const sequenceStep = absoluteStepIndex % renderData.sequenceLength;
          const loopIndex = Math.floor(absoluteStepIndex / renderData.sequenceLength);
          if (!triggerPlan[trackIndex]?.[loopIndex]?.[sequenceStep]) return;

          const noteOverride = trackRender.notes[sequenceStep] || undefined;
          const nudgeOffset = (trackRender.nudge[sequenceStep] ?? 0) * renderData.stepDurationSeconds;
          const triggerTime = time + nudgeOffset;

          if (synth) {
            triggerOfflineSynth(
              synth,
              trackRender.sourceTrack,
              triggerTime,
              trackRender.steps[sequenceStep],
              noteDuration,
              noteOverride,
            );
          }

          renderData.tracks.forEach((targetTrack, targetIndex) => {
            if (!passOptions.includeTrackFX) return;
            if (!targetTrack.audible) return;
            if (passOptions.isolatedTrackIndex !== null && targetIndex !== passOptions.isolatedTrackIndex) return;
            if (!targetTrack.sourceTrack.effects.sidechainOn) return;
            if (targetTrack.sourceTrack.effects.sidechainSource !== trackIndex) return;
            const duckGain = duckGains.get(targetIndex);
            if (!duckGain) return;

            const depth = Math.max(0, Math.min(1, targetTrack.sourceTrack.effects.sidechainDepth));
            const release = Math.max(0.01, targetTrack.sourceTrack.effects.sidechainRelease);
            duckGain.gain.cancelScheduledValues(triggerTime);
            duckGain.gain.setValueAtTime(1 - depth, triggerTime);
            duckGain.gain.linearRampToValueAtTime(1, triggerTime + release);
          });
        },
        absoluteStepIndices,
        renderData.stepSubdivision,
      );

      sequence.start(0);
    });

    transport.start();
  }, renderData.totalDuration);

  return buffer.get() as AudioBuffer;
}

function buildArrangementMarkers(renderData: PreparedRenderData): ExportMarker[] {
  const markers: ExportMarker[] = [];
  const patternDurationSeconds = renderData.totalSteps * renderData.stepDurationSeconds;
  const patternsPerLoop = renderData.inSongMode ? renderData.chain.length : 1;
  const loopDurationSeconds = patternsPerLoop * patternDurationSeconds;

  for (let loopIndex = 0; loopIndex < renderData.loops; loopIndex++) {
    const loopOffsetSeconds = loopIndex * loopDurationSeconds;
    const loopOffsetBars = loopIndex * patternsPerLoop;

    if (renderData.inSongMode) {
      renderData.chain.forEach((patternIndex, position) => {
        const patternLabel = PATTERN_LABELS[patternIndex] ?? `P${patternIndex + 1}`;
        const patternName = renderData.patternNames[patternIndex] ?? patternLabel;
        const sectionLabel = `Loop ${loopIndex + 1} · Section ${position + 1}`;
        const markerName =
          patternName === patternLabel
            ? `${sectionLabel} · Pattern ${patternLabel}`
            : `${sectionLabel} · ${patternLabel} ${patternName}`;

        markers.push({
          markerName,
          sectionLabel,
          patternLabel,
          patternName,
          loop: loopIndex + 1,
          startSeconds: Number((loopOffsetSeconds + position * patternDurationSeconds).toFixed(5)),
          startBar: loopOffsetBars + position + 1,
          lengthBars: 1,
        });
      });
      continue;
    }

    const patternLabel = PATTERN_LABELS[renderData.currentPattern] ?? `P${renderData.currentPattern + 1}`;
    const sectionLabel = `Loop ${loopIndex + 1}`;
    const markerName =
      renderData.currentPatternName === patternLabel
        ? `${sectionLabel} · Pattern ${patternLabel}`
        : `${sectionLabel} · ${patternLabel} ${renderData.currentPatternName}`;

    markers.push({
      markerName,
      sectionLabel,
      patternLabel,
      patternName: renderData.currentPatternName,
      loop: loopIndex + 1,
      startSeconds: Number(loopOffsetSeconds.toFixed(5)),
      startBar: loopOffsetBars + 1,
      lengthBars: 1,
    });
  }

  return markers;
}

function csvValue(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildMarkerCsv(markers: ExportMarker[]): string {
  const header = [
    "marker_name",
    "section_label",
    "pattern_slot",
    "pattern_name",
    "loop",
    "start_seconds",
    "start_bar",
    "length_bars",
  ];

  return [
    header.join(","),
    ...markers.map((marker) =>
      [
        marker.markerName,
        marker.sectionLabel,
        marker.patternLabel,
        marker.patternName,
        marker.loop,
        marker.startSeconds,
        marker.startBar,
        marker.lengthBars,
      ]
        .map(csvValue)
        .join(","),
    ),
  ].join("\n");
}

function buildStemReadme(
  renderData: PreparedRenderData,
  renderSettings: StemRenderSettings,
  includeMasterPrint: boolean,
  stemCount: number,
): string {
  const currentPatternLabel = PATTERN_LABELS[renderData.currentPattern] ?? `P${renderData.currentPattern + 1}`;

  return [
    "StumpTheSchwab stem package",
    "",
    `Base name: ${renderData.baseName}`,
    `Tempo: ${renderData.bpm} BPM`,
    `Grid: ${renderData.totalSteps} steps`,
    `Loops exported: ${renderData.loops}`,
    `Pattern context: ${renderData.inSongMode ? `song chain (${renderData.chain.length} patterns)` : `${currentPatternLabel} ${renderData.currentPatternName}`}`,
    "",
    `Stem render mode: ${renderSettings.label}`,
    renderSettings.description,
    `Master print included: ${includeMasterPrint ? "yes" : "no"}`,
    `Stem count: ${stemCount}`,
    "",
    "Package layout:",
    "- mixes/: premaster reference and optional master print",
    "- stems/: track stems with stable numeric order for fast DAW import",
    "- markers/: arrangement markers in CSV and JSON",
    "- session.json: machine-readable export manifest",
    "",
    "Naming convention:",
    "- stem files are ordered by track index and canonical track role",
    "- custom sample names are appended when present",
    "- import stems in numeric order to preserve channel layout",
  ].join("\n");
}

function buildStemManifest(
  renderData: PreparedRenderData,
  renderSettings: StemRenderSettings,
  stems: Array<{ fileName: string; track: Track }>,
  mixes: ExportMixArtifact[],
  markers: ExportMarker[],
): string {
  return JSON.stringify(
    {
      format: "wav-stems",
      renderMode: renderSettings.value,
      renderLabel: renderSettings.label,
      exportedAt: new Date().toISOString(),
      baseName: renderData.baseName,
      bpm: renderData.bpm,
      swing: renderData.swing,
      totalSteps: renderData.totalSteps,
      loops: renderData.loops,
      songMode: renderData.inSongMode,
      chain: renderData.inSongMode ? renderData.chain : [],
      currentPattern: renderData.currentPattern,
      currentPatternName: renderData.currentPatternName,
      mixes,
      markers,
      stems: stems.map(({ fileName, track }) => ({
        id: track.id,
        fileName,
        name: track.customSampleName ?? track.sound.name,
        sound: track.sound.name,
        volume: track.volume,
        pan: track.pan,
      })),
    },
    null,
    2,
  );
}

export function useExport() {
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState<"mix" | "stems" | null>(null);

  const exportWAV = useCallback(async (loops: number = 2) => {
    setExporting(true);
    setExportMode("mix");

    try {
      const renderData = prepareRenderData(useEngineStore.getState(), loops);
      const triggerPlan = buildTriggerPlan(renderData);
      const buffer = await renderOfflineAudio(renderData, triggerPlan, {
        isolatedTrackIndex: null,
        includeTrackFX: true,
        includeTrackFader: true,
        applyMasterProcessing: true,
      });
      downloadBlob(encodeWAV(buffer), `${renderData.baseName}.wav`);
    } finally {
      setExporting(false);
      setExportMode(null);
    }
  }, []);

  const exportStems = useCallback(async ({
    loops,
    renderMode,
    includeMasterPrint,
  }: StemExportOptions) => {
    setExporting(true);
    setExportMode("stems");

    try {
      const renderData = prepareRenderData(useEngineStore.getState(), loops);
      const triggerPlan = buildTriggerPlan(renderData);
      const renderSettings = getStemRenderSettings(renderMode);
      const zip = new JSZip();
      const mixes: ExportMixArtifact[] = [];
      const markers = buildArrangementMarkers(renderData);

      const premasterMixBuffer = await renderOfflineAudio(renderData, triggerPlan, {
        isolatedTrackIndex: null,
        includeTrackFX: true,
        includeTrackFader: true,
        applyMasterProcessing: false,
      });
      const premasterMixName = "mixes/00-premaster-reference.wav";
      zip.file(premasterMixName, encodeWAV(premasterMixBuffer));
      mixes.push({ fileName: premasterMixName, kind: "premaster-reference" });

      if (includeMasterPrint) {
        const masterPrintBuffer = await renderOfflineAudio(renderData, triggerPlan, {
          isolatedTrackIndex: null,
          includeTrackFX: true,
          includeTrackFader: true,
          applyMasterProcessing: true,
        });
        const masterPrintName = "mixes/01-master-print.wav";
        zip.file(masterPrintName, encodeWAV(masterPrintBuffer));
        mixes.push({ fileName: masterPrintName, kind: "master-print" });
      }

      zip.file("markers/arrangement-markers.csv", buildMarkerCsv(markers));
      zip.file("markers/arrangement-markers.json", JSON.stringify(markers, null, 2));

      const stemEntries: Array<{ fileName: string; track: Track }> = [];
      for (const [trackIndex, trackRender] of renderData.tracks.entries()) {
        if (!trackRender.audible) continue;

        const stemBuffer = await renderOfflineAudio(renderData, triggerPlan, {
          isolatedTrackIndex: trackIndex,
          includeTrackFX: renderSettings.includeTrackFX,
          includeTrackFader: renderSettings.includeTrackFader,
          applyMasterProcessing: false,
        });
        const canonicalName = sanitizeFileSegment(trackRender.sourceTrack.sound.name);
        const displayName = trackRender.sourceTrack.customSampleName ?? trackRender.sourceTrack.sound.name;
        const sourceName = sanitizeFileSegment(displayName);
        const sourceSuffix = sourceName !== canonicalName ? `__${sourceName}` : "";
        const fileName = `stems/${renderSettings.fileToken}/${String(trackIndex + 1).padStart(2, "0")}-${canonicalName}${sourceSuffix}.wav`;
        zip.file(fileName, encodeWAV(stemBuffer));
        stemEntries.push({ fileName, track: trackRender.sourceTrack });
      }

      zip.file(
        "README.txt",
        buildStemReadme(renderData, renderSettings, includeMasterPrint, stemEntries.length),
      );
      zip.file("session.json", buildStemManifest(renderData, renderSettings, stemEntries, mixes, markers));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${renderData.baseName}-${renderSettings.fileToken}-stems.zip`);
    } finally {
      setExporting(false);
      setExportMode(null);
    }
  }, []);

  return { exportWAV, exportStems, exporting, exportMode };
}
