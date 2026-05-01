import type { Track, Macro } from '../store/engine';

const SCALE = [0, 2, 3, 5, 7, 10, 12, 14];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function triggerVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  sendNode: AudioNode | null,
  track: Track,
  macros: Macro,
  stepIndex: number,
  time: number,
) {
  const note = track.pitch * 2 ** (SCALE[(stepIndex + Math.round(macros.gravity / 14)) % SCALE.length] / 12);

  const gain = ctx.createGain();
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.sin(stepIndex + track.hue) * 0.42;
  gain.connect(pan);
  pan.connect(destination);

  if (sendNode) {
    const sendGain = ctx.createGain();
    sendGain.gain.value = macros.shimmer / 260;
    pan.connect(sendGain);
    sendGain.connect(sendNode);
  }

  switch (track.voice) {
    case 'kick': synthKick(ctx, gain, track.level, time); break;
    case 'snare': synthSnare(ctx, gain, track.level, time); break;
    case 'hat': synthHat(ctx, gain, track.level, macros, time); break;
    case 'bass': synthBass(ctx, gain, track.level, note, macros, time); break;
    case 'pluck': synthPluck(ctx, gain, track.level, note, macros, time); break;
    case 'pad': synthPad(ctx, gain, track.level, note, macros, time); break;
  }
}

function synthKick(ctx: BaseAudioContext, output: GainNode, level: number, time: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.3);

  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = 'square';
  click.frequency.value = 3200;
  clickGain.gain.setValueAtTime(level * 0.15, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.008);
  click.connect(clickGain);
  clickGain.connect(output);
  click.start(time);
  click.stop(time + 0.01);

  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = (Math.PI + 3.2) * x / (Math.PI + 3.2 * Math.abs(x));
  }
  shaper.curve = curve;

  osc.connect(shaper);
  shaper.connect(output);

  output.gain.setValueAtTime(level * 0.88, time);
  output.gain.setValueAtTime(level * 0.88, time + 0.03);
  output.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

  osc.start(time);
  osc.stop(time + 0.4);
}

function synthSnare(ctx: BaseAudioContext, output: GainNode, level: number, time: number) {
  const noiseLen = Math.floor(ctx.sampleRate * 0.2);
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2000;
  noiseFilter.Q.value = 0.7;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(level * 0.55, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(output);
  noise.start(time);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(185, time);
  body.frequency.exponentialRampToValueAtTime(120, time + 0.04);

  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(level * 0.5, time);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

  body.connect(bodyGain);
  bodyGain.connect(output);
  body.start(time);
  body.stop(time + 0.15);

  output.gain.value = 1;
}

function synthHat(ctx: BaseAudioContext, output: GainNode, level: number, macros: Macro, time: number) {
  const ratios = [1, 1.342, 1.541, 1.655, 1.897, 2.0];
  const fundamental = 320;
  const duration = 0.04 + (macros.bloom / 100) * 0.08;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  hp.Q.value = 0.5;
  hp.connect(output);

  ratios.forEach(ratio => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = fundamental * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * 0.06, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(g);
    g.connect(hp);
    osc.start(time);
    osc.stop(time + duration + 0.01);
  });

  const noiseLen = Math.floor(ctx.sampleRate * 0.08);
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(level * 0.2, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  noise.connect(noiseGain);
  noiseGain.connect(hp);
  noise.start(time);

  output.gain.value = 1;
}

function synthBass(ctx: BaseAudioContext, output: GainNode, level: number, note: number, macros: Macro, time: number) {
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = note * 0.5;

  const character = ctx.createOscillator();
  character.type = 'sawtooth';
  character.frequency.value = note;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const freq = clamp(200 + macros.bloom * 30, 120, 4000);
  filter.frequency.setValueAtTime(freq * 3, time);
  filter.frequency.exponentialRampToValueAtTime(freq, time + 0.15);
  filter.Q.value = 2 + macros.fracture / 20;

  const subGain = ctx.createGain();
  subGain.gain.value = level * 0.5;
  const charGain = ctx.createGain();
  charGain.gain.value = level * 0.25;

  sub.connect(subGain);
  character.connect(charGain);
  subGain.connect(filter);
  charGain.connect(filter);
  filter.connect(output);

  output.gain.setValueAtTime(0.001, time);
  output.gain.linearRampToValueAtTime(0.9, time + 0.01);
  output.gain.setValueAtTime(0.9, time + 0.08);
  output.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

  sub.start(time);
  character.start(time);
  sub.stop(time + 0.45);
  character.stop(time + 0.45);
}

function synthPluck(ctx: BaseAudioContext, output: GainNode, level: number, note: number, macros: Macro, time: number) {
  const carrier = ctx.createOscillator();
  carrier.type = 'triangle';
  carrier.frequency.value = note;

  const modulator = ctx.createOscillator();
  modulator.type = 'sine';
  modulator.frequency.value = note * 2;

  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(note * 4, time);
  modGain.gain.exponentialRampToValueAtTime(note * 0.1, time + 0.2);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(clamp(2000 + macros.bloom * 80, 800, 12000), time);
  filter.frequency.exponentialRampToValueAtTime(400, time + 0.3);
  filter.Q.value = 1.5;

  carrier.connect(filter);
  filter.connect(output);

  output.gain.setValueAtTime(0.001, time);
  output.gain.linearRampToValueAtTime(level * 0.36, time + 0.005);
  output.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

  carrier.start(time);
  modulator.start(time);
  carrier.stop(time + 0.35);
  modulator.stop(time + 0.35);
}

function synthPad(ctx: BaseAudioContext, output: GainNode, level: number, note: number, macros: Macro, time: number) {
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = note * 1.004;

  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = note * 0.996;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3 + macros.fracture / 200;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 8;
  lfo.connect(lfoGain);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = clamp(400 + macros.bloom * 50, 200, 6000);
  filter.Q.value = 1.2;
  lfoGain.connect(filter.frequency);

  const mix = ctx.createGain();
  mix.gain.value = 0.5;

  osc1.connect(mix);
  osc2.connect(mix);
  mix.connect(filter);
  filter.connect(output);

  output.gain.setValueAtTime(0.001, time);
  output.gain.linearRampToValueAtTime(level * 0.22, time + 0.12);
  output.gain.setValueAtTime(level * 0.22, time + 0.8);
  output.gain.exponentialRampToValueAtTime(0.001, time + 1.4);

  osc1.start(time);
  osc2.start(time);
  lfo.start(time);
  osc1.stop(time + 1.5);
  osc2.stop(time + 1.5);
  lfo.stop(time + 1.5);
}
