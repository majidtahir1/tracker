/**
 * lib/queries/effective-recovery.ts — server-only effective recovery score.
 * For any date the EFFECTIVE score is the WHOOP recovery (scoreState SCORED,
 * not calibrating) when present, else the manual RecoveryLog score. Band
 * thresholds are unchanged (lib/recovery.ts). Progression, fatigue warnings,
 * and both AI coaches consume this; the UI badges the source.
 */
import { prisma } from "@/lib/db";
import { addDays, type LocalDate } from "@/lib/dates";
import { recoveryBand, type RecoveryBand } from "@/lib/recovery";
import type { CoachWhoopContext } from "@/lib/ai/set-coach-types";
import type { WhoopSleep } from "@/lib/generated/prisma/client";

export type RecoverySource = "whoop" | "manual";

export interface EffectiveRecovery {
  date: string;
  score: number | null;
  band: RecoveryBand | null;
  source: RecoverySource | null;
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

/** WHOOP recovery rows that count toward the effective score. */
const usableWhoopRecovery = {
  scoreState: "SCORED",
  userCalibrating: false,
  recoveryScore: { not: null },
} as const;

type WhoopRecoveryRow = NonNullable<Awaited<ReturnType<typeof prisma.whoopRecovery.findFirst>>>;

/**
 * The newest cycle's recovery, falling back one cycle while the current one
 * is unscored. Cycle-keyed rather than date-keyed: cycle dates are bucketed
 * by machine-local start day, so a cycle starting near midnight lands on
 * "yesterday" in some timezones and date == today lookups miss it.
 */
async function latestCycleRecovery(
  userId: string,
  filter: Partial<typeof usableWhoopRecovery> = usableWhoopRecovery,
): Promise<{ recovery: WhoopRecoveryRow; isCurrentCycle: boolean } | null> {
  const cycles = await prisma.whoopCycle.findMany({
    where: { userId },
    orderBy: { start: "desc" },
    take: 2,
    select: { id: true },
  });
  if (cycles.length === 0) return null;
  const recoveries = await prisma.whoopRecovery.findMany({
    where: { userId, cycleId: { in: cycles.map((c) => c.id) }, ...filter },
  });
  const byCycle = new Map(recoveries.map((r) => [r.cycleId, r]));
  for (let i = 0; i < cycles.length; i++) {
    const recovery = byCycle.get(cycles[i].id);
    if (recovery) return { recovery, isCurrentCycle: i === 0 };
  }
  return null;
}

/** Effective recovery for one date: WHOOP first, else the manual log. */
export async function getEffectiveRecovery(userId: string, date: LocalDate): Promise<EffectiveRecovery> {
  const [whoop, manual] = await Promise.all([
    prisma.whoopRecovery.findFirst({
      where: { userId, date, ...usableWhoopRecovery },
      select: { recoveryScore: true },
    }),
    prisma.recoveryLog.findFirst({ where: { userId, date }, select: { score: true } }),
  ]);
  if (whoop?.recoveryScore != null) {
    return { date, score: whoop.recoveryScore, band: recoveryBand(whoop.recoveryScore), source: "whoop" };
  }
  if (manual?.score != null) {
    return { date, score: manual.score, band: recoveryBand(manual.score), source: "manual" };
  }
  return { date, score: null, band: null, source: null };
}

/**
 * Most recent effective score from either source. The WHOOP side is the
 * newest cycle's recovery (see latestCycleRecovery), falling back to the
 * newest date ≤ today for sparse/stale data. WHOOP wins ties with manual;
 * the current cycle's recovery counts as today regardless of its date
 * bucket, so a manual log never shadows a live WHOOP score.
 */
export async function getLatestEffectiveRecovery(
  userId: string,
  today: LocalDate
): Promise<EffectiveRecovery & { isToday: boolean }> {
  const [cycleRecovery, whoopByDate, manual] = await Promise.all([
    latestCycleRecovery(userId),
    prisma.whoopRecovery.findFirst({
      where: { userId, date: { lte: today }, ...usableWhoopRecovery },
      orderBy: { date: "desc" },
      select: { date: true, recoveryScore: true },
    }),
    prisma.recoveryLog.findFirst({
      where: { userId, date: { lte: today }, score: { not: null } },
      orderBy: { date: "desc" },
      select: { date: true, score: true },
    }),
  ]);

  const whoop = cycleRecovery
    ? { date: cycleRecovery.recovery.date, recoveryScore: cycleRecovery.recovery.recoveryScore }
    : whoopByDate;
  // The current cycle counts as "today" even when its start-day bucket says
  // yesterday — but only when it is actually recent, so a stale sync never
  // shadows a fresh manual check-in.
  const whoopIsToday =
    (cycleRecovery?.isCurrentCycle === true && cycleRecovery.recovery.date >= addDays(today, -1)) ||
    whoop?.date === today;
  const useWhoop =
    whoop?.recoveryScore != null &&
    (manual?.score == null || whoopIsToday || whoop.date >= manual.date);
  if (useWhoop && whoop) {
    const score = whoop.recoveryScore as number;
    return { date: whoop.date, score, band: recoveryBand(score), source: "whoop", isToday: whoopIsToday };
  }
  if (manual?.score != null) {
    return { date: manual.date, score: manual.score, band: recoveryBand(manual.score), source: "manual", isToday: manual.date === today };
  }
  return { date: today, score: null, band: null, source: null, isToday: false };
}

// ---------------------------------------------------------------- AI context

export interface WhoopDayContext {
  recovery: { score: number | null; hrvMs: number | null; restingHr: number | null; calibrating: boolean } | null;
  /** Latest non-nap sleep waking today, else yesterday's wake. */
  sleep: { hours: number | null; performancePct: number | null; debtHours: number | null } | null;
  yesterdayStrain: number | null;
  /** WHOOP-detected activities over the last 2 days (max 5, newest first). */
  recentWorkouts: Array<{ sportName: string; date: LocalDate; strain: number | null; durationMin: number }>;
}

/** Time asleep in hours (1 dp): staged sleep when present, else in-bed minus awake. */
export function whoopSleepHours(sleep: Pick<WhoopSleep, "lightSleepMilli" | "slowWaveSleepMilli" | "remSleepMilli" | "inBedMilli" | "awakeMilli">): number | null {
  const staged = (sleep.lightSleepMilli ?? 0) + (sleep.slowWaveSleepMilli ?? 0) + (sleep.remSleepMilli ?? 0);
  const asleep =
    staged > 0
      ? staged
      : sleep.inBedMilli != null
        ? sleep.inBedMilli - (sleep.awakeMilli ?? 0)
        : null;
  return asleep != null && asleep > 0 ? round1(asleep / 3_600_000) : null;
}

/** Flatten a WhoopDayContext into the coach-prompt block; null when no data. */
export function toCoachWhoopContext(ctx: WhoopDayContext): CoachWhoopContext | null {
  if (!ctx.recovery && !ctx.sleep && ctx.yesterdayStrain == null && ctx.recentWorkouts.length === 0) {
    return null;
  }
  return {
    recoveryScore: ctx.recovery?.score ?? null,
    hrvMs: ctx.recovery?.hrvMs ?? null,
    restingHr: ctx.recovery?.restingHr ?? null,
    sleepHours: ctx.sleep?.hours ?? null,
    sleepPerformancePct: ctx.sleep?.performancePct ?? null,
    sleepDebtHours: ctx.sleep?.debtHours ?? null,
    yesterdayStrain: ctx.yesterdayStrain,
    recentWorkouts: ctx.recentWorkouts.map((w) => ({
      sportName: w.sportName,
      strain: w.strain,
      durationMin: w.durationMin,
    })),
  };
}

/** One-call WHOOP context bundle for the AI coaches (structured numbers only). */
export async function getWhoopDayContext(userId: string, today: LocalDate): Promise<WhoopDayContext> {
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);

  const [cycleRecovery, sleepRow, yesterdayCycle, workouts] = await Promise.all([
    latestCycleRecovery(userId, { scoreState: "SCORED" }),
    prisma.whoopSleep.findFirst({
      where: { userId, date: { in: [today, yesterday] }, isNap: false },
      orderBy: { end: "desc" },
    }),
    prisma.whoopCycle.findFirst({
      where: { userId, date: yesterday, strain: { not: null } },
      orderBy: { start: "desc" },
      select: { strain: true },
    }),
    prisma.whoopWorkout.findMany({
      where: { userId, date: { gte: twoDaysAgo, lte: today } },
      orderBy: { start: "desc" },
      take: 5,
    }),
  ]);

  const recoveryRow = cycleRecovery?.recovery ?? null;
  return {
    recovery: recoveryRow
      ? {
          score: recoveryRow.recoveryScore,
          hrvMs: recoveryRow.hrvRmssdMilli != null ? round1(recoveryRow.hrvRmssdMilli) : null,
          restingHr: recoveryRow.restingHeartRate != null ? Math.round(recoveryRow.restingHeartRate) : null,
          calibrating: recoveryRow.userCalibrating,
        }
      : null,
    sleep: sleepRow
      ? {
          hours: whoopSleepHours(sleepRow),
          performancePct: sleepRow.performancePct != null ? Math.round(sleepRow.performancePct) : null,
          debtHours: sleepRow.sleepDebtMilli != null ? round1(sleepRow.sleepDebtMilli / 3_600_000) : null,
        }
      : null,
    yesterdayStrain: yesterdayCycle?.strain != null ? round1(yesterdayCycle.strain) : null,
    recentWorkouts: workouts.map((w) => ({
      sportName: w.sportName,
      date: w.date,
      strain: w.strain != null ? round1(w.strain) : null,
      durationMin: Math.round((w.end.getTime() - w.start.getTime()) / 60_000),
    })),
  };
}
