/**
 * lib/schedule.ts — block/week/phase derivation, deload detection, target
 * resolution (ARCHITECTURE.md §5). Pure functions only; the DB-touching
 * getOrCreateSession / ensureCurrentBlock actions belong to the workout
 * feature team and should build on these.
 */
import { diffDays, type LocalDate } from "@/lib/dates";

export const CYCLE_WEEKS = 13;
export const DELOAD_WEEK = 13;

export interface BlockLike {
  startDate: LocalDate; // always a Monday
}

/**
 * 1-based week within the 13-week cycle. Values > 13 mean the cycle is over
 * (a new TrainingBlock should exist); values < 1 mean the block hasn't started.
 */
export function weekInCycle(block: BlockLike, date: LocalDate): number {
  return Math.floor(diffDays(block.startDate, date) / 7) + 1;
}

/** 1–4 → 1, 5–8 → 2, 9–12 → 3, 13 → 0 (deload). */
export function blockPhase(week: number): number {
  if (week === DELOAD_WEEK) return 0;
  if (week >= 1 && week <= 4) return 1;
  if (week >= 5 && week <= 8) return 2;
  if (week >= 9 && week <= 12) return 3;
  return 0;
}

export function isDeloadWeek(week: number): boolean {
  return week === DELOAD_WEEK;
}

/** True once the 13-week cycle has fully elapsed (next block is due). */
export function isCycleComplete(block: BlockLike, date: LocalDate): boolean {
  return weekInCycle(block, date) > CYCLE_WEEKS;
}

export interface SlotLike {
  baseSets: number;
  repRangeMin: number;
  repRangeMax: number;
  targetRirMin: number;
  targetRirMax: number;
  restSeconds: number;
}

export interface BlockOverrideLike {
  blockNumber: number; // 2 or 3
  addSets: number;
}

export interface ResolvedTargets {
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  restSeconds: number;
}

/**
 * Effective targets for a slot in a given phase. Deload halves sets
 * (ceil(effective/2)); deload weight is handled by the progression engine.
 */
export function resolveTargets(
  slot: SlotLike,
  overrides: BlockOverrideLike[],
  phase: number,
  isDeload: boolean
): ResolvedTargets {
  let sets =
    slot.baseSets +
    overrides
      .filter((o) => o.blockNumber === phase)
      .reduce((sum, o) => sum + o.addSets, 0);
  if (isDeload) sets = Math.ceil(sets / 2);
  return {
    sets,
    repMin: slot.repRangeMin,
    repMax: slot.repRangeMax,
    rirMin: slot.targetRirMin,
    rirMax: slot.targetRirMax,
    restSeconds: slot.restSeconds,
  };
}

/** Days until the deload week starts (0 when already in deload or past it). */
export function deloadCountdownDays(block: BlockLike, today: LocalDate): number {
  const deloadStart = 7 * (DELOAD_WEEK - 1); // days after block start
  const elapsed = diffDays(block.startDate, today);
  return Math.max(0, deloadStart - elapsed);
}

/** "Block 2 · Week 6" data for the sidebar chip / dashboard banner. */
export function blockPosition(block: BlockLike, today: LocalDate): {
  week: number;
  phase: number;
  isDeload: boolean;
  deloadInDays: number;
} {
  const week = weekInCycle(block, today);
  return {
    week,
    phase: blockPhase(week),
    isDeload: isDeloadWeek(week),
    deloadInDays: deloadCountdownDays(block, today),
  };
}
