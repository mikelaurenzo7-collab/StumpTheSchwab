export type StepSubdivision = "8n" | "16n" | "32n" | "64n";

export function getStepSubdivision(totalSteps: number): StepSubdivision {
  switch (totalSteps) {
    case 8:
      return "8n";
    case 16:
      return "16n";
    case 32:
      return "32n";
    case 64:
      return "64n";
    default:
      return "16n";
  }
}

export function getStepDurationSeconds(bpm: number, totalSteps: number): number {
  return (60 / bpm) * (4 / totalSteps);
}