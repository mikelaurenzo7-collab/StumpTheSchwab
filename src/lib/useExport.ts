"use client";

import { useCallback, useState } from "react";
import * as Tone from "tone";
import { useEngineStore, type Track } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";

type SynthNode =
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.NoiseSynth
  | Tone.Synth
  | Tone.AMSynth
  | Tone.FMSynth;

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
    case "synth":
    default:
      return new Tone.Synth(opts as ConstructorParameters<typeof Tone.Synth>[0]);
  }
}

function encodeWAV(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export function useExport() {
  const [exporting, setExporting] = useState(false);

  const exportWAV = useCallback(async () => {
    setExporting(true);

    try {
      const state = useEngineStore.getState();
      const { bpm, swing, totalSteps, tracks, master, arrangementMode, arrangement, patterns, currentPattern } = state;

      const beatsPerStep = 4 / totalSteps;
      const secondsPerBeat = 60 / bpm;
      const loopDuration = totalSteps * beatsPerStep * secondsPerBeat;

      const isArrangement = arrangementMode && arrangement.length > 0;
      const loops = isArrangement ? arrangement.length : 2;
      const totalDuration = loopDuration * loops;

      // Snapshot current live steps into patterns for arrangement accuracy
      const livePatterns = patterns.map((p, i) =>
        i === currentPattern ? { ...p, steps: tracks.map((t) => [...t.steps]) } : p
      );

      const buffer = await Tone.Offline(({ transport }) => {
        transport.bpm.value = bpm;
        transport.swing = swing;

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

        const hasSolo = tracks.some((t: Track) => t.solo);
        const noteDuration = `${totalSteps}n` as Tone.Unit.Time;

        tracks.forEach((track: Track, trackIndex: number) => {
          const audible = hasSolo ? track.solo && !track.muted : !track.muted;
          if (!audible) return;

          const panner = new Tone.Panner(track.pan).connect(masterGain);
          const gain = new Tone.Gain(track.volume).connect(panner);

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

          const synth = createOfflineSynth(track.sound);
          synth.connect(filter);

          if (isArrangement) {
            // Build flat step array from all arrangement patterns
            const allSteps: number[] = arrangement.flatMap(
              (slot) => livePatterns[slot.patternId].steps[trackIndex]
            );
            const stepIndices = Array.from({ length: allSteps.length }, (_, i) => i);

            const seq = new Tone.Sequence(
              (time, stepIndex) => {
                const velocity = allSteps[stepIndex];
                if (!velocity) return;
                const noteOverride = track.notes[stepIndex % totalSteps] || undefined;
                if (synth instanceof Tone.NoiseSynth) {
                  synth.triggerAttackRelease(noteDuration as string, time, velocity);
                } else {
                  const note = noteOverride || track.sound.note;
                  (synth as Tone.Synth).triggerAttackRelease(note, noteDuration as string, time, velocity);
                }
              },
              stepIndices,
              "16n"
            );
            seq.loop = false;
            seq.start(0);
          } else {
            const stepIndices = Array.from({ length: totalSteps }, (_, i) => i);

            const seq = new Tone.Sequence(
              (time, stepIndex) => {
                const velocity = track.steps[stepIndex];
                if (!velocity) return;
                const noteOverride = track.notes[stepIndex] || undefined;
                if (synth instanceof Tone.NoiseSynth) {
                  synth.triggerAttackRelease(noteDuration as string, time, velocity);
                } else {
                  const note = noteOverride || track.sound.note;
                  (synth as Tone.Synth).triggerAttackRelease(note, noteDuration as string, time, velocity);
                }
              },
              stepIndices,
              "16n"
            );
            seq.start(0);
            seq.loop = true;
          }
        });

        transport.start();
      }, totalDuration);

      const wav = encodeWAV(buffer.get() as AudioBuffer);
      const url = URL.createObjectURL(wav);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stumptheschwab-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportWAV, exporting };
}
