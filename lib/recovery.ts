/**
 * lib/recovery.ts — Recovery Score 0–100 (ARCHITECTURE.md §5). Pure.
 * Missing components redistribute their weight proportionally.
 */

export interface RecoveryInputs {
  sleepHours?: number | null;
  sleepQuality?: number | null; // 1-5
  stress?: number | null; // 1-5 (5 = worst)
  energy?: number | null; // 1-5
  motivation?: number | null; // 1-5
  workoutDifficulty?: number | null; // 1-5 (5 = brutal)
  soreness?: number | null; // 1-5 (5 = wrecked)
}

export type RecoveryBand = "recovered" | "manage" | "fatigued";

interface Component {
  weight: number;
  normalized: number | null; // 0..1, null when input missing
}

/** Weighted 0–100 score; returns null when no components are present. */
export function recoveryScore(inputs: RecoveryInputs): number | null {
  const c = (value: number | null | undefined, weight: number, norm: (v: number) => number): Component => ({
    weight,
    normalized: value == null ? null : Math.min(Math.max(norm(value), 0), 1),
  });

  const components: Component[] = [
    c(inputs.sleepHours, 25, (v) => Math.min(v / 8, 1)),
    c(inputs.sleepQuality, 15, (v) => (v - 1) / 4),
    c(inputs.stress, 15, (v) => (5 - v) / 4),
    c(inputs.energy, 15, (v) => (v - 1) / 4),
    c(inputs.motivation, 10, (v) => (v - 1) / 4),
    c(inputs.soreness, 15, (v) => (5 - v) / 4),
    c(inputs.workoutDifficulty, 5, (v) => (5 - v) / 4),
  ];

  const present = components.filter((x): x is Component & { normalized: number } => x.normalized != null);
  if (present.length === 0) return null;

  const presentWeight = present.reduce((sum, x) => sum + x.weight, 0);
  const raw = present.reduce((sum, x) => sum + x.normalized * (x.weight / presentWeight), 0);
  return Math.round(raw * 100);
}

/** Bands: 70+ green "recovered", 40–69 amber "manage load", <40 red. */
export function recoveryBand(score: number): RecoveryBand {
  if (score >= 70) return "recovered";
  if (score >= 40) return "manage";
  return "fatigued";
}

/** <40 emits FATIGUE_WARNING and flips progression to REDUCE. */
export function isFatigued(score: number | null | undefined): boolean {
  return score != null && score < 40;
}
