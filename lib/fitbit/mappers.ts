/**
 * lib/fitbit/mappers.ts — pure mappers from raw Google Health API data points
 * to Prisma upsert data. No I/O; unit-testable. Days use the DEVICE's local
 * calendar: civil dates and UTC offsets from the payload when present,
 * falling back to the machine-local day (lib/dates.ts convention).
 */
import { fmtLocalDate, type LocalDate } from "@/lib/dates";
import type {
  GhaDailyHeartRateVariabilityPoint,
  GhaDailyRestingHeartRatePoint,
  GhaDate,
  GhaExercisePoint,
  GhaInterval,
  GhaNumberish,
  GhaSleepPoint,
  GhaStepsPoint,
} from "@/lib/fitbit/types";

/** Coerce an int64-as-string ("28") or number to a finite number, else null. */
export function num(value: GhaNumberish | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** {year: 2026, month: 7, day: 3} → "2026-07-03"; null when incomplete. */
export function ghaDateToLocal(date: GhaDate | null | undefined): LocalDate | null {
  if (!date?.year || !date.month || !date.day) return null;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/** "67694s" → whole minutes; null on anything else. */
export function durationToMinutes(duration: string | null | undefined): number | null {
  const seconds = num(duration?.match(/^(\d+)s$/)?.[1]);
  return seconds == null ? null : Math.round(seconds / 60);
}

/** Convert a UTC ISO instant to the machine-local YYYY-MM-DD day. */
export function utcToLocalDate(iso: string): LocalDate {
  return fmtLocalDate(new Date(iso));
}

/**
 * The device-local day of a UTC instant, using the payload's UTC offset
 * ("-18000s") when present; machine-local day otherwise.
 */
export function deviceLocalDate(iso: string, utcOffset: string | undefined): LocalDate {
  const offsetSeconds = num(utcOffset?.match(/^(-?\d+)s$/)?.[1]);
  if (offsetSeconds == null) return utcToLocalDate(iso);
  return new Date(new Date(iso).getTime() + offsetSeconds * 1000).toISOString().slice(0, 10);
}

/** Last path segment of "users/{n}/dataTypes/{type}/dataPoints/{id}". */
export function dataPointId(name: string | undefined): string | null {
  const id = name?.split("/").pop();
  return id || null;
}

function intervalMinutes(interval: GhaInterval | undefined): number | null {
  if (!interval?.startTime || !interval.endTime) return null;
  const ms = new Date(interval.endTime).getTime() - new Date(interval.startTime).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 60_000) : null;
}

export interface FitbitSleepData {
  id: string;
  date: LocalDate;
  start: Date;
  end: Date;
  isNap: boolean;
  efficiency: number | null;
  minutesAsleep: number | null;
  minutesAwake: number | null;
  timeInBedMin: number | null;
  lightMin: number | null;
  deepMin: number | null;
  remMin: number | null;
  wakeMin: number | null;
}

/**
 * Returns null for points missing an id or interval. Stage minutes come from
 * summary.stagesSummary; CLASSIC sessions (no stages) store null. Naps are
 * flagged from metadata.nap. Efficiency is not exposed by this API.
 */
export function mapSleep(point: GhaSleepPoint): FitbitSleepData | null {
  const sleep = point.sleep;
  const id = dataPointId(point.name);
  if (!id || !sleep?.interval?.startTime || !sleep.interval.endTime) return null;

  const stageMinutes = new Map<string, number>();
  for (const stage of sleep.summary?.stagesSummary ?? []) {
    const minutes = num(stage.minutes);
    if (minutes == null || !stage.type) continue;
    stageMinutes.set(stage.type, (stageMinutes.get(stage.type) ?? 0) + minutes);
  }
  const stage = (type: string): number | null => stageMinutes.get(type) ?? null;

  return {
    id,
    // Day of wake, on the device's clock.
    date: deviceLocalDate(sleep.interval.endTime, sleep.interval.endUtcOffset),
    start: new Date(sleep.interval.startTime),
    end: new Date(sleep.interval.endTime),
    isNap: sleep.metadata?.nap ?? false,
    efficiency: null,
    minutesAsleep: num(sleep.summary?.minutesAsleep),
    minutesAwake: num(sleep.summary?.minutesAwake) ?? stage("AWAKE"),
    timeInBedMin: num(sleep.summary?.minutesInSleepPeriod) ?? intervalMinutes(sleep.interval),
    lightMin: stage("LIGHT"),
    deepMin: stage("DEEP"),
    remMin: stage("REM"),
    wakeMin: stage("AWAKE"),
  };
}

export interface FitbitActivityData {
  id: string;
  date: LocalDate;
  start: Date;
  end: Date;
  activityName: string;
  durationMin: number | null;
  calories: number | null;
  steps: number | null;
  distance: number | null;
  distanceUnit: string | null;
  avgHeartRate: number | null;
}

/** "WEIGHT_LIFTING" → "Weight lifting". */
export function prettyExerciseType(exerciseType: string): string {
  const words = exerciseType.toLowerCase().replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Exercise";
}

/** Returns null for points missing an id or interval. */
export function mapExercise(point: GhaExercisePoint): FitbitActivityData | null {
  const exercise = point.exercise;
  const id = dataPointId(point.name);
  if (!id || !exercise?.interval?.startTime || !exercise.interval.endTime) return null;
  const metrics = exercise.metricsSummary;
  const calories = num(metrics?.caloriesKcal);
  const avgHeartRate = num(metrics?.averageHeartRateBeatsPerMinute);
  const distance = num(metrics?.distanceMeters);
  return {
    id,
    date: deviceLocalDate(exercise.interval.startTime, exercise.interval.startUtcOffset),
    start: new Date(exercise.interval.startTime),
    end: new Date(exercise.interval.endTime),
    activityName: exercise.displayName || prettyExerciseType(exercise.exerciseType ?? ""),
    durationMin: durationToMinutes(exercise.activeDuration) ?? intervalMinutes(exercise.interval),
    calories: calories != null ? Math.round(calories) : null,
    steps: num(metrics?.steps),
    distance,
    distanceUnit: distance != null ? "Meter" : null,
    avgHeartRate: avgHeartRate != null ? Math.round(avgHeartRate) : null,
  };
}

export interface FitbitDailyData {
  date: LocalDate;
  restingHeartRate: number | null;
  hrvDailyRmssd: number | null;
  hrvDeepRmssd: number | null;
  steps: number | null;
}

/**
 * Merge daily resting-HR and HRV points plus per-minute steps intervals into
 * one row per day. Steps sum onto their civil (device-local) start day. A day
 * appears if any metric has a value; absent metrics stay null.
 */
export function mergeDailySeries(
  restingHr: GhaDailyRestingHeartRatePoint[],
  hrv: GhaDailyHeartRateVariabilityPoint[],
  steps: GhaStepsPoint[],
): FitbitDailyData[] {
  const byDate = new Map<string, FitbitDailyData>();
  const dayFor = (date: string): FitbitDailyData => {
    let day = byDate.get(date);
    if (!day) {
      day = { date, restingHeartRate: null, hrvDailyRmssd: null, hrvDeepRmssd: null, steps: null };
      byDate.set(date, day);
    }
    return day;
  };

  for (const point of restingHr) {
    const record = point.dailyRestingHeartRate;
    const date = ghaDateToLocal(record?.date);
    const bpm = num(record?.beatsPerMinute);
    if (date && bpm != null) dayFor(date).restingHeartRate = Math.round(bpm);
  }
  for (const point of hrv) {
    const record = point.dailyHeartRateVariability;
    const date = ghaDateToLocal(record?.date);
    if (!date) continue;
    const rmssd = num(record?.rmssd) ?? num(record?.dailyRmssd);
    if (rmssd != null) dayFor(date).hrvDailyRmssd = rmssd;
    const deep = num(record?.deepRmssd);
    if (deep != null) dayFor(date).hrvDeepRmssd = deep;
  }
  for (const point of steps) {
    const record = point.steps;
    const count = num(record?.count);
    if (!record?.interval?.startTime || count == null || count <= 0) continue;
    const date =
      ghaDateToLocal(record.interval.civilStartTime?.date) ??
      deviceLocalDate(record.interval.startTime, record.interval.startUtcOffset);
    const day = dayFor(date);
    day.steps = (day.steps ?? 0) + count;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
