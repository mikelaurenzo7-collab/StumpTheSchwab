import * as Tone from "tone";
import { useEngineStore, type Track } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";

// ── Types ─────────────────────────────────────────────────────
type SynthNode =
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.NoiseSynth
  | Tone.Synth
  | Tone.AMSynth
  | Tone.FMSynth;

export type ExportMode = "pattern" | "song";

// ── Synth creation (duplicated from useAudioEngine for offline context) ──
function createSynth(sound: TrackSound): SynthNode {
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
    case "synth":
    default:
      return new Tone.Synth(opts as ConstructorParameters<typeof Tone.Synth>[0]);
  }
}

function triggerSynth(synth: SynthNode, sound: TrackSound, time: number, velocity: number, duration: string, noteOverride?: string) {
  if (synth instanceof Tone.NoiseSynth) {
    synth.triggerAttackRelease(duration, time, velocity);
  } else {
    const note = noteOverride || sound.note;
    (synth as Tone.Synth).triggerAttackRelease(note, duration, time, velocity);
  }
}

// ── WAV encoding ──────────────────────────────────────────────
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channels and write samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = headerSize;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Build schedule of notes for a set of patterns ─────────────
interface ScheduledNote {
  trackIndex: number;
  time: number; // in seconds
  velocity: number;
  duration: string;
  noteOverride?: string;
}

function buildSchedule(
  patternSequence: number[][][],
  tracks: Track[],
  totalSteps: number,
  bpm: number,
): { notes: ScheduledNote[]; totalDuration: number } {
  const secondsPerStep = 60 / bpm / 4; // 16th note duration
  const patternDuration = totalSteps * secondsPerStep;
  const noteDuration = `${totalSteps}n`;
  const notes: ScheduledNote[] = [];

  patternSequence.forEach((patternSteps, patternIndex) => {
    const patternOffset = patternIndex * patternDuration;

    tracks.forEach((track, trackIndex) => {
      const steps = patternSteps[trackIndex] ?? track.steps;
      const hasSolo = tracks.some((t) => t.solo);
      const audible = hasSolo ? track.solo && !track.muted : !track.muted;
      if (!audible) return;

      steps.forEach((velocity: number, stepIndex: number) => {
        if (!velocity) return;
        const time = patternOffset + stepIndex * secondsPerStep;
        const noteOverride = track.notes?.[stepIndex] || undefined;
        notes.push({ trackIndex, time, velocity, duration: noteDuration, noteOverride });
      });
    });
  });

  const totalDuration = patternSequence.length * patternDuration;
  return { notes, totalDuration };
}

// ── Main export function ──────────────────────────────────────
export async function exportAudio(mode: ExportMode): Promise<void> {
  const state = useEngineStore.getState();
  const { tracks, bpm, totalSteps, patterns, songArrangement, currentPattern, master } = state;

  // Build the pattern sequence to render
  let patternStepSequence: number[][][];

  if (mode === "song") {
    // Render full arrangement
    // First, snapshot current live steps into current pattern
    const livePatterns = patterns.map((p, i) =>
      i === currentPattern
        ? { ...p, steps: tracks.map((t) => [...t.steps]) }
        : p
    );
    patternStepSequence = songArrangement.map((patIdx) => livePatterns[patIdx].steps);
  } else {
    // Render current pattern only
    patternStepSequence = [tracks.map((t) => [...t.steps])];
  }

  // Build the note schedule
  const { notes, totalDuration } = buildSchedule(patternStepSequence, tracks, totalSteps, bpm);

  // Add a tail for reverb/delay decay
  const tailDuration = 2;
  const renderDuration = totalDuration + tailDuration;

  // Render offline
  const buffer = await Tone.Offline(({ transport }) => {
    transport.bpm.value = bpm;

    // Build master chain
    const limiter = new Tone.Limiter(master.limiterOn ? master.limiterThreshold : 0).toDestination();
    const compressor = new Tone.Compressor(
      master.compressorOn
        ? {
            threshold: master.compressorThreshold,
            ratio: master.compressorRatio,
            attack: master.compressorAttack,
            release: master.compressorRelease,
          }
        : { threshold: 0, ratio: 1 }
    ).connect(limiter);
    const masterGain = new Tone.Gain(master.volume).connect(compressor);

    // Create per-track synth + FX chains
    const synths: SynthNode[] = [];

    tracks.forEach((track) => {
      const panner = new Tone.Panner(track.pan).connect(masterGain);
      const gain = new Tone.Gain(track.volume).connect(panner);

      // Simplified FX chain for export
      const filter = new Tone.Filter({
        frequency: track.effects.filterOn ? track.effects.filterFreq : 20000,
        type: track.effects.filterOn ? track.effects.filterType : "lowpass",
        Q: track.effects.filterOn ? track.effects.filterQ : 1,
      });

      const dryGain = new Tone.Gain(1).connect(gain);
      filter.connect(dryGain);

      if (track.effects.delayOn) {
        const delay = new Tone.FeedbackDelay({
          delayTime: track.effects.delayTime,
          feedback: track.effects.delayFeedback,
          wet: 1,
        });
        const delayGain = new Tone.Gain(track.effects.delayWet).connect(gain);
        filter.connect(delay);
        delay.connect(delayGain);
      }

      if (track.effects.reverbOn) {
        const reverb = new Tone.Reverb({ decay: track.effects.reverbDecay, wet: 1 });
        const reverbGain = new Tone.Gain(track.effects.reverbWet).connect(gain);
        filter.connect(reverb);
        reverb.connect(reverbGain);
      }

      const synth = createSynth(track.sound);
      synth.connect(filter);
      synths.push(synth);
    });

    // Schedule all notes
    notes.forEach(({ trackIndex, time, velocity, duration, noteOverride }) => {
      const synth = synths[trackIndex];
      const sound = tracks[trackIndex].sound;
      if (synth) {
        transport.schedule((t) => {
          triggerSynth(synth, sound, t, velocity, duration, noteOverride);
        }, time);
      }
    });

    transport.start(0);
  }, renderDuration);

  // Convert to WAV and download
  // Tone.Offline returns a ToneAudioBuffer; extract the underlying AudioBuffer
  const audioBuffer = buffer.get() as AudioBuffer;
  const wavBuffer = audioBufferToWav(audioBuffer);
  const blob = new Blob([wavBuffer], { type: "audio/wav" });

  const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const filename = `sts-${mode}-${bpm}bpm-${timestamp}.wav`;
  downloadBlob(blob, filename);
}
