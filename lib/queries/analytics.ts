/**
 * lib/queries/analytics.ts — server-only read layer for /analytics.
 * Every derived stat computes here; client charts receive plain props.
 */
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { addDays, isoWeekMonday, localToday, parseLocalDate, type LocalDate } from "@/lib/dates";
import { epley } from "@/lib/e1rm";
import { setVolume, parseSecondaryMuscles, WEEKLY_SET_TARGETS } from "@/lib/volume";
import { consistencyPct, type WeekSessions } from "@/lib/streaks";
import type { MuscleGroup } from "@/lib/generated/prisma/enums";

export type AnalyticsRange = "4W" | "12W" | "All";

export const ANALYTICS_RANGES: AnalyticsRange[] = ["4W", "12W", "All"];

export function parseAnalyticsRange(raw: string | undefined): AnalyticsRange {
  return raw === "4W" || raw === "All" ? raw : "12W";
}

const RANGE_DAYS: Record<AnalyticsRange, number | null> = { "4W": 28, "12W": 84, All: null };

/** The big-four lifts charted by name (seeded exercise names). */
export const BIG_FOUR = [
  "Bench Press",
  "Box Squat",
  "Romanian Deadlift",
  "Seated Dumbbell Shoulder Press",
] as const;

export interface E1rmPoint {
  date: LocalDate;
  label: string; // "Jun 29"
  e1rm: number;
  topSet: string; // "185×8"
  isPr: boolean;
}

export interface ExerciseSeries {
  name: string;
  series: E1rmPoint[];
}

/** Muscle groups collapsed into 6 chart regions (6-color palette). */
export const VOLUME_REGIONS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"] as const;
export type VolumeRegion = (typeof VOLUME_REGIONS)[number];

const REGION_OF: Record<MuscleGroup, VolumeRegion> = {
  CHEST: "Chest",
  UPPER_CHEST: "Chest",
  BACK: "Back",
  LATS: "Back",
  FRONT_DELTS: "Shoulders",
  LATERAL_DELTS: "Shoulders",
  REAR_DELTS: "Shoulders",
  TRICEPS: "Arms",
  BICEPS: "Arms",
  FOREARMS: "Arms",
  QUADS: "Legs",
  HAMSTRINGS: "Legs",
  GLUTES: "Legs",
  CALVES: "Legs",
  CORE: "Core",
};

export interface WeeklyRegionRow {
  week: string; // "Jun 29"
  weekStart: LocalDate;
  Chest: number;
  Back: number;
  Shoulders: number;
  Arms: number;
  Legs: number;
  Core: number;
}

export interface MuscleTargetRow {
  muscle: MuscleGroup;
  label: string;
  sets: number; // this week, direct+stimulus credited
  target: number;
}

export type FrequencyState = "done" | "missed" | "rest" | "future";

export interface FrequencyWeek {
  weekStart: LocalDate;
  label: string;
  days: { date: LocalDate; state: FrequencyState }[];
}

/** WHOOP daily trends (read-only context; only rendered when data exists). */
export interface WhoopAnalytics {
  recoveryTrend: { date: LocalDate; label: string; score: number }[];
  hrvTrend: { date: LocalDate; label: string; hrvMs: number }[];
  sleepTrend: { date: LocalDate; label: string; hours: number; performancePct: number | null }[];
  strainTrend: { date: LocalDate; label: string; strain: number }[];
  hasData: boolean;
}

export interface AnalyticsData {
  range: AnalyticsRange;
  hasSessions: boolean;
  bigFour: ExerciseSeries[];
  /** All exercises with at least one completed set in range (for the explorer). */
  allSeries: ExerciseSeries[];
  weeklyRegionVolume: WeeklyRegionRow[];
  weeklyTargetTotal: number;
  currentWeekMuscles: MuscleTargetRow[];
  frequency: FrequencyWeek[];
  stats: {
    consistencyPct: number | null;
    avgRir: number | null;
    sessionsPerWeek: number | null;
    completedSessions: number;
  };
  rirTrend: { week: string; avgRir: number }[];
  recoveryPerformance: { week: string; recovery: number | null; volume: number }[];
  bodyWeight: { date: LocalDate; label: string; weight: number; ma: number | null }[];
  whoop: WhoopAnalytics;
}

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  CHEST: "Chest",
  UPPER_CHEST: "Upper chest",
  BACK: "Back",
  LATS: "Lats",
  FRONT_DELTS: "Front delts",
  LATERAL_DELTS: "Lateral delts",
  REAR_DELTS: "Rear delts",
  TRICEPS: "Triceps",
  BICEPS: "Biceps",
  FOREARMS: "Forearms",
  QUADS: "Quads",
  HAMSTRINGS: "Hamstrings",
  GLUTES: "Glutes",
  CALVES: "Calves",
  CORE: "Core",
};

function shortDate(date: LocalDate): string {
  return parseLocalDate(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Program training days (ISO): Mon, Tue, Thu, Fri. */
const TRAINING_DOWS = new Set([1, 2, 4, 5]);

export async function getAnalyticsData(range: AnalyticsRange): Promise<AnalyticsData> {
  const userId = await requireUserId();
  const today = localToday();
  const days = RANGE_DAYS[range];
  const cutoff = days == null ? null : addDays(today, -days);

  const rangeFilter = cutoff ? { date: { gte: cutoff, lte: today } } : { date: { lte: today } };

  const [sessions, prRows, measurements, recoveryLogs, firstBlock, whoopRecoveries, whoopSleeps, whoopCycles] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, date: { lte: today, ...(cutoff ? { gte: cutoff } : {}) } },
      orderBy: { date: "asc" },
      include: {
        exercises: {
          include: { exercise: true, sets: true },
        },
      },
    }),
    prisma.personalRecord.findMany({
      where: { userId, type: "BEST_E1RM" },
      select: { exerciseId: true, date: true },
    }),
    prisma.bodyMeasurement.findMany({
      where: { userId, weight: { not: null }, ...(cutoff ? { date: { gte: cutoff, lte: today } } : { date: { lte: today } }) },
      orderBy: { date: "asc" },
      select: { date: true, weight: true },
    }),
    prisma.recoveryLog.findMany({
      where: { userId, score: { not: null }, ...(cutoff ? { date: { gte: cutoff, lte: today } } : { date: { lte: today } }) },
      select: { date: true, score: true },
    }),
    prisma.trainingBlock.findFirst({ where: { userId }, orderBy: { startDate: "asc" }, select: { startDate: true } }),
    prisma.whoopRecovery.findMany({
      where: { userId, ...rangeFilter },
      orderBy: { date: "asc" },
      select: { date: true, recoveryScore: true, hrvRmssdMilli: true },
    }),
    prisma.whoopSleep.findMany({
      where: { userId, isNap: false, ...rangeFilter },
      orderBy: { date: "asc" },
      select: { date: true, inBedMilli: true, awakeMilli: true, performancePct: true },
    }),
    prisma.whoopCycle.findMany({
      where: { userId, strain: { not: null }, ...rangeFilter },
      orderBy: { date: "asc" },
      select: { date: true, strain: true },
    }),
  ]);

  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const prDates = new Set(prRows.map((r) => `${r.exerciseId}:${r.date}`));

  // ---------- e1RM series per exercise ----------
  // Per exercise per session date: best epley across completed working sets.
  const seriesByExercise = new Map<string, E1rmPoint[]>();
  for (const session of completed) {
    if (session.isDeload) continue; // deload results never feed progression/PR charts
    for (const se of session.exercises) {
      let best: { e1rm: number; weight: number; reps: number } | null = null;
      for (const set of se.sets) {
        if (!set.completed || set.weight <= 0 || set.reps <= 0) continue;
        const v = epley(set.weight, set.reps);
        if (!best || v > best.e1rm) best = { e1rm: v, weight: set.weight, reps: set.reps };
      }
      if (!best) continue;
      const arr = seriesByExercise.get(se.exercise.name) ?? [];
      arr.push({
        date: session.date,
        label: shortDate(session.date),
        e1rm: Math.round(best.e1rm),
        topSet: `${best.weight % 1 === 0 ? best.weight : best.weight.toFixed(1)}×${best.reps}`,
        isPr: prDates.has(`${se.exerciseId}:${session.date}`),
      });
      seriesByExercise.set(se.exercise.name, arr);
    }
  }
  // A session can hit the same exercise once only per template, but be safe: sort + dedupe by date (keep max).
  for (const [name, arr] of seriesByExercise) {
    const byDate = new Map<string, E1rmPoint>();
    for (const p of arr) {
      const prev = byDate.get(p.date);
      if (!prev || p.e1rm > prev.e1rm) byDate.set(p.date, { ...p, isPr: p.isPr || (prev?.isPr ?? false) });
    }
    seriesByExercise.set(
      name,
      [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
    );
  }

  const bigFour: ExerciseSeries[] = BIG_FOUR.map((name) => ({
    name,
    series: seriesByExercise.get(name) ?? [],
  }));
  const allSeries: ExerciseSeries[] = [...seriesByExercise.entries()]
    .map(([name, series]) => ({ name, series }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ---------- weekly buckets ----------
  // Never reach back before the program started (or the first logged session).
  const programStart = firstBlock?.startDate ?? sessions[0]?.date ?? today;
  const firstDate = cutoff && cutoff > programStart ? cutoff : programStart;
  const firstMonday = isoWeekMonday(firstDate);
  const currentMonday = isoWeekMonday(today);
  const weekStarts: LocalDate[] = [];
  for (let w = firstMonday; w <= currentMonday; w = addDays(w, 7)) weekStarts.push(w);

  const sessionsByWeek = new Map<LocalDate, typeof sessions>();
  for (const s of sessions) {
    const w = isoWeekMonday(s.date);
    const arr = sessionsByWeek.get(w) ?? [];
    arr.push(s);
    sessionsByWeek.set(w, arr);
  }

  // ---------- weekly volume by muscle region (set counts, stacked) ----------
  const weeklyRegionVolume: WeeklyRegionRow[] = weekStarts.map((weekStart) => {
    const row: WeeklyRegionRow = {
      week: shortDate(weekStart),
      weekStart,
      Chest: 0,
      Back: 0,
      Shoulders: 0,
      Arms: 0,
      Legs: 0,
      Core: 0,
    };
    for (const session of sessionsByWeek.get(weekStart) ?? []) {
      if (session.status !== "COMPLETED") continue;
      for (const se of session.exercises) {
        const secondary = parseSecondaryMuscles(se.exercise.secondaryMuscles);
        for (const set of se.sets) {
          if (!set.completed) continue;
          row[REGION_OF[se.exercise.primaryMuscle]] += 1;
          for (const m of secondary) row[REGION_OF[m]] += 0.5;
        }
      }
    }
    for (const region of VOLUME_REGIONS) row[region] = Math.round(row[region] * 2) / 2;
    return row;
  });
  const weeklyTargetTotal = Object.values(WEEKLY_SET_TARGETS).reduce((a, b) => a + (b ?? 0), 0);

  // ---------- this week: per-muscle sets vs target ----------
  const thisWeekTotals = {} as Record<MuscleGroup, number>;
  for (const session of sessionsByWeek.get(currentMonday) ?? []) {
    if (session.status !== "COMPLETED") continue;
    for (const se of session.exercises) {
      const secondary = parseSecondaryMuscles(se.exercise.secondaryMuscles);
      for (const set of se.sets) {
        if (!set.completed) continue;
        thisWeekTotals[se.exercise.primaryMuscle] =
          (thisWeekTotals[se.exercise.primaryMuscle] ?? 0) + 1;
        for (const m of secondary) thisWeekTotals[m] = (thisWeekTotals[m] ?? 0) + 0.5;
      }
    }
  }
  const currentWeekMuscles: MuscleTargetRow[] = (
    Object.entries(WEEKLY_SET_TARGETS) as [MuscleGroup, number][]
  ).map(([muscle, target]) => ({
    muscle,
    label: MUSCLE_LABELS[muscle],
    sets: Math.round((thisWeekTotals[muscle] ?? 0) * 2) / 2,
    target,
  }));

  // ---------- frequency heat strip + consistency ----------
  const completedDates = new Set(completed.map((s) => s.date));
  const frequency: FrequencyWeek[] = weekStarts.slice(-13).map((weekStart) => ({
    weekStart,
    label: shortDate(weekStart),
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const dow = i + 1;
      let state: FrequencyState;
      if (completedDates.has(date)) state = "done";
      else if (!TRAINING_DOWS.has(dow)) state = "rest";
      else if (date > today) state = "future";
      else if (date === today) state = "future"; // today's session may still happen
      else state = "missed";
      return { date, state };
    }),
  }));

  // Consistency across elapsed scheduled sessions (partial current week counts elapsed days only).
  const weeksForConsistency: WeekSessions[] = weekStarts.map((weekStart) => {
    let scheduled = 0;
    for (const dow of TRAINING_DOWS) {
      const date = addDays(weekStart, dow - 1);
      if (date < today || completedDates.has(date)) scheduled += 1;
    }
    return {
      weekStart,
      scheduledCount: scheduled,
      sessions: (sessionsByWeek.get(weekStart) ?? []).map((s) => ({ status: s.status })),
    };
  });
  const totalScheduled = weeksForConsistency.reduce((a, w) => a + (w.scheduledCount ?? 0), 0);
  const consistency = totalScheduled > 0 ? consistencyPct(weeksForConsistency) : null;

  // ---------- avg RIR ----------
  let rirSum = 0;
  let rirCount = 0;
  const rirTrend: { week: string; avgRir: number }[] = [];
  for (const weekStart of weekStarts) {
    let wSum = 0;
    let wCount = 0;
    for (const session of sessionsByWeek.get(weekStart) ?? []) {
      for (const se of session.exercises) {
        for (const set of se.sets) {
          if (!set.completed || set.rir == null) continue;
          wSum += set.rir;
          wCount += 1;
        }
      }
    }
    if (wCount > 0) {
      rirTrend.push({ week: shortDate(weekStart), avgRir: Math.round((wSum / wCount) * 10) / 10 });
      rirSum += wSum;
      rirCount += wCount;
    }
  }

  // ---------- recovery vs performance (weekly) ----------
  const recoveryByWeek = new Map<LocalDate, number[]>();
  for (const log of recoveryLogs) {
    const w = isoWeekMonday(log.date);
    const arr = recoveryByWeek.get(w) ?? [];
    arr.push(log.score as number);
    recoveryByWeek.set(w, arr);
  }
  const recoveryPerformance = weekStarts.map((weekStart) => {
    const scores = recoveryByWeek.get(weekStart);
    let volume = 0;
    for (const session of sessionsByWeek.get(weekStart) ?? []) {
      if (session.status !== "COMPLETED") continue;
      volume +=
        session.totalVolume > 0
          ? session.totalVolume
          : session.exercises.reduce(
              (a, se) =>
                a + se.sets.filter((s) => s.completed).reduce((v, s) => v + setVolume(s), 0),
              0
            );
    }
    return {
      week: shortDate(weekStart),
      recovery: scores?.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
      volume: Math.round(volume),
    };
  });

  // ---------- body-weight trend + 7-day moving average ----------
  const bw = measurements.filter((m) => m.weight != null);
  const bodyWeight = bw.map((m, i) => {
    // MA over entries within the prior 7 days (inclusive).
    const windowStart = addDays(m.date, -6);
    const window = bw.filter((x) => x.date >= windowStart && x.date <= m.date);
    const ma =
      window.length >= 2
        ? Math.round((window.reduce((a, x) => a + (x.weight as number), 0) / window.length) * 10) /
          10
        : i === 0
          ? null
          : null;
    return { date: m.date, label: shortDate(m.date), weight: m.weight as number, ma };
  });

  // ---------- WHOOP daily trends ----------
  const recoveryTrend = whoopRecoveries
    .filter((r) => r.recoveryScore != null)
    .map((r) => ({ date: r.date, label: shortDate(r.date), score: r.recoveryScore as number }));
  const hrvTrend = whoopRecoveries
    .filter((r) => r.hrvRmssdMilli != null)
    .map((r) => ({
      date: r.date,
      label: shortDate(r.date),
      hrvMs: Math.round((r.hrvRmssdMilli as number) * 10) / 10,
    }));
  const sleepTrend = whoopSleeps
    .filter((s) => s.inBedMilli != null)
    .map((s) => ({
      date: s.date,
      label: shortDate(s.date),
      hours: Math.round((((s.inBedMilli as number) - (s.awakeMilli ?? 0)) / 3600000) * 10) / 10,
      performancePct: s.performancePct != null ? Math.round(s.performancePct) : null,
    }));
  const strainTrend = whoopCycles.map((c) => ({
    date: c.date,
    label: shortDate(c.date),
    strain: Math.round((c.strain as number) * 10) / 10,
  }));
  const whoop: WhoopAnalytics = {
    recoveryTrend,
    hrvTrend,
    sleepTrend,
    strainTrend,
    hasData:
      recoveryTrend.length > 0 ||
      hrvTrend.length > 0 ||
      sleepTrend.length > 0 ||
      strainTrend.length > 0,
  };

  const elapsedWeeks = weekStarts.filter((w) => w < currentMonday).length;

  return {
    range,
    hasSessions: completed.length > 0,
    bigFour,
    allSeries,
    weeklyRegionVolume,
    weeklyTargetTotal,
    currentWeekMuscles,
    frequency,
    stats: {
      consistencyPct: consistency == null ? null : Math.round(consistency),
      avgRir: rirCount > 0 ? Math.round((rirSum / rirCount) * 10) / 10 : null,
      sessionsPerWeek:
        elapsedWeeks > 0
          ? Math.round(
              (completed.filter((s) => isoWeekMonday(s.date) < currentMonday).length /
                elapsedWeeks) *
                10
            ) / 10
          : null,
      completedSessions: completed.length,
    },
    rirTrend,
    recoveryPerformance,
    bodyWeight,
    whoop,
  };
}
