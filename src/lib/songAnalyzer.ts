"use client";

// Cover Song analyzer — extends refAnalyzer with structural and harmonic
// content extraction so Claude can produce a full remix-ready arrangement.
// All processing client-side; only the small descriptor leaves the browser.

import { encodeWAV, sliceAudioBuffer } from "./wavEncoder";

export type ScaleMode = "major" | "minor";

export interface DetectedKey {
  tonic: string;          // "C", "C#", ... "B"
  mode: ScaleMode;
  confidence: number;     // 0..1 (correlation strength)
}

export interface SongSection {
  start: number;          // seconds
  end: number;            // seconds
  energy: number;         // average RMS in section
}

export interface BarSlice {
  index: number;
  startSec: number;
  rms: number;
  blobUrl: string;
}

export interface SongDescriptor {
  durationSeconds: number;
  estimatedBpm: number;
  estimatedKey: DetectedKey;
  peakLinear: number;
  overallRms: number;
  sections: SongSection[];
  zones: {
    sub: number; bass: number; loMid: number;
    mid: number; presence: number; air: number;
  };
  envelope: { q1: number; q2: number; q3: number; q4: number };
  // Slice metadata only — blob URLs returned separately by analyzeSong()
}

export interface SongAnalysis {
  descriptor: SongDescriptor;
  barSlices: BarSlice[];
  sourceBuffer: AudioBuffer; // kept so we can re-slice if Claude picks bars
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function mixToMono(buffer: AudioBuffer): Float32Array {
  const len = buffer.length;
  const mono = new Float32Array(len);
  const nch = buffer.numberOfChannels;
  for (let c = 0; c < nch; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += ch[i] / nch;
  }
  return mono;
}

function rms(data: Float32Array): number {
  let s = 0;
  for (let i = 0; i < data.length; i++) s += data[i] * data[i];
  return Math.sqrt(s / (data.length || 1));
}

function peak(data: Float32Array): number {
  let p = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > p) p = a;
  }
  return p;
}

// ── BPM (reusing the corrected autocorrelation from refAnalyzer's playbook) ──

function estimateBpm(mono: Float32Array, sr: number): number {
  const fps = 100;
  const frameSize = Math.round(sr / fps);
  const nFrames = Math.floor(mono.length / frameSize);
  if (nFrames < 60) return 120;

  const energy = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let s = 0;
    const start = i * frameSize;
    for (let j = start; j < start + frameSize; j++) s += mono[j] * mono[j];
    energy[i] = s / frameSize;
  }
  const onset = new Float32Array(nFrames);
  for (let i = 1; i < nFrames; i++) {
    const d = energy[i] - energy[i - 1];
    onset[i] = d > 0 ? d : 0;
  }

  const minLag = Math.round(fps * 60 / 240);
  const maxLag = Math.round(fps * 60 / 40);
  const scoreAt: number[] = new Array(maxLag + 1).fill(0);
  let bestLag = -1;
  let bestScore = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    const count = nFrames - lag;
    for (let i = 0; i < count; i++) score += onset[i] * onset[i + lag];
    score /= count;
    scoreAt[lag] = score;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  if (bestLag <= 0) return 120;

  const inComfort = (bpm: number) => bpm >= 80 && bpm <= 160;
  const bpmAt = (lag: number) => Math.round(fps * 60 / lag);
  if (!inComfort(bpmAt(bestLag))) {
    const candidates: Array<{ lag: number; score: number }> = [];
    if (bestLag * 2 <= maxLag) candidates.push({ lag: bestLag * 2, score: scoreAt[bestLag * 2] });
    const half = Math.round(bestLag / 2);
    if (half >= minLag) candidates.push({ lag: half, score: scoreAt[half] });
    const swap = candidates
      .filter((c) => inComfort(bpmAt(c.lag)) && c.score >= 0.7 * bestScore)
      .sort((a, b) => b.score - a.score)[0];
    if (swap) bestLag = swap.lag;
  }
  return Math.round(fps * 60 / bestLag);
}

// ── Spectrogram (FFT) — small implementation for chroma + section detection ──

// In-place radix-2 Cooley-Tukey FFT. Real input → complex output.
// Used at 2048-pt size; ~5ms per call on modern hardware.
function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2;
    const ang = -2 * Math.PI / size;
    const wpr = Math.cos(ang), wpi = Math.sin(ang);
    for (let start = 0; start < n; start += size) {
      let wr = 1, wi = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const tr = wr * real[b] - wi * imag[b];
        const ti = wr * imag[b] + wi * real[b];
        real[b] = real[a] - tr;
        imag[b] = imag[a] - ti;
        real[a] += tr;
        imag[a] += ti;
        const nwr = wr * wpr - wi * wpi;
        wi = wr * wpi + wi * wpr;
        wr = nwr;
      }
    }
  }
}

// Compute magnitude-squared spectrum for a windowed frame.
function magnitudeSpectrum(frame: Float32Array): Float32Array {
  const n = frame.length;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  // Hann window
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
    re[i] = frame[i] * w;
  }
  fft(re, im);
  const half = n / 2;
  const mag = new Float32Array(half);
  for (let i = 0; i < half; i++) mag[i] = re[i] * re[i] + im[i] * im[i];
  return mag;
}

// ── Key detection ──────────────────────────────────────────────────────────────

function detectKey(mono: Float32Array, sr: number): DetectedKey {
  const fftSize = 2048;
  const hopSize = fftSize;
  const nFrames = Math.floor(mono.length / hopSize);
  if (nFrames < 4) return { tonic: "C", mode: "major", confidence: 0 };

  // Accumulate chroma over the whole analysis window
  const chroma = new Float32Array(12);
  const binFreq = sr / fftSize;

  for (let f = 0; f < nFrames; f++) {
    const frame = mono.subarray(f * hopSize, f * hopSize + fftSize);
    if (frame.length < fftSize) break;
    // Copy because magnitudeSpectrum windows in place
    const buf = new Float32Array(fftSize);
    buf.set(frame);
    const mag = magnitudeSpectrum(buf);

    // Map each bin to its pitch class (skip bins below 80Hz to avoid sub rumble)
    const startBin = Math.max(1, Math.floor(80 / binFreq));
    const endBin = Math.min(mag.length, Math.floor(2000 / binFreq));
    for (let i = startBin; i < endBin; i++) {
      const freq = i * binFreq;
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pc] += mag[i];
    }
  }

  // Normalize
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += chroma[i];
  if (sum > 0) for (let i = 0; i < 12; i++) chroma[i] /= sum;

  // Correlate against all 24 key profiles
  let best = { tonic: "C", mode: "major" as ScaleMode, confidence: 0 };
  for (let rot = 0; rot < 12; rot++) {
    const majCorr = correlate(chroma, MAJOR_PROFILE, rot);
    const minCorr = correlate(chroma, MINOR_PROFILE, rot);
    if (majCorr > best.confidence) best = { tonic: NOTE_NAMES[rot], mode: "major", confidence: majCorr };
    if (minCorr > best.confidence) best = { tonic: NOTE_NAMES[rot], mode: "minor", confidence: minCorr };
  }
  return best;
}

function correlate(chroma: Float32Array, profile: number[], rot: number): number {
  // Pearson correlation between chroma (rotated by `rot`) and profile.
  let meanA = 0, meanB = 0;
  for (let i = 0; i < 12; i++) { meanA += chroma[(i + rot) % 12]; meanB += profile[i]; }
  meanA /= 12; meanB /= 12;
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < 12; i++) {
    const a = chroma[(i + rot) % 12] - meanA;
    const b = profile[i] - meanB;
    num += a * b; dA += a * a; dB += b * b;
  }
  const denom = Math.sqrt(dA * dB);
  return denom > 0 ? num / denom : 0;
}

// ── Section detection via spectral flux novelty curve ──────────────────────────

function detectSections(mono: Float32Array, sr: number, durationSec: number): SongSection[] {
  const fftSize = 1024;
  const hopSize = 512;
  const nFrames = Math.floor((mono.length - fftSize) / hopSize);
  if (nFrames < 8) {
    return [{ start: 0, end: durationSec, energy: rms(mono) }];
  }

  // Spectral flux per frame
  let prevMag: Float32Array | null = null;
  const flux = new Float32Array(nFrames);
  const buf = new Float32Array(fftSize);
  for (let f = 0; f < nFrames; f++) {
    buf.set(mono.subarray(f * hopSize, f * hopSize + fftSize));
    const mag = magnitudeSpectrum(buf);
    if (prevMag) {
      let s = 0;
      for (let i = 0; i < mag.length; i++) {
        const d = Math.sqrt(mag[i]) - Math.sqrt(prevMag[i]);
        if (d > 0) s += d;
      }
      flux[f] = s;
    }
    prevMag = mag;
  }

  // Smooth flux with a moving average (~1.5 second window)
  const winFrames = Math.round(1.5 * sr / hopSize);
  const smooth = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let sum = 0; let count = 0;
    for (let j = Math.max(0, i - winFrames); j < Math.min(nFrames, i + winFrames); j++) {
      sum += flux[j]; count++;
    }
    smooth[i] = count > 0 ? sum / count : 0;
  }

  // Subtract local mean to find peaks above background
  let mean = 0;
  for (let i = 0; i < nFrames; i++) mean += smooth[i];
  mean /= nFrames;

  // Find peaks (local maxima above 1.4× mean, separated by ≥4 seconds)
  const minSepFrames = Math.round(4 * sr / hopSize);
  const boundaryFrames: number[] = [0];
  for (let i = 1; i < nFrames - 1; i++) {
    if (
      smooth[i] > smooth[i - 1] &&
      smooth[i] > smooth[i + 1] &&
      smooth[i] > 1.4 * mean &&
      i - boundaryFrames[boundaryFrames.length - 1] >= minSepFrames
    ) {
      boundaryFrames.push(i);
    }
  }
  boundaryFrames.push(nFrames);

  // Cap at 8 sections; keep the strongest if more
  const sections: SongSection[] = [];
  for (let i = 0; i < boundaryFrames.length - 1; i++) {
    const startFrame = boundaryFrames[i];
    const endFrame = boundaryFrames[i + 1];
    const startSec = startFrame * hopSize / sr;
    const endSec = endFrame * hopSize / sr;
    if (endSec - startSec < 2) continue;
    const slice = mono.subarray(startFrame * hopSize, endFrame * hopSize);
    sections.push({ start: startSec, end: endSec, energy: rms(slice) });
  }
  // If too many, keep the highest-energy 8 in time order
  if (sections.length > 8) {
    const sorted = [...sections].sort((a, b) => b.energy - a.energy).slice(0, 8);
    sorted.sort((a, b) => a.start - b.start);
    return sorted;
  }
  return sections.length > 0 ? sections : [{ start: 0, end: durationSec, energy: rms(mono) }];
}

// ── Zone energies (reusing biquad-filtered offline render approach) ────────────

async function zoneRms(mono: Float32Array, sr: number, lo: number, hi: number): Promise<number> {
  const offCtx = new OfflineAudioContext(1, mono.length, sr);
  const buf = offCtx.createBuffer(1, mono.length, sr);
  const plain = new Float32Array(new ArrayBuffer(mono.length * 4));
  plain.set(mono);
  buf.copyToChannel(plain, 0);
  const src = offCtx.createBufferSource();
  src.buffer = buf;
  const hp = offCtx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = lo; hp.Q.value = 0.5;
  const lp = offCtx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = hi; lp.Q.value = 0.5;
  src.connect(hp); hp.connect(lp); lp.connect(offCtx.destination);
  src.start(0);
  return rms((await offCtx.startRendering()).getChannelData(0));
}

// ── Bar slicing — produce blob URLs for each bar at the detected BPM ──────────

function sliceBars(buffer: AudioBuffer, bpm: number, maxBars = 16): BarSlice[] {
  const sr = buffer.sampleRate;
  const secondsPerBar = (60 / bpm) * 4;
  const samplesPerBar = Math.round(secondsPerBar * sr);
  const nBars = Math.min(maxBars, Math.floor(buffer.length / samplesPerBar));
  const slices: BarSlice[] = [];
  // Skip the first bar (often silence/intro fade-in) and stop before the last bar
  for (let i = 1; i < nBars - 1; i++) {
    const start = i * samplesPerBar;
    const end = start + samplesPerBar;
    const sliced = sliceAudioBuffer(buffer, start, end);
    const wav = encodeWAV(sliced);
    const blobUrl = URL.createObjectURL(wav);
    // RMS of the slice for "most distinctive" picking
    const ch0 = sliced.getChannelData(0);
    const sliceRms = rms(ch0);
    slices.push({
      index: i,
      startSec: start / sr,
      rms: sliceRms,
      blobUrl,
    });
  }
  return slices;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function analyzeSong(file: File): Promise<SongAnalysis> {
  const arrayBuffer = await file.arrayBuffer();
  const tmpCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuffer);
  } finally {
    void tmpCtx.close();
  }

  // Analyze up to 90 seconds centred in the track
  const maxSec = 90;
  const maxSamples = Math.min(decoded.length, decoded.sampleRate * maxSec);
  const startSample = Math.max(0, Math.floor((decoded.length - maxSamples) / 2));
  const fullMono = mixToMono(decoded);
  const mono = fullMono.slice(startSample, startSample + maxSamples);

  const peakLinear = peak(mono);
  const overallRms = rms(mono);

  // Envelope quarters
  const q = Math.floor(mono.length / 4);
  const envelope = {
    q1: rms(mono.slice(0, q)),
    q2: rms(mono.slice(q, 2 * q)),
    q3: rms(mono.slice(2 * q, 3 * q)),
    q4: rms(mono.slice(3 * q)),
  };

  // BPM, key, sections (in parallel-ish; sections is heavy CPU but fast enough)
  const bpm = estimateBpm(mono, decoded.sampleRate);
  const key = detectKey(mono, decoded.sampleRate);
  const sections = detectSections(mono, decoded.sampleRate, decoded.duration);

  // Zones (sequential to limit memory)
  const zoneDefs: Array<[keyof SongDescriptor["zones"], number, number]> = [
    ["sub", 20, 80], ["bass", 80, 250], ["loMid", 250, 800],
    ["mid", 800, 2500], ["presence", 2500, 8000], ["air", 8000, 20000],
  ];
  const zones = {} as SongDescriptor["zones"];
  for (const [k, lo, hi] of zoneDefs) {
    zones[k] = await zoneRms(mono, decoded.sampleRate, lo, hi);
  }

  // Bar slices (bounded — 16 bars max)
  const barSlices = sliceBars(decoded, bpm, 16);

  return {
    descriptor: {
      durationSeconds: decoded.duration,
      estimatedBpm: bpm,
      estimatedKey: key,
      peakLinear,
      overallRms,
      sections,
      zones,
      envelope,
    },
    barSlices,
    sourceBuffer: decoded,
  };
}

// Free blob URLs created during analysis (call when modal closes)
export function disposeAnalysis(analysis: SongAnalysis): void {
  for (const s of analysis.barSlices) {
    URL.revokeObjectURL(s.blobUrl);
  }
}
