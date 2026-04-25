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
  | Tone.FMSynth
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

  const exportWAV = useCallback(async (loops: number = 2) => {
    setExporting(true);

    try {
      const state = useEngineStore.getState();
      const { bpm, swing, totalSteps, tracks, master, songMode, chain, currentPattern, patterns } = state;

      // Build flattened step/probability arrays per track.
      // In song mode with a non-empty chain, concatenate each pattern in order.
      // Otherwise, use the current track state (single pattern).
      const inSongMode = songMode && chain.length > 0;
      const sequenceLength = inSongMode ? totalSteps * chain.length : totalSteps;

      const flatSteps: number[][] = tracks.map((t, i) => {
        if (!inSongMode) return [...t.steps];
        const out: number[] = [];
        for (const patternIdx of chain) {
          const src =
            patternIdx === currentPattern
              ? t.steps
              : patterns[patternIdx]?.steps[i] ?? Array(totalSteps).fill(0);
          for (let s = 0; s < totalSteps; s++) out.push(src[s] ?? 0);
        }
        return out;
      });

      const flatProbs: number[][] = tracks.map((t, i) => {
        if (!inSongMode) return [...t.probabilities];
        const out: number[] = [];
        for (const patternIdx of chain) {
          const src =
            patternIdx === currentPattern
              ? t.probabilities
              : patterns[patternIdx]?.probabilities[i] ?? Array(totalSteps).fill(1);
          for (let s = 0; s < totalSteps; s++) out.push(src[s] ?? 1);
        }
        return out;
      });

      const beatsPerStep = 4 / totalSteps;
      const secondsPerBeat = 60 / bpm;
      const loopDuration = sequenceLength * beatsPerStep * secondsPerBeat;
      // Add a small tail so reverb/delay decays aren't cut off
      const tail = 0.5;
      const totalDuration = loopDuration * loops + tail;

      const stepDurationSeconds = (60 / bpm) * (4 / totalSteps);

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
        const masterEq = new Tone.EQ3({
          low: master.eqOn ? master.eqLow : 0,
          mid: master.eqOn ? master.eqMid : 0,
          high: master.eqOn ? master.eqHigh : 0,
        }).connect(compressor);
        const masterGain = new Tone.Gain(master.volume).connect(masterEq);

        const hasSolo = tracks.some((t: Track) => t.solo);

        // Per-track duck gain nodes for sidechain — keyed by track index so
        // each track's sequence callback can schedule envelopes on its targets.
        const duckGains = new Map<number, Tone.Gain>();

        tracks.forEach((track: Track, trackIdx: number) => {
          const audible = hasSolo ? track.solo && !track.muted : !track.muted;
          if (!audible) return;

          const panner = new Tone.Panner(track.pan).connect(masterGain);
          const duckGain = new Tone.Gain(1).connect(panner);
          duckGains.set(trackIdx, duckGain);
          const gain = new Tone.Gain(track.volume).connect(duckGain);

          // Auto-pan LFO mirrors the live engine: oscillates around the
          // user's pan center so the rendered file matches what they hear.
          if (track.effects.panLfoOn) {
            const lfo = new Tone.LFO({
              frequency: track.effects.panLfoRate,
              type: track.effects.panLfoShape,
              min: -track.effects.panLfoDepth,
              max: track.effects.panLfoDepth,
            });
            lfo.connect(panner.pan);
            lfo.start(0);
          }

          const drive = new Tone.Distortion({
            distortion: track.effects.driveOn ? track.effects.driveAmount : 0,
            wet: track.effects.driveOn ? 1 : 0,
            oversample: "2x",
          });

          const filter = new Tone.Filter({
            frequency: track.effects.filterOn ? track.effects.filterFreq : 20000,
            type: track.effects.filterOn ? track.effects.filterType : "lowpass",
            Q: track.effects.filterOn ? track.effects.filterQ : 1,
          });
          drive.connect(filter);

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

          let synth: SynthNode;
          if (track.customSampleUrl) {
            synth = new Tone.Sampler({ urls: { [track.sound.note]: track.customSampleUrl } });
          } else {
            synth = createOfflineSynth(track.sound);
          }
          synth.connect(drive);

          const trackSteps = flatSteps[trackIdx];
          const trackProbs = flatProbs[trackIdx];
          const stepIndices = Array.from({ length: sequenceLength }, (_, i) => i);

          const noteDur = stepDurationSeconds * (track.noteLength ?? 1.0);

          const seq = new Tone.Sequence(
            (time, stepIndex) => {
              const velocity = trackSteps[stepIndex];
              if (!velocity) return;
              const probability = trackProbs[stepIndex] ?? 1.0;
              if (probability < 1.0 && Math.random() > probability) return;
              const noteOverride = track.notes[stepIndex % totalSteps] || undefined;
              const nudgeOffset = (track.nudge[stepIndex % totalSteps] ?? 0) * stepDurationSeconds;
              const trigTime = time + nudgeOffset;
              if (synth instanceof Tone.NoiseSynth) {
                synth.triggerAttackRelease(noteDur, trigTime, velocity);
              } else if (synth instanceof Tone.Sampler) {
                if (!synth.loaded) return;
                const note = noteOverride || track.sound.note;
                synth.triggerAttackRelease(note, noteDur, trigTime, velocity);
              } else {
                const note = noteOverride || track.sound.note;
                (synth as Tone.Synth).triggerAttackRelease(note, noteDur, trigTime, velocity);
              }

              tracks.forEach((target: Track, targetIdx: number) => {
                if (!target.effects.sidechainOn) return;
                if (target.effects.sidechainSource !== trackIdx) return;
                const dg = duckGains.get(targetIdx);
                if (!dg) return;
                const depth = Math.max(0, Math.min(1, target.effects.sidechainDepth));
                const release = Math.max(0.01, target.effects.sidechainRelease);
                dg.gain.cancelScheduledValues(trigTime);
                dg.gain.setValueAtTime(1 - depth, trigTime);
                dg.gain.linearRampToValueAtTime(1, trigTime + release);
              });
            },
            stepIndices,
            "16n"
          );

          seq.start(0);
          seq.loop = true;
        });

        transport.start();
      }, totalDuration);

      const wav = encodeWAV(buffer.get() as AudioBuffer);
      const url = URL.createObjectURL(wav);
      const a = document.createElement("a");
      a.href = url;
      const songLabel = inSongMode ? `-song-${chain.length}p` : "";
      a.download = `sts-${bpm}bpm-${totalSteps}steps${songLabel}${loops > 1 ? `-${loops}x` : ""}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, []);

  // Render each audible track in isolation and download as separate WAV files.
  // Useful for collaboration: send stems to a mixing engineer, load into a DAW,
  // or layer into another project. Each render uses the full FX chain for that
  // track (drive, EQ, filter, delay, reverb) but strips master bus processing
  // so the stems remain unmastered.
  const exportStems = useCallback(async (loops: number = 2) => {
    setExporting(true);
    try {
      const state = useEngineStore.getState();
      const { bpm, swing, totalSteps, tracks, master } = state;
      const hasSolo = tracks.some((t: Track) => t.solo);

      const beatsPerStep = 4 / totalSteps;
      const secondsPerBeat = 60 / bpm;
      const loopDuration = totalSteps * beatsPerStep * secondsPerBeat;
      const tail = 0.5;
      const totalDuration = loopDuration * loops + tail;
      const stepDurationSeconds = (60 / bpm) * (4 / totalSteps);

      for (const track of tracks) {
        const audible = hasSolo ? track.solo && !track.muted : !track.muted;
        const hasContent = track.steps.some((v: number) => v > 0);
        if (!audible || !hasContent) continue;

        const buffer = await Tone.Offline(({ transport }) => {
          transport.bpm.value = bpm;
          transport.swing = swing;

          const dest = new Tone.Gain(track.volume).toDestination();
          const drive = new Tone.Distortion({
            distortion: track.effects.driveOn ? track.effects.driveAmount : 0,
            wet: track.effects.driveOn ? 1 : 0,
            oversample: "2x",
          });
          // Per-track EQ
          const trackEq = new Tone.EQ3({
            low: track.effects.trackEqOn ? track.effects.trackEqLow : 0,
            mid: track.effects.trackEqOn ? track.effects.trackEqMid : 0,
            high: track.effects.trackEqOn ? track.effects.trackEqHigh : 0,
            lowFrequency: 250,
            highFrequency: 6000,
          });
          drive.connect(trackEq);
          const filter = new Tone.Filter({
            frequency: track.effects.filterOn ? track.effects.filterFreq : 20000,
            type: track.effects.filterOn ? track.effects.filterType : "lowpass",
            Q: track.effects.filterOn ? track.effects.filterQ : 1,
          });
          trackEq.connect(filter);
          const dryGain = new Tone.Gain(1).connect(dest);
          filter.connect(dryGain);

          if (track.effects.delayOn) {
            const delay = new Tone.FeedbackDelay({
              delayTime: track.effects.delayTime,
              feedback: track.effects.delayFeedback,
              wet: 1,
            });
            const dg = new Tone.Gain(track.effects.delayWet).connect(dest);
            filter.connect(delay);
            delay.connect(dg);
          }
          if (track.effects.reverbOn) {
            const reverb = new Tone.Reverb({ decay: track.effects.reverbDecay, wet: 1 });
            const rg = new Tone.Gain(track.effects.reverbWet).connect(dest);
            filter.connect(reverb);
            reverb.connect(rg);
          }
          if (track.effects.panLfoOn) {
            const panner = new Tone.Panner(track.pan).connect(dest);
            const lfo = new Tone.LFO({
              frequency: track.effects.panLfoRate,
              type: track.effects.panLfoShape,
              min: -track.effects.panLfoDepth,
              max: track.effects.panLfoDepth,
            });
            lfo.connect(panner.pan);
            lfo.start(0);
            // redirect dry path through panner
            dryGain.disconnect();
            dryGain.connect(panner);
          }

          let synth: SynthNode;
          if (track.customSampleUrl) {
            synth = new Tone.Sampler({ urls: { [track.sound.note]: track.customSampleUrl } });
          } else {
            synth = createOfflineSynth(track.sound);
          }
          synth.connect(drive);

          const noteDur = stepDurationSeconds * (track.noteLength ?? 1.0);
          const seq = new Tone.Sequence(
            (time, stepIndex) => {
              const velocity = track.steps[stepIndex];
              if (!velocity) return;
              const prob = track.probabilities[stepIndex] ?? 1.0;
              if (prob < 1.0 && Math.random() > prob) return;
              const note = track.notes[stepIndex] || undefined;
              const nudge = (track.nudge[stepIndex] ?? 0) * stepDurationSeconds;
              if (synth instanceof Tone.NoiseSynth) {
                synth.triggerAttackRelease(noteDur, time + nudge, velocity);
              } else if (synth instanceof Tone.Sampler) {
                if (!synth.loaded) return;
                synth.triggerAttackRelease(note ?? track.sound.note, noteDur, time + nudge, velocity);
              } else {
                (synth as Tone.Synth).triggerAttackRelease(note ?? track.sound.note, noteDur, time + nudge, velocity);
              }
            },
            Array.from({ length: totalSteps }, (_, i) => i),
            "16n"
          );
          seq.start(0);
          seq.loop = true;
          transport.start();
        }, totalDuration);

        void master; // master bus intentionally excluded from stems
        const stemName = track.customSampleName ?? track.sound.name;
        const wav = encodeWAV(buffer.get() as AudioBuffer);
        const url = URL.createObjectURL(wav);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sts-stem-${stemName.toLowerCase().replace(/\s+/g, "-")}-${bpm}bpm.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        // Small delay between downloads so browsers don't block the batch
        await new Promise((r) => setTimeout(r, 120));
      }
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportWAV, exportStems, exporting };
}
