import * as Tone from "tone";
import type { Track } from "@/types";

interface TrackChannel {
  channel: Tone.Channel;
  instrument: Tone.PolySynth | null;
}

class AudioEngine {
  private channels: Map<string, TrackChannel> = new Map();
  private _isStarted = false;
  private animationFrameId: number | null = null;
  private beatCallback: ((beat: number) => void) | null = null;

  get isStarted() {
    return this._isStarted;
  }

  async ensureStarted() {
    if (!this._isStarted) {
      await Tone.start();
      this._isStarted = true;
    }
  }

  setBpm(bpm: number) {
    Tone.getTransport().bpm.value = bpm;
  }

  getBpm(): number {
    return Tone.getTransport().bpm.value;
  }

  async play() {
    await this.ensureStarted();
    Tone.getTransport().start();
    this.startBeatTracking();
  }

  stop() {
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
    this.stopBeatTracking();
  }

  pause() {
    Tone.getTransport().pause();
    this.stopBeatTracking();
  }

  onBeat(callback: (beat: number) => void) {
    this.beatCallback = callback;
  }

  private startBeatTracking() {
    const tick = () => {
      if (Tone.getTransport().state === "started") {
        const seconds = Tone.getTransport().seconds;
        const bpm = Tone.getTransport().bpm.value;
        const beat = (seconds / 60) * bpm;
        this.beatCallback?.(beat);
      }
      this.animationFrameId = requestAnimationFrame(tick);
    };
    tick();
  }

  private stopBeatTracking() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  syncTrack(track: Track) {
    let tc = this.channels.get(track.id);

    if (!tc) {
      const channel = new Tone.Channel().toDestination();
      const instrument = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.4 },
      }).connect(channel);

      tc = { channel, instrument };
      this.channels.set(track.id, tc);
    }

    tc.channel.volume.value = this.linearToDb(track.volume);
    tc.channel.pan.value = track.pan;
    tc.channel.mute = track.muted;
  }

  removeTrack(trackId: string) {
    const tc = this.channels.get(trackId);
    if (tc) {
      tc.instrument?.dispose();
      tc.channel.dispose();
      this.channels.delete(trackId);
    }
  }

  triggerNote(trackId: string, note: string, duration: string = "8n") {
    const tc = this.channels.get(trackId);
    if (tc?.instrument) {
      tc.instrument.triggerAttackRelease(note, duration);
    }
  }

  applySolo(tracks: Track[]) {
    const anySoloed = tracks.some((t) => t.soloed);
    for (const track of tracks) {
      const tc = this.channels.get(track.id);
      if (tc) {
        if (anySoloed) {
          tc.channel.mute = !track.soloed || track.muted;
        } else {
          tc.channel.mute = track.muted;
        }
      }
    }
  }

  setLoop(enabled: boolean, startBeat: number, endBeat: number) {
    const transport = Tone.getTransport();
    transport.loop = enabled;
    if (enabled) {
      const bpm = transport.bpm.value;
      transport.loopStart = (startBeat / bpm) * 60;
      transport.loopEnd = (endBeat / bpm) * 60;
    }
  }

  private linearToDb(value: number): number {
    if (value === 0) return -Infinity;
    return 20 * Math.log10(value);
  }

  getTransportPosition(): string {
    const pos = Tone.getTransport().position;
    if (typeof pos === "string") return pos;
    return "0:0:0";
  }

  dispose() {
    this.stopBeatTracking();
    this.channels.forEach((tc) => {
      tc.instrument?.dispose();
      tc.channel.dispose();
    });
    this.channels.clear();
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
  }
}

export const audioEngine = new AudioEngine();
