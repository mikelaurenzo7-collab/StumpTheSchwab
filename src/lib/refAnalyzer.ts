// Client-side audio analysis for the Reference Track Match feature.
// All processing runs in the browser via Web Audio API — no audio data is
// sent to any server, only the computed descriptor (~300 tokens).

export interface ReferenceDescriptor {
  durationSeconds: number;
  estimatedBpm: number | null;
  peakLinear: number;
  overallRms: number;
  // Average spectral energy per zone (linear RMS, 0-1 scale)
  zones: {
    sub: number;       // 20-80 Hz
    bass: number;      // 80-250 Hz
    loMid: number;     // 250-800 Hz
    mid: number;       // 800-2500 Hz
    presence: number;  // 2500-8000 Hz
    air: number;       // 8000-20000 Hz
  };
  // Normalized RMS per quarter of the analysis window
  envelope: { q1: number; q2: number; q3: number; q4: number };
}

// ── Internal helpers ───────────────────────────────────────────────────────────

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

// Render `mono` through a highpass → lowpass chain in an offline context and
// return the RMS of the filtered output.
async function zoneRms(
  mono: Float32Array,
  sampleRate: number,
  lo: number,
  hi: number,
): Promise<number> {
  const len = mono.length;
  const offCtx = new OfflineAudioContext(1, len, sampleRate);

  const srcBuf = offCtx.createBuffer(1, len, sampleRate);
  // Ensure a plain ArrayBuffer for copyToChannel compatibility
  const plainMono = new Float32Array(new ArrayBuffer(len * 4));
  plainMono.set(mono);
  srcBuf.copyToChannel(plainMono, 0);

  const src = offCtx.createBufferSource();
  src.buffer = srcBuf;

  const hp = offCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = lo;
  hp.Q.value = 0.5;

  const lp = offCtx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = hi;
  lp.Q.value = 0.5;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(offCtx.destination);
  src.start(0);

  const rendered = await offCtx.startRendering();
  return rms(rendered.getChannelData(0));
}

// Estimate BPM via onset-strength autocorrelation (good for ~40-240 BPM).
function estimateBpm(mono: Float32Array, sr: number): number | null {
  const fps = 100; // analysis frame rate
  const frameSize = Math.round(sr / fps);
  const nFrames = Math.floor(mono.length / frameSize);

  if (nFrames < 60) return null; // need at least 600ms

  // Energy envelope
  const energy = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let s = 0;
    const start = i * frameSize;
    const end = start + frameSize;
    for (let j = start; j < end; j++) s += mono[j] * mono[j];
    energy[i] = s / frameSize;
  }

  // Onset strength = half-wave rectified energy derivative
  const onset = new Float32Array(nFrames);
  for (let i = 1; i < nFrames; i++) {
    const d = energy[i] - energy[i - 1];
    onset[i] = d > 0 ? d : 0;
  }

  // Autocorrelate over lags corresponding to 40-240 BPM
  const minLag = Math.round(fps * 60 / 240); // 25 frames at 240 BPM
  const maxLag = Math.round(fps * 60 / 40);  // 150 frames at 40 BPM

  let bestLag = -1;
  let bestScore = 0;

  // Score every candidate lag and remember the table for later half/double check
  const scoreAt: number[] = new Array(maxLag + 1).fill(0);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    const count = nFrames - lag;
    for (let i = 0; i < count; i++) score += onset[i] * onset[i + lag];
    score /= count;
    scoreAt[lag] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag <= 0) return null;

  // Half / double tempo correction. Onset autocorrelation often locks onto
  // 2× the true tempo on busy hat patterns and ½× on sparse-kick lofi. If
  // the doubled or halved candidate scores well (≥0.7× the best) AND lands
  // in the 80-160 BPM "musical comfort zone" while the current pick does
  // not, swap to the alternate.
  const inComfort = (bpm: number) => bpm >= 80 && bpm <= 160;
  const bpmAt = (lag: number) => Math.round(fps * 60 / lag);
  const currentBpm = bpmAt(bestLag);

  if (!inComfort(currentBpm)) {
    const halfLag = bestLag * 2; // half tempo
    const doubleLag = Math.round(bestLag / 2); // double tempo
    const candidates: Array<{ lag: number; bpm: number; score: number }> = [];
    if (halfLag <= maxLag) candidates.push({ lag: halfLag, bpm: bpmAt(halfLag), score: scoreAt[halfLag] });
    if (doubleLag >= minLag) candidates.push({ lag: doubleLag, bpm: bpmAt(doubleLag), score: scoreAt[doubleLag] });
    const swap = candidates
      .filter((c) => inComfort(c.bpm) && c.score >= 0.7 * bestScore)
      .sort((a, b) => b.score - a.score)[0];
    if (swap) bestLag = swap.lag;
  }

  return Math.round(fps * 60 / bestLag);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function analyzeReference(file: File): Promise<ReferenceDescriptor> {
  const arrayBuffer = await file.arrayBuffer();

  // Decode audio (need a real AudioContext for decodeAudioData)
  const tmpCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuffer);
  } finally {
    void tmpCtx.close();
  }

  // Analyse at most 40s centred in the track (avoids silence at start/end)
  const maxAnalysisSec = 40;
  const maxSamples = Math.min(decoded.length, decoded.sampleRate * maxAnalysisSec);
  const startSample = Math.max(
    0,
    Math.floor((decoded.length - maxSamples) / 2),
  );

  const fullMono = mixToMono(decoded);
  const mono = fullMono.slice(startSample, startSample + maxSamples);

  // Basic stats
  const peakLinear = peak(mono);
  const overallRms  = rms(mono);

  // Envelope quarters
  const q = Math.floor(mono.length / 4);
  const envelope = {
    q1: rms(mono.slice(0, q)),
    q2: rms(mono.slice(q, 2 * q)),
    q3: rms(mono.slice(2 * q, 3 * q)),
    q4: rms(mono.slice(3 * q)),
  };

  // Zone energies (sequential to limit peak memory)
  const zoneDefs: Array<[keyof ReferenceDescriptor["zones"], number, number]> = [
    ["sub",      20,    80   ],
    ["bass",     80,    250  ],
    ["loMid",    250,   800  ],
    ["mid",      800,   2500 ],
    ["presence", 2500,  8000 ],
    ["air",      8000,  20000],
  ];

  const zoneValues: number[] = [];
  for (const [, lo, hi] of zoneDefs) {
    zoneValues.push(await zoneRms(mono, decoded.sampleRate, lo, hi));
  }

  const zones = {} as ReferenceDescriptor["zones"];
  zoneDefs.forEach(([key], i) => { zones[key] = zoneValues[i]; });

  // BPM from full mono (up to 30s) for better period coverage
  const bpmMono = fullMono.slice(0, Math.min(fullMono.length, decoded.sampleRate * 30));
  const estimatedBpm = estimateBpm(bpmMono, decoded.sampleRate);

  return {
    durationSeconds: decoded.duration,
    estimatedBpm,
    peakLinear,
    overallRms,
    zones,
    envelope,
  };
}
