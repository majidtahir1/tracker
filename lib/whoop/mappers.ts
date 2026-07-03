/**
 * lib/whoop/mappers.ts — pure mappers from raw WHOOP API records to Prisma
 * upsert data. No I/O; unit-testable. Dates become local YYYY-MM-DD strings
 * (machine-local timezone, consistent with lib/dates.ts localToday()).
 */
import { fmtLocalDate, type LocalDate } from "@/lib/dates";
import type {
  WhoopCycleRecord,
  WhoopRecoveryRecord,
  WhoopSleepRecord,
  WhoopWorkoutRecord,
} from "@/lib/whoop/types";

/** Convert a UTC ISO instant to the machine-local YYYY-MM-DD day. */
export function utcToLocalDate(iso: string): LocalDate {
  return fmtLocalDate(new Date(iso));
}

export interface WhoopCycleData {
  id: string;
  date: LocalDate;
  start: Date;
  end: Date | null;
  scoreState: string;
  strain: number | null;
  kilojoule: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
}

export function mapCycle(record: WhoopCycleRecord): WhoopCycleData {
  return {
    id: String(record.id),
    date: utcToLocalDate(record.start),
    start: new Date(record.start),
    end: record.end ? new Date(record.end) : null,
    scoreState: record.score_state,
    strain: record.score?.strain ?? null,
    kilojoule: record.score?.kilojoule ?? null,
    avgHeartRate: record.score?.average_heart_rate ?? null,
    maxHeartRate: record.score?.max_heart_rate ?? null,
  };
}

export interface WhoopRecoveryData {
  cycleId: string;
  sleepId: string | null;
  date: LocalDate;
  scoreState: string;
  recoveryScore: number | null;
  restingHeartRate: number | null;
  hrvRmssdMilli: number | null;
  spo2Percentage: number | null;
  skinTempCelsius: number | null;
  userCalibrating: boolean;
}

/**
 * Recovery records carry no day of their own — take the date from the parent
 * cycle when it is in `cycleDateById`, else fall back to created_at's day.
 */
export function mapRecovery(
  record: WhoopRecoveryRecord,
  cycleDateById: Map<string, string>,
): WhoopRecoveryData {
  const cycleId = String(record.cycle_id);
  const score = record.score;
  return {
    cycleId,
    sleepId: record.sleep_id ?? null,
    date: cycleDateById.get(cycleId) ?? utcToLocalDate(record.created_at),
    scoreState: record.score_state,
    recoveryScore: score?.recovery_score == null ? null : Math.round(score.recovery_score),
    restingHeartRate: score?.resting_heart_rate ?? null,
    hrvRmssdMilli: score?.hrv_rmssd_milli ?? null,
    spo2Percentage: score?.spo2_percentage ?? null,
    skinTempCelsius: score?.skin_temp_celsius ?? null,
    userCalibrating: score?.user_calibrating ?? false,
  };
}

export interface WhoopSleepData {
  id: string;
  date: LocalDate;
  start: Date;
  end: Date;
  isNap: boolean;
  scoreState: string;
  performancePct: number | null;
  consistencyPct: number | null;
  efficiencyPct: number | null;
  respiratoryRate: number | null;
  inBedMilli: number | null;
  awakeMilli: number | null;
  lightSleepMilli: number | null;
  slowWaveSleepMilli: number | null;
  remSleepMilli: number | null;
  sleepCycleCount: number | null;
  disturbanceCount: number | null;
  sleepDebtMilli: number | null;
}

/** Returns null for in-progress sleeps (no end yet); naps are kept, flagged. */
export function mapSleep(record: WhoopSleepRecord): WhoopSleepData | null {
  if (!record.end) return null;
  const score = record.score;
  const stages = score?.stage_summary;
  return {
    id: record.id,
    date: utcToLocalDate(record.end), // day of wake
    start: new Date(record.start),
    end: new Date(record.end),
    isNap: record.nap,
    scoreState: record.score_state,
    performancePct: score?.sleep_performance_percentage ?? null,
    consistencyPct: score?.sleep_consistency_percentage ?? null,
    efficiencyPct: score?.sleep_efficiency_percentage ?? null,
    respiratoryRate: score?.respiratory_rate ?? null,
    inBedMilli: stages?.total_in_bed_time_milli ?? null,
    awakeMilli: stages?.total_awake_time_milli ?? null,
    lightSleepMilli: stages?.total_light_sleep_time_milli ?? null,
    slowWaveSleepMilli: stages?.total_slow_wave_sleep_time_milli ?? null,
    remSleepMilli: stages?.total_rem_sleep_time_milli ?? null,
    sleepCycleCount: stages?.sleep_cycle_count ?? null,
    disturbanceCount: stages?.disturbance_count ?? null,
    sleepDebtMilli: score?.sleep_needed?.need_from_sleep_debt_milli ?? null,
  };
}

export interface WhoopWorkoutData {
  id: string;
  date: LocalDate;
  start: Date;
  end: Date;
  sportName: string;
  scoreState: string;
  strain: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  kilojoule: number | null;
  distanceMeter: number | null;
  altitudeGainMeter: number | null;
}

export function mapWorkout(record: WhoopWorkoutRecord): WhoopWorkoutData {
  return {
    id: record.id,
    date: utcToLocalDate(record.start),
    start: new Date(record.start),
    end: new Date(record.end),
    sportName: record.sport_name,
    scoreState: record.score_state,
    strain: record.score?.strain ?? null,
    avgHeartRate: record.score?.average_heart_rate ?? null,
    maxHeartRate: record.score?.max_heart_rate ?? null,
    kilojoule: record.score?.kilojoule ?? null,
    distanceMeter: record.score?.distance_meter ?? null,
    altitudeGainMeter: record.score?.altitude_gain_meter ?? null,
  };
}
