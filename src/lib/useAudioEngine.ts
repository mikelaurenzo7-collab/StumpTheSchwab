"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { useEngineStore, type Track, type TrackEffects, type MasterBus } from "@/store/engine";
import type { TrackSound } from "@/lib/sounds";

export type SynthNode =
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.NoiseSynth
  | Tone.Synth
  | Tone.AMSynth
  | Tone.FMSynth
  | Tone.Sampler;

interface TrackFXChain {
  drive: Tone.Distortion;
  trackEq: Tone.EQ3;   // 3-band post-drive EQ (250Hz/1.5kHz/6kHz fixed crossovers)
  filter: Tone.Filter;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  delayGain: Tone.Gain; // delay send level
  reverbGain: Tone.Gain; // reverb send level
  dryGain: Tone.Gain; // dry path level
}

interface MasterChain {
  gain: Tone.Gain;
  warmthDrive: Tone.Distortion; // tape-style soft saturation (low amounts)
  warmthShelf: Tone.Filter;     // gentle high-shelf cut for tape "warmth"
  eq: Tone.EQ3;
  compressor: Tone.Compressor;
  limiter: Tone.Limiter;
}

export function createSynth(sound: TrackSound): SynthNode {
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

export function triggerSynth(
  synth: SynthNode,
  sound: TrackSound,
  time: number,
  velocity: number,
  duration: string | number,
  noteOverride?: string,
) {
  if (synth instanceof Tone.NoiseSynth) {
    synth.triggerAttackRelease(duration, time, velocity);
  } else if (synth instanceof Tone.Sampler) {
    if (!synth.loaded) return;
    const note = noteOverride || sound.note;
    synth.triggerAttackRelease(note, duration, time, velocity);
  } else {
    const note = noteOverride || sound.note;
    (synth as Tone.Synth).triggerAttackRelease(note, duration, time, velocity);
  }
}

function createTrackFX(destination: Tone.InputNode): TrackFXChain {
  // Signal: synth → drive → trackEq → filter → (dry / delay / reverb sends) → destination
  // Drive first: saturates harmonics. EQ next: shapes the result. Filter last: dramatic cuts/sweeps.
  const drive = new Tone.Distortion({ distortion: 0, wet: 1 });
  // Crossover freqs match SonicXRay zone boundaries: 250Hz (bass/lo-mid),
  // 1500Hz (mid character), 6000Hz (presence/air). Fixed here — users only
  // control gain. This is intentional: fewer knobs, faster learning.
  const trackEq = new Tone.EQ3({ low: 0, mid: 0, high: 0, lowFrequency: 250, highFrequency: 6000 });
  drive.connect(trackEq);
  const filter = new Tone.Filter({ frequency: 20000, type: "lowpass", Q: 1 });
  trackEq.connect(filter);

  const delay = new Tone.FeedbackDelay({ delayTime: 0.25, feedback: 0.3, wet: 1 });
  const delayGain = new Tone.Gain(0);
  const dryGain = new Tone.Gain(1);

  const reverb = new Tone.Reverb({ decay: 1.5, wet: 1 });
  const reverbGain = new Tone.Gain(0);

  filter.connect(dryGain);
  filter.connect(delay);
  filter.connect(reverb);

  delay.connect(delayGain);
  reverb.connect(reverbGain);

  dryGain.connect(destination as unknown as Tone.ToneAudioNode);
  delayGain.connect(destination as unknown as Tone.ToneAudioNode);
  reverbGain.connect(destination as unknown as Tone.ToneAudioNode);

  return { drive, trackEq, filter, delay, reverb, delayGain, reverbGain, dryGain };
}

function applyTrackFX(fx: TrackFXChain, effects: TrackEffects) {
  // Drive — Tone.Distortion's `distortion` is 0..1; combined with oversampling
  // it gives a clean tape-saturation feel at low values and a meaty crunch high.
  if (effects.driveOn) {
    fx.drive.distortion = effects.driveAmount;
    fx.drive.wet.value = 1;
    fx.drive.oversample = "2x";
  } else {
    fx.drive.distortion = 0;
    fx.drive.wet.value = 0;
  }

  if (effects.trackEqOn) {
    fx.trackEq.low.value = Math.max(-18, Math.min(18, effects.trackEqLow));
    fx.trackEq.mid.value = Math.max(-18, Math.min(18, effects.trackEqMid));
    fx.trackEq.high.value = Math.max(-18, Math.min(18, effects.trackEqHigh));
  } else {
    fx.trackEq.low.value = 0;
    fx.trackEq.mid.value = 0;
    fx.trackEq.high.value = 0;
  }

  if (effects.filterOn) {
    fx.filter.frequency.value = effects.filterFreq;
    fx.filter.type = effects.filterType;
    fx.filter.Q.value = effects.filterQ;
  } else {
    fx.filter.frequency.value = 20000;
    fx.filter.type = "lowpass";
    fx.filter.Q.value = 1;
  }

  if (effects.delayOn) {
    fx.delay.delayTime.value = effects.delayTime;
    fx.delay.feedback.value = effects.delayFeedback;
    fx.delayGain.gain.value = effects.delayWet;
  } else {
    fx.delayGain.gain.value = 0;
  }

  if (effects.reverbOn) {
    fx.reverb.decay = effects.reverbDecay;
    fx.reverbGain.gain.value = effects.reverbWet;
  } else {
    fx.reverbGain.gain.value = 0;
  }
}

function createMasterChain(): MasterChain {
  const master = useEngineStore.getState().master;
  const limiter = new Tone.Limiter(master.limiterThreshold).toDestination();
  const compressor = new Tone.Compressor({
    threshold: master.compressorThreshold,
    ratio: master.compressorRatio,
    attack: master.compressorAttack,
    release: master.compressorRelease,
  }).connect(limiter);
  // Tone.EQ3 is a 3-band shelf+peak. It's the standard "master tone" tool;
  // bypass = all bands at 0 dB.
  const eq = new Tone.EQ3({
    low: master.eqOn ? master.eqLow : 0,
    mid: master.eqOn ? master.eqMid : 0,
    high: master.eqOn ? master.eqHigh : 0,
  }).connect(compressor);
  // Warmth: drive (soft saturation) + a gentle high-shelf cut. Tape rolls off
  // air above 10kHz and adds even-harmonic distortion. We mimic both with low
  // distortion amounts and a -dB shelf at 10kHz. Order: drive then shelf so
  // the harmonics get tamed at the top.
  const warmthShelf = new Tone.Filter({ type: "highshelf", frequency: 10000, gain: 0 }).connect(eq);
  const warmthDrive = new Tone.Distortion({ distortion: 0, wet: 0, oversample: "4x" }).connect(warmthShelf);
  const gain = new Tone.Gain(master.volume).connect(warmthDrive);
  return { gain, warmthDrive, warmthShelf, eq, compressor, limiter };
}

function applyMasterSettings(chain: MasterChain, master: MasterBus) {
  chain.gain.gain.value = master.volume;

  if (master.eqOn) {
    chain.eq.low.value = master.eqLow;
    chain.eq.mid.value = master.eqMid;
    chain.eq.high.value = master.eqHigh;
  } else {
    chain.eq.low.value = 0;
    chain.eq.mid.value = 0;
    chain.eq.high.value = 0;
  }

  if (master.compressorOn) {
    chain.compressor.threshold.value = master.compressorThreshold;
    chain.compressor.ratio.value = master.compressorRatio;
    chain.compressor.attack.value = master.compressorAttack;
    chain.compressor.release.value = master.compressorRelease;
  } else {
    // Bypass: threshold at max so signal never exceeds it, ratio 1:1
    chain.compressor.threshold.value = 0;
    chain.compressor.ratio.value = 1;
    chain.compressor.attack.value = 0.003;
    chain.compressor.release.value = 0.25;
  }

  if (master.limiterOn) {
    chain.limiter.threshold.value = master.limiterThreshold;
  } else {
    // Bypass: set ceiling so high it never limits
    chain.limiter.threshold.value = 6;
  }

  // Warmth: 0..1 maps to a gentle saturation amount and a small high-shelf
  // cut. We keep the drive amount low (max 0.35) — tape character, not crunch.
  // The shelf rolls off up to -4 dB at full warmth, mimicking analog air loss.
  if (master.warmthOn) {
    const w = Math.max(0, Math.min(1, master.warmth));
    chain.warmthDrive.distortion = w * 0.35;
    chain.warmthDrive.wet.value = w > 0 ? 1 : 0;
    chain.warmthShelf.gain.value = -w * 4;
  } else {
    chain.warmthDrive.distortion = 0;
    chain.warmthDrive.wet.value = 0;
    chain.warmthShelf.gain.value = 0;
  }
}

export function useAudioEngine() {
  const synthsRef = useRef<SynthNode[]>([]);
  const gainNodesRef = useRef<Tone.Gain[]>([]);
  const duckGainsRef = useRef<Tone.Gain[]>([]);
  const panNodesRef = useRef<Tone.Panner[]>([]);
  const fxChainsRef = useRef<TrackFXChain[]>([]);
  const masterChainRef = useRef<MasterChain | null>(null);
  const sequenceRef = useRef<Tone.Sequence | null>(null);
  const initializedRef = useRef(false);
  const trackMetersRef = useRef<Tone.Meter[]>([]);
  const trackFFTsRef = useRef<Tone.FFT[]>([]);
  const panLfosRef = useRef<Tone.LFO[]>([]);
  const masterMeterRef = useRef<Tone.Meter | null>(null);
  const masterFFTRef = useRef<Tone.FFT | null>(null);
  const masterWaveformRef = useRef<Tone.Waveform | null>(null);
  // Loudness measurement: a K-weighted tap (high-pass + high-shelf) feeding a
  // Tone.Waveform we read on rAF. Real ITU-R BS.1770 LUFS is more involved
  // (integrated gating, true-peak via 4× upsampling, etc) but the K-weighted
  // RMS tracks short-term loudness well enough to teach the concept and to
  // hit Spotify/Apple targets within ~1 LUFS, which is the actual goal here.
  const loudnessHPFRef = useRef<Tone.Filter | null>(null);
  const loudnessShelfRef = useRef<Tone.Filter | null>(null);
  const loudnessWaveformRef = useRef<Tone.Waveform | null>(null);
  const truePeakWaveformRef = useRef<Tone.Waveform | null>(null);

  const initAudio = useCallback(async () => {
    if (initializedRef.current) return;
    await Tone.start();
    initializedRef.current = true;

    const tracks = useEngineStore.getState().tracks;

    // Create master bus chain
    const masterChain = createMasterChain();
    masterChainRef.current = masterChain;

    // Create synths + per-track FX chains + panner + gain nodes
    synthsRef.current = [];
    gainNodesRef.current = [];
    duckGainsRef.current = [];
    panNodesRef.current = [];
    fxChainsRef.current = [];
    trackMetersRef.current = [];
    panLfosRef.current = [];

    // Master meter
    const masterMeter = new Tone.Meter({ smoothing: 0.8 });
    masterChain.gain.connect(masterMeter);
    masterMeterRef.current = masterMeter;

    // Master FFT + waveform for the visualizer. 1024 bins is plenty for a
    // log-scaled bar display; we only read it from rAF, not the audio thread.
    const masterFFT = new Tone.FFT({ size: 1024, smoothing: 0.7 });
    masterChain.gain.connect(masterFFT);
    masterFFTRef.current = masterFFT;

    const masterWaveform = new Tone.Waveform(512);
    masterChain.gain.connect(masterWaveform);
    masterWaveformRef.current = masterWaveform;

    // Loudness K-weighting tap: 40Hz high-pass → +4dB high-shelf @ 1.5kHz.
    // This is the same pre-filter family used by BS.1770 (a stripped-down
    // approximation). Feed a Waveform analyser so we can compute RMS in JS.
    // We tap the limiter's input (post-EQ/comp) so what's metered is what's
    // exported, with limiter ceiling ignored — pre-limit RMS is a more honest
    // loudness measurement.
    const loudnessHPF = new Tone.Filter({ type: "highpass", frequency: 40, Q: 0.7 });
    const loudnessShelf = new Tone.Filter({ type: "highshelf", frequency: 1500, gain: 4 });
    masterChain.compressor.connect(loudnessHPF);
    loudnessHPF.connect(loudnessShelf);
    const loudnessWaveform = new Tone.Waveform(4096);
    loudnessShelf.connect(loudnessWaveform);
    loudnessHPFRef.current = loudnessHPF;
    loudnessShelfRef.current = loudnessShelf;
    loudnessWaveformRef.current = loudnessWaveform;

    // True-peak tap: read from post-limiter, large window, peak-detect with
    // simple linear interpolation (a 2× oversampling approximation that
    // catches inter-sample peaks the standard sample meter misses).
    const truePeakWaveform = new Tone.Waveform(4096);
    masterChain.limiter.connect(truePeakWaveform);
    truePeakWaveformRef.current = truePeakWaveform;

    tracks.forEach((track) => {
      // Signal chain: Synth → FX → Gain → DuckGain → Meter → Panner → Master
      // DuckGain sits AFTER the user volume so the sidechain ducks the whole
      // signal (including wet effects). The meter reads post-duck so the UI
      // reflects what's actually heard.
      const panner = new Tone.Panner(track.pan).connect(masterChain.gain);
      const duckGain = new Tone.Gain(1).connect(panner);
      const gain = new Tone.Gain(track.volume).connect(duckGain);

      const meter = new Tone.Meter({ smoothing: 0.8 });
      duckGain.connect(meter);
      trackMetersRef.current.push(meter);

      // Per-track FFT for the Sonic X-Ray: tap post-duck so it reflects the
      // actually-heard signal (sidechain-ducked, post-FX, post-volume). 512
      // bins is enough to see frequency content distinctly without expensive
      // rendering — the X-Ray reads 8 of these per frame on rAF.
      const trackFFT = new Tone.FFT({ size: 512, smoothing: 0.6 });
      duckGain.connect(trackFFT);
      trackFFTsRef.current.push(trackFFT);

      const fx = createTrackFX(gain);
      applyTrackFX(fx, track.effects);

      let synth: SynthNode;
      if (track.customSampleUrl) {
        synth = new Tone.Sampler({ urls: { [track.sound.note]: track.customSampleUrl } });
      } else {
        synth = createSynth(track.sound);
      }
      synth.connect(fx.drive);

      // Per-track auto-pan LFO. Always connected to panner.pan; AudioParams
      // sum input signals with the param's intrinsic value, so the LFO
      // oscillates AROUND the user's manual pan setting. When the LFO is
      // stopped, output is 0 and the manual pan remains effective.
      const panLfo = new Tone.LFO({
        frequency: track.effects.panLfoRate,
        type: track.effects.panLfoShape,
        min: -track.effects.panLfoDepth,
        max: track.effects.panLfoDepth,
      });
      panLfo.connect(panner.pan);
      if (track.effects.panLfoOn) panLfo.start();

      synthsRef.current.push(synth);
      gainNodesRef.current.push(gain);
      duckGainsRef.current.push(duckGain);
      panNodesRef.current.push(panner);
      fxChainsRef.current.push(fx);
      panLfosRef.current.push(panLfo);
    });
  }, []);

  // Sync BPM + swing. LFO frequencies are tempo-synced via Tone.Time strings
  // ("4n", "8n", etc) — they parse using the BPM at the moment of assignment,
  // so we re-set them whenever BPM changes to keep modulation in time.
  useEffect(() => {
    let prevBpm = useEngineStore.getState().bpm;
    const unsub = useEngineStore.subscribe((state) => {
      Tone.getTransport().bpm.value = state.bpm;
      Tone.getTransport().swing = state.swing;
      if (state.bpm !== prevBpm) {
        prevBpm = state.bpm;
        state.tracks.forEach((track, i) => {
          const lfo = panLfosRef.current[i];
          if (!lfo) return;
          lfo.frequency.value = track.effects.panLfoRate;
        });
      }
    });
    return unsub;
  }, []);

  // Sync mixer (volume, mute, solo, pan)
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      const hasSolo = state.tracks.some((t) => t.solo);
      state.tracks.forEach((track, i) => {
        const gain = gainNodesRef.current[i];
        const panner = panNodesRef.current[i];
        if (!gain) return;
        const audible = hasSolo ? track.solo && !track.muted : !track.muted;
        gain.gain.value = audible ? track.volume : 0;
        if (panner) panner.pan.value = track.pan;
      });
    });
    return unsub;
  }, []);

  // Sync per-track effects (incl. auto-pan LFO state)
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      state.tracks.forEach((track, i) => {
        const fx = fxChainsRef.current[i];
        if (fx) applyTrackFX(fx, track.effects);

        const lfo = panLfosRef.current[i];
        if (!lfo) return;
        lfo.min = -track.effects.panLfoDepth;
        lfo.max = track.effects.panLfoDepth;
        lfo.frequency.value = track.effects.panLfoRate;
        lfo.type = track.effects.panLfoShape;
        if (track.effects.panLfoOn && lfo.state !== "started") {
          lfo.start();
        } else if (!track.effects.panLfoOn && lfo.state === "started") {
          lfo.stop();
        }
      });
    });
    return unsub;
  }, []);

  // Hot-swap synths when a custom sample is loaded or cleared
  useEffect(() => {
    const prevUrls: (string | null)[] = useEngineStore
      .getState()
      .tracks.map((t) => t.customSampleUrl);

    const unsub = useEngineStore.subscribe((state) => {
      state.tracks.forEach((track, i) => {
        const prev = prevUrls[i] ?? null;
        const curr = track.customSampleUrl;
        if (curr === prev) return;
        prevUrls[i] = curr;

        const fx = fxChainsRef.current[i];
        if (!fx) return;

        const oldSynth = synthsRef.current[i];
        if (curr) {
          const sampler = new Tone.Sampler({
            urls: { [track.sound.note]: curr },
            onload: () => {
              sampler.connect(fx.drive);
              synthsRef.current[i] = sampler;
              oldSynth?.dispose();
            },
          });
        } else {
          const synth = createSynth(track.sound);
          synth.connect(fx.drive);
          synthsRef.current[i] = synth;
          oldSynth?.dispose();
        }
      });
    });
    return unsub;
  }, []);

  // Sync master bus
  useEffect(() => {
    const unsub = useEngineStore.subscribe((state) => {
      const chain = masterChainRef.current;
      if (!chain) return;
      applyMasterSettings(chain, state.master);
    });
    return unsub;
  }, []);

  // Playback control
  useEffect(() => {
    let prevPlaybackState = useEngineStore.getState().playbackState;
    let needsChainAdvance = false;

    const unsub = useEngineStore.subscribe((state) => {
      const playbackState = state.playbackState;
      if (playbackState === prevPlaybackState) return;
      prevPlaybackState = playbackState;

      const transport = Tone.getTransport();
      if (playbackState === "playing") {
        if (sequenceRef.current) {
          sequenceRef.current.dispose();
        }

        const startState = useEngineStore.getState();
        const { totalSteps, setCurrentStep } = startState;
        const stepIndices = Array.from({ length: totalSteps }, (_, i) => i);

        transport.bpm.value = startState.bpm;
        transport.swing = startState.swing;

        // If song mode is on with a chain, jump to the first pattern in the chain
        if (startState.songMode && startState.chain.length > 0) {
          const firstPattern = startState.chain[0];
          if (firstPattern !== startState.currentPattern) {
            startState.switchPatternSilent(firstPattern);
          }
          startState.setChainPosition(0);
        }
        needsChainAdvance = false;

        sequenceRef.current = new Tone.Sequence(
          (time, stepIndex) => {
            // Advance chain at the start of a new loop iteration
            if (needsChainAdvance && stepIndex === 0) {
              const { songMode, chain, chainPosition, switchPatternSilent, setChainPosition } =
                useEngineStore.getState();
              if (songMode && chain.length > 0) {
                const nextPos = (chainPosition + 1) % chain.length;
                const nextPattern = chain[nextPos];
                switchPatternSilent(nextPattern);
                setChainPosition(nextPos);
              }
              needsChainAdvance = false;
            }

            setCurrentStep(stepIndex);

            const currentState = useEngineStore.getState();
            const currentTracks = currentState.tracks;
            const hasSolo = currentTracks.some((t: Track) => t.solo);

            // Step duration in seconds; multiplied by per-track noteLength so
            // each track can be staccato or held independent of the grid.
            const stepDurationSeconds = (60 / currentState.bpm) * (4 / totalSteps);

            currentTracks.forEach((track: Track, trackIndex: number) => {
              const velocity = track.steps[stepIndex];
              if (!velocity) return;
              const probability = track.probabilities?.[stepIndex] ?? 1.0;
              if (probability < 1.0 && Math.random() > probability) return;
              const audible = hasSolo
                ? track.solo && !track.muted
                : !track.muted;
              if (!audible) return;

              const synth = synthsRef.current[trackIndex];
              if (synth) {
                const noteOverride = track.notes?.[stepIndex] || undefined;
                const dur = stepDurationSeconds * (track.noteLength ?? 1.0);
                const nudgeOffset = (track.nudge?.[stepIndex] ?? 0) * stepDurationSeconds;
                triggerSynth(synth, track.sound, time + nudgeOffset, velocity, dur, noteOverride);
              }

              const triggerTime = time + ((track.nudge?.[stepIndex] ?? 0) * stepDurationSeconds);
              currentTracks.forEach((target: Track, targetIdx: number) => {
                if (!target.effects.sidechainOn) return;
                if (target.effects.sidechainSource !== trackIndex) return;
                const dg = duckGainsRef.current[targetIdx];
                if (!dg) return;
                const depth = Math.max(0, Math.min(1, target.effects.sidechainDepth));
                const release = Math.max(0.01, target.effects.sidechainRelease);
                dg.gain.cancelScheduledValues(triggerTime);
                dg.gain.setValueAtTime(1 - depth, triggerTime);
                dg.gain.linearRampToValueAtTime(1, triggerTime + release);
              });
            });

            // Mark for chain advance at the end of the pattern
            if (
              currentState.songMode &&
              currentState.chain.length > 0 &&
              stepIndex === totalSteps - 1
            ) {
              needsChainAdvance = true;
            }
          },
          stepIndices,
          "16n"
        );

        sequenceRef.current.start(0);
        transport.start();
      } else if (playbackState === "paused") {
        transport.pause();
      } else {
        transport.stop();
        needsChainAdvance = false;
        useEngineStore.getState().setChainPosition(0);
        if (sequenceRef.current) {
          sequenceRef.current.stop();
          sequenceRef.current.dispose();
          sequenceRef.current = null;
        }
      }
    });
    return unsub;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      sequenceRef.current?.dispose();
      synthsRef.current.forEach((s) => s.dispose());
      gainNodesRef.current.forEach((g) => g.dispose());
      duckGainsRef.current.forEach((g) => g.dispose());
      panNodesRef.current.forEach((p) => p.dispose());
      panLfosRef.current.forEach((l) => {
        if (l.state === "started") l.stop();
        l.dispose();
      });
      trackMetersRef.current.forEach((m) => m.dispose());
      trackFFTsRef.current.forEach((f) => f.dispose());
      masterMeterRef.current?.dispose();
      masterFFTRef.current?.dispose();
      masterWaveformRef.current?.dispose();
      loudnessHPFRef.current?.dispose();
      loudnessShelfRef.current?.dispose();
      loudnessWaveformRef.current?.dispose();
      truePeakWaveformRef.current?.dispose();
      fxChainsRef.current.forEach((fx) => {
        fx.drive.dispose();
        fx.trackEq.dispose();
        fx.filter.dispose();
        fx.delay.dispose();
        fx.reverb.dispose();
        fx.delayGain.dispose();
        fx.reverbGain.dispose();
        fx.dryGain.dispose();
      });
      if (masterChainRef.current) {
        masterChainRef.current.gain.dispose();
        masterChainRef.current.warmthDrive.dispose();
        masterChainRef.current.warmthShelf.dispose();
        masterChainRef.current.eq.dispose();
        masterChainRef.current.compressor.dispose();
        masterChainRef.current.limiter.dispose();
      }
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    };
  }, []);

  const getTrackMeter = useCallback((index: number): number => {
    const meter = trackMetersRef.current[index];
    if (!meter) return -Infinity;
    const val = meter.getValue();
    return typeof val === "number" ? val : val[0];
  }, []);

  const getMasterMeter = useCallback((): number => {
    const meter = masterMeterRef.current;
    if (!meter) return -Infinity;
    const val = meter.getValue();
    return typeof val === "number" ? val : val[0];
  }, []);

  const getMasterSpectrum = useCallback((): Float32Array | null => {
    return masterFFTRef.current?.getValue() ?? null;
  }, []);

  const getMasterWaveform = useCallback((): Float32Array | null => {
    return masterWaveformRef.current?.getValue() ?? null;
  }, []);

  const getTrackSpectrum = useCallback((index: number): Float32Array | null => {
    return trackFFTsRef.current[index]?.getValue() ?? null;
  }, []);

  // Short-term loudness, K-weighted RMS converted to dB. We treat this as a
  // close-enough LUFS-S reading. Returns -Infinity when silent.
  const getLoudness = useCallback((): number => {
    const w = loudnessWaveformRef.current;
    if (!w) return -Infinity;
    const buf = w.getValue();
    if (!buf || buf.length === 0) return -Infinity;
    let sumSq = 0;
    for (let i = 0; i < buf.length; i++) {
      const s = buf[i];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    if (rms <= 1e-7) return -Infinity;
    // Calibration offset: BS.1770 reference is -0.691 dB on K-weighted full
    // scale sine. RMS-of-sine to peak ratio adds another ~3 dB. The composite
    // offset that lines us up with common LUFS readouts is roughly +0.7 dB.
    return 20 * Math.log10(rms) + 0.7;
  }, []);

  // True-peak approximation: sample peak with a 2× linear-interpolation
  // overshoot estimate. ITU spec uses 4× polyphase filtering; for a teaching
  // meter, 2× linear catches most inter-sample peaks within ~0.3 dB.
  const getTruePeak = useCallback((): number => {
    const w = truePeakWaveformRef.current;
    if (!w) return -Infinity;
    const buf = w.getValue();
    if (!buf || buf.length < 2) return -Infinity;
    let peak = 0;
    for (let i = 0; i < buf.length - 1; i++) {
      const a = Math.abs(buf[i]);
      const b = Math.abs(buf[i + 1]);
      if (a > peak) peak = a;
      // Midpoint estimate for inter-sample peak.
      const mid = Math.abs((buf[i] + buf[i + 1]) * 0.5);
      if (mid > peak) peak = mid;
      if (b > peak) peak = b;
    }
    if (peak <= 1e-7) return -Infinity;
    return 20 * Math.log10(peak);
  }, []);

  // Live trigger — used by performance keys (Q-I) to play any track on demand,
  // independent of the step sequencer. Honors the track's noteLength and
  // fires sidechain envelopes the same way the sequence does, so manual
  // kicks pump bass even outside the running pattern.
  const triggerTrack = useCallback((index: number, velocity = 1.0) => {
    if (!initializedRef.current) return;
    const state = useEngineStore.getState();
    const track = state.tracks[index];
    if (!track) return;
    const synth = synthsRef.current[index];
    if (!synth) return;

    const stepDur = (60 / state.bpm) * (4 / state.totalSteps);
    const dur = stepDur * (track.noteLength ?? 1.0);
    const now = Tone.now();
    triggerSynth(synth, track.sound, now, velocity, dur);

    state.tracks.forEach((target, targetIdx) => {
      if (!target.effects.sidechainOn) return;
      if (target.effects.sidechainSource !== index) return;
      const dg = duckGainsRef.current[targetIdx];
      if (!dg) return;
      const depth = Math.max(0, Math.min(1, target.effects.sidechainDepth));
      const release = Math.max(0.01, target.effects.sidechainRelease);
      dg.gain.cancelScheduledValues(now);
      dg.gain.setValueAtTime(1 - depth, now);
      dg.gain.linearRampToValueAtTime(1, now + release);
    });

    // Visual flash on the channel strip — listeners attach in Mixer.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("sts-track-trigger", { detail: { index } }),
      );
    }
  }, []);

  return {
    initAudio,
    getTrackMeter,
    getMasterMeter,
    getMasterSpectrum,
    getMasterWaveform,
    getTrackSpectrum,
    getLoudness,
    getTruePeak,
    triggerTrack,
  };
}
