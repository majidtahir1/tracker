/**
 * lib/progression.ts — Double Progression recommendation engine
 * (ARCHITECTURE.md §5, exact algorithm). Pure; no Prisma imports.
 *
 * History is keyed by templateExerciseId lineage — callers pass the sets of
 * the most recent non-deload COMPLETED session for the slot.
 */

export type Recommendation =
  | "FIRST_TIME"
  | "INCREASE"
  | "REPEAT"
  | "REDUCE"
  | "DELOAD";

export interface PriorSet {
  weight: number;
  reps: number;
  rir: number | null;
  completed: boolean;
}

export interface SlotTargets {
  repRangeMin: number;
  repRangeMax: number;
  targetRirMin: number;
  /** Target sets that applied to the PRIOR session (block-resolved). */
  priorTargetSets: number;
}

export interface ProgressionInput {
  /** Sets from the most recent non-deload COMPLETED session, or null if none. */
  priorSets: PriorSet[] | null;
  /** Sets from the session before that (for the two-session stall check), or null. */
  previousSets?: PriorSet[] | null;
  targets: SlotTargets;
  weightIncrement: number;
  /** Latest RecoveryLog.score, if any. */
  latestRecoveryScore?: number | null;
}

export interface ProgressionResult {
  rec: Recommendation;
  weight: number | null;
  targetReps?: number;
}

/** Round to nearest 5 lb (nearest 2.5 when the increment is 2.5). */
export function roundIncrement(weight: number, weightIncrement: number): number {
  const step = weightIncrement === 2.5 ? 2.5 : 5;
  return Math.round(weight / step) * step;
}

function workingSets(sets: PriorSet[]): { w: number; sets: PriorSet[] } {
  const done = sets.filter((s) => s.completed);
  const w = Math.max(0, ...done.map((s) => s.weight));
  return { w, sets: done.filter((s) => s.weight >= w) };
}

function totalRepsAtWeight(sets: PriorSet[], w: number): number {
  return sets
    .filter((s) => s.completed && s.weight >= w)
    .reduce((sum, s) => sum + s.reps, 0);
}

function avgRir(sets: PriorSet[]): number | null {
  const withRir = sets.filter((s) => s.rir != null);
  if (withRir.length === 0) return null;
  return withRir.reduce((sum, s) => sum + (s.rir as number), 0) / withRir.length;
}

/** Double-progression recommendation for a normal (non-deload) session. */
export function recommendProgression(input: ProgressionInput): ProgressionResult {
  const { priorSets, previousSets, targets, weightIncrement, latestRecoveryScore } = input;

  if (!priorSets || priorSets.length === 0) {
    return { rec: "FIRST_TIME", weight: null };
  }

  const { w, sets: working } = workingSets(priorSets);
  if (working.length === 0) return { rec: "FIRST_TIME", weight: null };

  // INCREASE: every working set hit the top of the range, no set ground out
  // past the RIR target, and no sets were skipped.
  const allTopReps = working.every((s) => s.reps >= targets.repRangeMax);
  const loggedRirs = working.filter((s) => s.rir != null);
  const rirOk = loggedRirs.every((s) => (s.rir as number) >= targets.targetRirMin);
  const noSkipped = working.length >= targets.priorTargetSets;

  if (allTopReps && rirOk && noSkipped) {
    return {
      rec: "INCREASE",
      weight: w + weightIncrement,
      targetReps: targets.repRangeMin,
    };
  }

  // REDUCE: low recovery, or two straight sessions with zero rep progress at
  // weight W and average RIR of 0 (grinding).
  const lowRecovery = latestRecoveryScore != null && latestRecoveryScore < 40;

  let stalled = false;
  if (previousSets && previousSets.length > 0) {
    const priorReps = totalRepsAtWeight(priorSets, w);
    const prevReps = totalRepsAtWeight(previousSets, w);
    const priorAvg = avgRir(working);
    const prevAvg = avgRir(previousSets.filter((s) => s.completed && s.weight >= w));
    stalled =
      prevReps > 0 &&
      priorReps <= prevReps &&
      priorAvg === 0 &&
      prevAvg === 0;
  }

  if (lowRecovery || stalled) {
    return { rec: "REDUCE", weight: roundIncrement(w * 0.9, weightIncrement) };
  }

  return { rec: "REPEAT", weight: w };
}

/**
 * Deload sessions: weight = round(W × deloadWeightPct); results never feed
 * back into progression.
 */
export function deloadWeight(
  lastWorkingWeight: number,
  deloadWeightPct: number,
  weightIncrement: number
): ProgressionResult {
  return {
    rec: "DELOAD",
    weight: roundIncrement(lastWorkingWeight * deloadWeightPct, weightIncrement),
  };
}
