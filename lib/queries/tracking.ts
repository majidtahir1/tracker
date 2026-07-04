/**
 * lib/queries/tracking.ts — server-only read layer for body tracking:
 * measurements, photos, nutrition, recovery. Pages receive plain
 * serializable props shaped here (ARCHITECTURE.md §5).
 */
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { addDays, type LocalDate } from "@/lib/dates";
import { type RecoveryBand } from "@/lib/recovery";
import {
  getLatestEffectiveRecovery,
  whoopSleepHours,
  type RecoverySource,
} from "@/lib/queries/effective-recovery";
import type { BodyMeasurement } from "@/lib/generated/prisma/client";

// ---------------------------------------------------------------- helpers

/** Average of the sides that are present (single side ok), else null. */
function pairAvg(a: number | null, b: number | null): number | null {
  if (a != null && b != null) return (a + b) / 2;
  return a ?? b;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// ---------------------------------------------------------------- measurements

export interface MetricPoint {
  date: LocalDate;
  value: number;
}

/** Which direction is a "win" for this metric (null = neutral). */
export type GoodDirection = "up" | "down" | null;

export interface MeasurementMetric {
  key: string;
  label: string;
  unit: string;
  goodDirection: GoodDirection;
  /** 1 decimal for girths/weight/bf. */
  current: number | null;
  /** current − previous entry that had this metric. */
  delta: number | null;
  points: MetricPoint[];
}

export interface MeasurementHistoryRow {
  date: LocalDate;
  weight: number | null;
  bodyFat: number | null;
  waist: number | null;
  chest: number | null;
  shoulders: number | null;
  arms: number | null;
  thighs: number | null;
}

export interface MeasurementsData {
  metrics: MeasurementMetric[];
  history: MeasurementHistoryRow[];
  entryCount: number;
  latestDate: LocalDate | null;
  /** Latest row values keyed by form field name — prefills the entry form. */
  latest: Record<string, number | null> | null;
}

const METRIC_DEFS: Array<{
  key: string;
  label: string;
  unit: string;
  goodDirection: GoodDirection;
  get: (r: BodyMeasurement) => number | null;
}> = [
  { key: "weight", label: "Body Weight", unit: "lb", goodDirection: null, get: (r) => r.weight },
  { key: "bodyFat", label: "Body Fat", unit: "%", goodDirection: "down", get: (r) => r.bodyFat },
  { key: "waist", label: "Waist", unit: "in", goodDirection: "down", get: (r) => r.waist },
  { key: "chest", label: "Chest", unit: "in", goodDirection: "up", get: (r) => r.chest },
  { key: "shoulders", label: "Shoulders", unit: "in", goodDirection: "up", get: (r) => r.shoulders },
  { key: "arms", label: "Arms", unit: "in", goodDirection: "up", get: (r) => pairAvg(r.leftArm, r.rightArm) },
  { key: "forearms", label: "Forearms", unit: "in", goodDirection: "up", get: (r) => pairAvg(r.leftForearm, r.rightForearm) },
  { key: "thighs", label: "Thighs", unit: "in", goodDirection: "up", get: (r) => pairAvg(r.leftThigh, r.rightThigh) },
  { key: "calves", label: "Calves", unit: "in", goodDirection: "up", get: (r) => pairAvg(r.leftCalf, r.rightCalf) },
  { key: "neck", label: "Neck", unit: "in", goodDirection: null, get: (r) => r.neck },
];

export async function getMeasurementsData(): Promise<MeasurementsData> {
  const userId = await requireUserId();
  const rows = await prisma.bodyMeasurement.findMany({ where: { userId }, orderBy: { date: "asc" } });

  const metrics: MeasurementMetric[] = METRIC_DEFS.map((def) => {
    const points: MetricPoint[] = [];
    for (const r of rows) {
      const v = def.get(r);
      if (v != null) points.push({ date: r.date, value: Math.round(v * 10) / 10 });
    }
    const current = points.length > 0 ? points[points.length - 1].value : null;
    const prev = points.length > 1 ? points[points.length - 2].value : null;
    const delta =
      current != null && prev != null ? Math.round((current - prev) * 10) / 10 : null;
    return { key: def.key, label: def.label, unit: def.unit, goodDirection: def.goodDirection, current, delta, points };
  });

  const history: MeasurementHistoryRow[] = [...rows]
    .reverse()
    .slice(0, 12)
    .map((r) => ({
      date: r.date,
      weight: r.weight,
      bodyFat: r.bodyFat,
      waist: r.waist,
      chest: r.chest,
      shoulders: r.shoulders,
      arms: pairAvg(r.leftArm, r.rightArm),
      thighs: pairAvg(r.leftThigh, r.rightThigh),
    }));

  const latestRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const latest = latestRow
    ? {
        weight: latestRow.weight,
        bodyFat: latestRow.bodyFat,
        waist: latestRow.waist,
        chest: latestRow.chest,
        shoulders: latestRow.shoulders,
        leftArm: latestRow.leftArm,
        rightArm: latestRow.rightArm,
        leftForearm: latestRow.leftForearm,
        rightForearm: latestRow.rightForearm,
        leftThigh: latestRow.leftThigh,
        rightThigh: latestRow.rightThigh,
        leftCalf: latestRow.leftCalf,
        rightCalf: latestRow.rightCalf,
        neck: latestRow.neck,
      }
    : null;

  return {
    metrics,
    history,
    entryCount: rows.length,
    latestDate: latestRow?.date ?? null,
    latest,
  };
}

// ---------------------------------------------------------------- photos

export type PhotoAngleKey = "FRONT" | "SIDE" | "BACK";

export interface PhotoItem {
  id: string;
  angle: PhotoAngleKey;
  filePath: string;
}

export interface PhotoEntry {
  date: LocalDate;
  weight: number | null;
  bodyFat: number | null;
  notes: string | null;
  photos: Partial<Record<PhotoAngleKey, PhotoItem>>;
}

export interface PhotoMonthGroup {
  monthKey: string; // "2026-07"
  label: string; // "July 2026"
  entries: PhotoEntry[];
}

export async function getPhotosData(): Promise<{ groups: PhotoMonthGroup[]; totalPhotos: number }> {
  const userId = await requireUserId();
  const rows = await prisma.progressPhoto.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { angle: "asc" }],
  });

  const byDate = new Map<string, PhotoEntry>();
  for (const r of rows) {
    let entry = byDate.get(r.date);
    if (!entry) {
      entry = { date: r.date, weight: null, bodyFat: null, notes: null, photos: {} };
      byDate.set(r.date, entry);
    }
    entry.photos[r.angle as PhotoAngleKey] = { id: r.id, angle: r.angle as PhotoAngleKey, filePath: r.filePath };
    entry.weight = entry.weight ?? r.weight;
    entry.bodyFat = entry.bodyFat ?? r.bodyFat;
    entry.notes = entry.notes ?? r.notes;
  }

  const groups: PhotoMonthGroup[] = [];
  for (const entry of byDate.values()) {
    const mk = entry.date.slice(0, 7);
    let group = groups.find((g) => g.monthKey === mk);
    if (!group) {
      const [y, m] = mk.split("-").map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      group = { monthKey: mk, label, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }

  return { groups, totalPhotos: rows.length };
}

// ---------------------------------------------------------------- nutrition

export interface NutritionDay {
  date: LocalDate;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  waterOz: number | null;
  logged: boolean;
}

export interface NutritionAverages {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  waterOz: number | null;
  daysLogged: number;
}

export interface NutritionTrendPoint {
  date: LocalDate;
  calories: number | null;
  protein: number | null;
}

export interface NutritionData {
  today: NutritionDay;
  /** Last 7 calendar days, today first. */
  week: NutritionDay[];
  weekAvg: NutritionAverages;
  trend: NutritionTrendPoint[]; // last 30 days, oldest first, logged days only
  proteinTargetG: number;
  calorieTarget: number;
  totalLogged: number;
}

export async function getNutritionData(today: LocalDate): Promise<NutritionData> {
  const userId = await requireUserId();
  const [settings, logs, totalLogged] = await Promise.all([
    prisma.appSettings.findUnique({ where: { userId } }),
    prisma.nutritionLog.findMany({
      where: { userId, date: { gte: addDays(today, -29), lte: today } },
      orderBy: { date: "asc" },
    }),
    prisma.nutritionLog.count({ where: { userId } }),
  ]);

  const byDate = new Map(logs.map((l) => [l.date, l]));

  const day = (date: LocalDate): NutritionDay => {
    const l = byDate.get(date);
    return {
      date,
      calories: l?.calories ?? null,
      protein: l?.protein ?? null,
      carbs: l?.carbs ?? null,
      fat: l?.fat ?? null,
      fiber: l?.fiber ?? null,
      waterOz: l?.waterOz ?? null,
      logged: l != null,
    };
  };

  const week: NutritionDay[] = [];
  for (let i = 0; i < 7; i++) week.push(day(addDays(today, -i)));

  const weekLogged = week.filter((d) => d.logged);
  const field = (k: "calories" | "protein" | "carbs" | "fat" | "fiber" | "waterOz") => {
    const vals = weekLogged.map((d) => d[k]).filter((v): v is number => v != null);
    const a = avg(vals);
    return a == null ? null : Math.round(a);
  };
  const weekAvg: NutritionAverages = {
    calories: field("calories"),
    protein: field("protein"),
    carbs: field("carbs"),
    fat: field("fat"),
    fiber: field("fiber"),
    waterOz: field("waterOz"),
    daysLogged: weekLogged.length,
  };

  const trend: NutritionTrendPoint[] = logs.map((l) => ({
    date: l.date,
    calories: l.calories,
    protein: l.protein,
  }));

  return {
    today: day(today),
    week,
    weekAvg,
    trend,
    proteinTargetG: settings?.proteinTargetG ?? 180,
    calorieTarget: settings?.calorieTarget ?? 2800,
    totalLogged,
  };
}

// ---------------------------------------------------------------- recovery

export interface RecoveryTrendPoint {
  date: LocalDate; // "07-01" style label added client-side
  /** Effective score for the day: WHOOP when synced, else manual. */
  score: number | null;
  source: RecoverySource | null;
}

/** Today's WHOOP snapshot for the recovery page (null when nothing synced today). */
export interface WhoopTodaySnapshot {
  score: number | null;
  hrvMs: number | null;
  restingHr: number | null;
  calibrating: boolean;
  sleepHours: number | null;
  sleepPerformancePct: number | null;
  dayStrain: number | null;
}

export interface RecoveryTodayValues {
  sleepHours: number | null;
  sleepQuality: number | null;
  stress: number | null;
  energy: number | null;
  motivation: number | null;
  workoutDifficulty: number | null;
  soreness: number | null;
  notes: string | null;
}

export interface RecoveryData {
  /** Manual log values only — the entry form prefill stays manual. */
  today: RecoveryTodayValues | null;
  todayScore: number | null;
  /** Most recent EFFECTIVE score (WHOOP or manual) + its band, for the banner. */
  latestScore: number | null;
  latestScoreDate: LocalDate | null;
  latestBand: RecoveryBand | null;
  latestSource: RecoverySource | null;
  /** Last 14 calendar days, oldest first, effective score per day. */
  trend: RecoveryTrendPoint[];
  whoopToday: WhoopTodaySnapshot | null;
  totalLogged: number;
}

export async function getRecoveryData(today: LocalDate): Promise<RecoveryData> {
  const userId = await requireUserId();
  const windowStart = addDays(today, -13);
  const [logs, whoopWindow, whoopTodayRow, sleepToday, cycleToday, totalLogged, latest] =
    await Promise.all([
      prisma.recoveryLog.findMany({
        where: { userId, date: { gte: windowStart, lte: today } },
        orderBy: { date: "asc" },
      }),
      prisma.whoopRecovery.findMany({
        where: {
          userId,
          date: { gte: windowStart, lte: today },
          scoreState: "SCORED",
          userCalibrating: false,
          recoveryScore: { not: null },
        },
        select: { date: true, recoveryScore: true },
      }),
      prisma.whoopRecovery.findFirst({ where: { userId, date: today } }),
      prisma.whoopSleep.findFirst({ where: { userId, date: today, isNap: false }, orderBy: { end: "desc" } }),
      prisma.whoopCycle.findFirst({ where: { userId, date: today }, orderBy: { start: "desc" } }),
      prisma.recoveryLog.count({ where: { userId } }),
      getLatestEffectiveRecovery(userId, today),
    ]);

  const byDate = new Map(logs.map((l) => [l.date, l]));
  const whoopByDate = new Map(whoopWindow.map((w) => [w.date, w.recoveryScore as number]));
  const trend: RecoveryTrendPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    const whoopScore = whoopByDate.get(date);
    const manualScore = byDate.get(date)?.score ?? null;
    if (whoopScore != null) trend.push({ date, score: whoopScore, source: "whoop" });
    else trend.push({ date, score: manualScore, source: manualScore != null ? "manual" : null });
  }

  const whoopToday: WhoopTodaySnapshot | null =
    whoopTodayRow || sleepToday || cycleToday
      ? {
          score: whoopTodayRow?.recoveryScore ?? null,
          hrvMs:
            whoopTodayRow?.hrvRmssdMilli != null
              ? Math.round(whoopTodayRow.hrvRmssdMilli * 10) / 10
              : null,
          restingHr:
            whoopTodayRow?.restingHeartRate != null
              ? Math.round(whoopTodayRow.restingHeartRate)
              : null,
          calibrating: whoopTodayRow?.userCalibrating ?? false,
          sleepHours: sleepToday ? whoopSleepHours(sleepToday) : null,
          sleepPerformancePct:
            sleepToday?.performancePct != null ? Math.round(sleepToday.performancePct) : null,
          dayStrain: cycleToday?.strain != null ? Math.round(cycleToday.strain * 10) / 10 : null,
        }
      : null;

  const todayLog = byDate.get(today) ?? null;

  return {
    today: todayLog
      ? {
          sleepHours: todayLog.sleepHours,
          sleepQuality: todayLog.sleepQuality,
          stress: todayLog.stress,
          energy: todayLog.energy,
          motivation: todayLog.motivation,
          workoutDifficulty: todayLog.workoutDifficulty,
          soreness: todayLog.soreness,
          notes: todayLog.notes,
        }
      : null,
    todayScore: todayLog?.score ?? null,
    latestScore: latest.score,
    latestScoreDate: latest.score != null ? latest.date : null,
    latestBand: latest.band,
    latestSource: latest.source,
    trend,
    whoopToday,
    totalLogged,
  };
}
