/**
 * lib/volume.ts — load volume & weekly set counting (ARCHITECTURE.md §5).
 * Pure functions over plain shapes; no Prisma imports.
 */
import type { MuscleGroup } from "@/lib/generated/prisma/enums";

export interface VolumeSet {
  weight: number;
  reps: number;
  completed: boolean;
}

/** Load volume of one set. Bodyweight sets logged at 0 lb contribute 0. */
export function setVolume(set: Pick<VolumeSet, "weight" | "reps">): number {
  return set.weight * set.reps;
}

/** Session volume = sum of completed set volumes. */
export function sessionVolume(sets: VolumeSet[]): number {
  return sets.filter((s) => s.completed).reduce((sum, s) => sum + setVolume(s), 0);
}

export interface MuscleCreditedSet {
  completed: boolean;
  primaryMuscle: MuscleGroup;
  /** Parsed from Exercise.secondaryMuscles JSON. */
  secondaryMuscles: MuscleGroup[];
}

/**
 * Weekly set counts by muscle group: each completed set credits 1.0 to the
 * primary muscle and 0.5 to each secondary ("direct + stimulus" framing).
 */
export function weeklySetsByMuscle(sets: MuscleCreditedSet[]): Record<MuscleGroup, number> {
  const totals = {} as Record<MuscleGroup, number>;
  const add = (m: MuscleGroup, credit: number) => {
    totals[m] = (totals[m] ?? 0) + credit;
  };
  for (const set of sets) {
    if (!set.completed) continue;
    add(set.primaryMuscle, 1);
    for (const m of set.secondaryMuscles) add(m, 0.5);
  }
  return totals;
}

/** Parse Exercise.secondaryMuscles (JSON string column) safely. */
export function parseSecondaryMuscles(json: string): MuscleGroup[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as MuscleGroup[]) : [];
  } catch {
    return [];
  }
}

/** Program v1.0 weekly set targets per muscle (PROGRAM.md). */
export const WEEKLY_SET_TARGETS: Partial<Record<MuscleGroup, number>> = {
  CHEST: 12,
  UPPER_CHEST: 6,
  BACK: 14,
  LATS: 14,
  FRONT_DELTS: 6,
  LATERAL_DELTS: 8,
  REAR_DELTS: 7,
  TRICEPS: 6,
  BICEPS: 6,
  QUADS: 12,
  HAMSTRINGS: 10,
  CALVES: 8,
  CORE: 6,
};
