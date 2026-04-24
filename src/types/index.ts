export type TransportState = "stopped" | "playing" | "recording";

export interface Track {
  id: string;
  name: string;
  color: string;
  volume: number; // 0-1
  pan: number; // -1 to 1
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  clips: Clip[];
  instrumentType: InstrumentType;
}

export interface Clip {
  id: string;
  trackId: string;
  startBeat: number;
  durationBeats: number;
  color: string;
  name: string;
  notes: Note[];
}

export interface Note {
  pitch: string; // e.g. "C4"
  startBeat: number; // relative to clip start
  durationBeats: number;
  velocity: number; // 0-127
}

export type InstrumentType = "synth" | "sampler" | "drums" | "none";

export interface TimeSignature {
  numerator: number;
  denominator: number;
}
