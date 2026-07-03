/**
 * lib/pr.ts — PR detection helpers (ARCHITECTURE.md §5). Pure comparison
 * logic; the logSet/completeSession server actions own persistence.
 * Lineage-scoped: compare against records for the same templateExerciseId
 * when present, else exerciseId. Deload sessions never produce PRs.
 */
import type { PrType } from "@/lib/generated/prisma/enums";
import { epley } from "@/lib/e1rm";

export interface CandidateSet {
  weight: number;
  reps: number;
  completed: boolean;
}

/** Current bests to compare against (from stored PersonalRecord rows). */
export interface CurrentBests {
  heaviestWeight: number | null;
  bestE1rm: number | null;
  /** Best reps + the weight it was achieved at (MOST_REPS context). */
  mostReps: { reps: number; weight: number } | null;
  mostSessionVolume: number | null;
}

export interface DetectedPr {
  type: PrType;
  value: number;
  weight?: number;
  reps?: number;
}

/**
 * Set-level PRs, checked at set-save time: HEAVIEST_WEIGHT, BEST_E1RM,
 * MOST_REPS (more reps at ≥ the previous rep-PR weight).
 */
export function detectSetPRs(set: CandidateSet, bests: CurrentBests, isDeload: boolean): DetectedPr[] {
  if (isDeload || !set.completed || set.weight <= 0 || set.reps <= 0) return [];
  const prs: DetectedPr[] = [];

  if (bests.heaviestWeight == null || set.weight > bests.heaviestWeight) {
    prs.push({ type: "HEAVIEST_WEIGHT", value: set.weight, weight: set.weight, reps: set.reps });
  }

  const e1rm = epley(set.weight, set.reps);
  if (bests.bestE1rm == null || e1rm > bests.bestE1rm) {
    prs.push({ type: "BEST_E1RM", value: e1rm, weight: set.weight, reps: set.reps });
  }

  if (
    bests.mostReps == null ||
    (set.weight >= bests.mostReps.weight && set.reps > bests.mostReps.reps)
  ) {
    prs.push({ type: "MOST_REPS", value: set.reps, weight: set.weight, reps: set.reps });
  }

  return prs;
}

/** Session-level PR, checked on session completion. */
export function detectSessionVolumePR(
  sessionVolume: number,
  bests: Pick<CurrentBests, "mostSessionVolume">,
  isDeload: boolean
): DetectedPr | null {
  if (isDeload || sessionVolume <= 0) return null;
  if (bests.mostSessionVolume == null || sessionVolume > bests.mostSessionVolume) {
    return { type: "MOST_SESSION_VOLUME", value: sessionVolume };
  }
  return null;
}

/** Short display label per PR type (DESIGN.md §3.6 badge variants). */
export const PR_TYPE_LABELS: Record<PrType, string> = {
  HEAVIEST_WEIGHT: "PR · WEIGHT",
  BEST_E1RM: "PR · e1RM",
  MOST_REPS: "PR · REPS",
  MOST_SESSION_VOLUME: "PR · VOLUME",
};
