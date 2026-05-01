export type StepCallback = (step: number, time: number) => void;

export class Scheduler {
  private ctx: AudioContext;
  private lookahead = 0.1;
  private interval = 25;
  private nextTime = 0;
  private step = 0;
  private timer: number | null = null;
  private getBpm: () => number;
  private getSwing: () => number;
  private onStep: StepCallback;

  constructor(
    ctx: AudioContext,
    getBpm: () => number,
    getSwing: () => number,
    onStep: StepCallback,
  ) {
    this.ctx = ctx;
    this.getBpm = getBpm;
    this.getSwing = getSwing;
    this.onStep = onStep;
  }

  start(fromStep = 0) {
    this.step = fromStep;
    this.nextTime = this.ctx.currentTime + 0.005;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), this.interval);
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    const end = this.ctx.currentTime + this.lookahead;
    while (this.nextTime < end) {
      this.onStep(this.step, this.nextTime);
      this.advance();
    }
  }

  private advance() {
    const bpm = this.getBpm();
    const swing = this.getSwing();
    const eighthDuration = 60 / bpm / 2;
    // swing 0 = straight (50/50 split), swing 100 = heavy shuffle (85/15 split)
    const swingRatio = 0.5 + (swing / 100) * 0.35;

    if (this.step % 2 === 0) {
      this.nextTime += eighthDuration * swingRatio;
    } else {
      this.nextTime += eighthDuration * (1 - swingRatio);
    }

    this.step = (this.step + 1) % 16;
  }
}

export function stepToTime(globalStep: number, bpm: number, swing: number): number {
  let time = 0;
  const eighthDuration = 60 / bpm / 2;
  const swingRatio = 0.5 + (swing / 100) * 0.35;

  for (let s = 0; s < globalStep; s++) {
    if (s % 2 === 0) {
      time += eighthDuration * swingRatio;
    } else {
      time += eighthDuration * (1 - swingRatio);
    }
  }

  return time;
}
