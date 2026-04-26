"use client";

// Defence-in-depth: AI routes return patches with string keys ({ type, key,
// value, ... }). Without validation, a hallucinated key like "volumeXXX"
// would silently pollute the Zustand state object. The system prompts
// constrain the model well, but verifying at the dispatch boundary is cheap
// insurance and removes every `as any` cast in the AI panels.

import {
  useEngineStore,
  type TrackEffects,
  type MasterBus,
} from "@/store/engine";

// Allow-lists derived from the type definitions. Update these alongside the
// types if new fields are added to TrackEffects or MasterBus.
const TRACK_FX_KEYS = new Set<keyof TrackEffects>([
  "filterOn", "filterType", "filterFreq", "filterQ",
  "driveOn", "driveAmount",
  "delayOn", "delayTime", "delayFeedback", "delayWet",
  "reverbOn", "reverbDecay", "reverbWet",
  "sidechainOn", "sidechainSource", "sidechainDepth", "sidechainRelease",
  "panLfoOn", "panLfoRate", "panLfoDepth", "panLfoShape",
  "modLfoOn", "modLfoRate", "modLfoDepth", "modLfoShape", "modLfoTarget",
]);

const MASTER_KEYS = new Set<keyof MasterBus>([
  "volume",
  "compressorOn", "compressorThreshold", "compressorRatio",
  "compressorAttack", "compressorRelease",
  "limiterOn", "limiterThreshold",
  "eqOn", "eqLow", "eqMid", "eqHigh",
  "tapeOn", "tapeAmount",
  "widthOn", "width",
  "loudnessTarget",
]);

export interface MixPatch {
  type: "trackVolume" | "trackPan" | "trackEffect" | "master";
  trackId?: number;
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  enable?: string;
}

function isTrackFxKey(key: string): key is keyof TrackEffects {
  return TRACK_FX_KEYS.has(key as keyof TrackEffects);
}

function isMasterKey(key: string): key is keyof MasterBus {
  return MASTER_KEYS.has(key as keyof MasterBus);
}

// Apply a single AI-issued patch. Returns true if applied, false if the
// patch was rejected for safety reasons (logged to console for debugging).
export function applyMixPatch(patch: MixPatch): boolean {
  const store = useEngineStore.getState();

  switch (patch.type) {
    case "trackVolume": {
      if (typeof patch.trackId !== "number") return reject("trackVolume missing trackId", patch);
      const v = Number(patch.value);
      if (!Number.isFinite(v)) return reject("trackVolume value not numeric", patch);
      store.setTrackVolume(patch.trackId, Math.max(0, Math.min(1, v)));
      return true;
    }

    case "trackPan": {
      if (typeof patch.trackId !== "number") return reject("trackPan missing trackId", patch);
      const v = Number(patch.value);
      if (!Number.isFinite(v)) return reject("trackPan value not numeric", patch);
      store.setTrackPan(patch.trackId, Math.max(-1, Math.min(1, v)));
      return true;
    }

    case "trackEffect": {
      if (typeof patch.trackId !== "number") return reject("trackEffect missing trackId", patch);
      if (patch.enable && isTrackFxKey(patch.enable)) {
        store.setTrackEffect(patch.trackId, patch.enable, true as never);
      } else if (patch.enable) {
        // unknown enable key — skip but continue with main key
        console.warn("applyMixPatch: unknown enable key", patch.enable);
      }
      if (!isTrackFxKey(patch.key)) return reject(`unknown trackEffect key '${patch.key}'`, patch);
      store.setTrackEffect(patch.trackId, patch.key, patch.value as never);
      return true;
    }

    case "master": {
      if (!isMasterKey(patch.key)) return reject(`unknown master key '${patch.key}'`, patch);
      store.setMaster(patch.key, patch.value as never);
      return true;
    }

    default:
      return reject(`unknown patch type '${(patch as MixPatch).type}'`, patch);
  }
}

function reject(reason: string, patch: MixPatch): false {
  console.warn(`[patchValidation] rejected patch: ${reason}`, patch);
  return false;
}

// Convenience for callers that have a list — returns the count of applied
// patches. Continues past individual rejections.
export function applyMixPatches(patches: MixPatch[]): number {
  let applied = 0;
  for (const p of patches) {
    if (applyMixPatch(p)) applied++;
  }
  return applied;
}
