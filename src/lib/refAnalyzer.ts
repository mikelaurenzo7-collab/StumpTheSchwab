// Pure-JS FFT + spectrum averaging for reference track matching.
// No external dependencies — runs in the browser main thread.

/** In-place Cooley-Tukey radix-2 FFT. n must be a power of 2. */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let uRe = 1, uIm = 0;
      for (let k = 0; k < len >> 1; k++) {
        const m = i + k + (len >> 1);
        const tRe = uRe * re[m] - uIm * im[m];
        const tIm = uIm * re[m] + uRe * im[m];
        re[m] = re[i + k] - tRe;
        im[m] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const next = uRe * wRe - uIm * wIm;
        uIm = uRe * wIm + uIm * wRe;
        uRe = next;
      }
    }
  }
}

const FFT_SIZE = 1024; // 512 output bins ≈ 43 Hz/bin at 44100 Hz

/**
 * Decode an audio file and return its average power spectrum as a
 * Float32Array of FFT_SIZE/2 dBFS values — identical format to Tone.js FFT
 * (size=512) so it overlays directly on the SonicXRay canvas.
 */
export async function analyzeReference(file: File): Promise<Float32Array> {
  const ac = new AudioContext({ sampleRate: 44100 });
  let audioBuffer: AudioBuffer;
  try {
    const ab = await file.arrayBuffer();
    audioBuffer = await ac.decodeAudioData(ab);
  } finally {
    await ac.close();
  }

  // Downmix to mono
  const mono = new Float32Array(audioBuffer.length);
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i] += ch[i] / audioBuffer.numberOfChannels;
  }

  // Average magnitude spectrum, sampling every ~0.5 s
  const hop = Math.round(audioBuffer.sampleRate * 0.5);
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const acc = new Float32Array(FFT_SIZE / 2);
  let frames = 0;

  for (let start = 0; start + FFT_SIZE <= mono.length; start += hop) {
    for (let i = 0; i < FFT_SIZE; i++) {
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
      re[i] = mono[start + i] * w;
      im[i] = 0;
    }
    fftInPlace(re, im);
    for (let k = 0; k < FFT_SIZE / 2; k++) {
      acc[k] += Math.sqrt(re[k] * re[k] + im[k] * im[k]) / (FFT_SIZE / 2);
    }
    frames++;
  }

  if (frames === 0) throw new Error("Audio file too short to analyze.");

  const out = new Float32Array(FFT_SIZE / 2);
  for (let k = 0; k < FFT_SIZE / 2; k++) {
    out[k] = 20 * Math.log10(Math.max(acc[k] / frames, 1e-8));
  }
  return out;
}
