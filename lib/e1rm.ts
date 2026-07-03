/**
 * lib/e1rm.ts — Epley estimated 1RM (ARCHITECTURE.md §5).
 */

/** Epley formula. `reps === 1` returns the weight itself. */
export function epley(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/** Display rounding: e1RM renders as an integer lb value. */
export function epleyDisplay(weight: number, reps: number): number {
  return Math.round(epley(weight, reps));
}

/**
 * Bodyweight exercises: e1RM only exists when a bodyweight measurement is
 * available; effective weight = bodyweight + added load.
 */
export function epleyBodyweight(
  bodyweightLb: number | null | undefined,
  addedWeight: number,
  reps: number
): number | null {
  if (bodyweightLb == null || bodyweightLb <= 0) return null;
  return epley(bodyweightLb + addedWeight, reps);
}
