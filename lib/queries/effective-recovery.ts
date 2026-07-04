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
 * Most recent date ≤ today with an effective score from either source.
 * WHOOP wins when both sources land on the same date.
 */
export async function getLatestEffectiveRecovery(
  userId: string,
  today: LocalDate
): Promise<EffectiveRecovery & { isToday: boolean }> {
  const [whoop, manual] = await Promise.all([
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

  const useWhoop =
    whoop?.recoveryScore != null && (manual?.score == null || whoop.date >= manual.date);
  if (useWhoop && whoop) {
    const score = whoop.recoveryScore as number;
    return { date: whoop.date, score, band: recoveryBand(score), source: "whoop", isToday: whoop.date === today };
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

  const [recoveryRow, sleepRow, yesterdayCycle, workouts] = await Promise.all([
    prisma.whoopRecovery.findFirst({ where: { userId, date: today, scoreState: "SCORED" } }),
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
