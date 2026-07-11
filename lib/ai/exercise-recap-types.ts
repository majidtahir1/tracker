export interface ExerciseRecapResponse {
  /** ≤100 chars, e.g. "Pressing volume up 8% on last week." */
  headline: string;
  /** ≤240 chars, realistic assessment of the completed exercise. */
  message: string;
  /** ≤160 chars, one concrete direction for the rest of the workout. */
  focusCue: string;
  source: "minimax" | "deterministic";
}
