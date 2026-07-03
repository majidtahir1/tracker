/**
 * lib/whoop/types.ts — raw WHOOP API v2 payload shapes.
 * Mirrors https://developer.whoop.com/docs (developer/v2 endpoints).
 */

export type WhoopScoreState = "SCORED" | "PENDING_SCORE" | "UNSCORABLE";

/** POST /oauth/oauth2/token response. */
export interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  scope?: string;
  token_type?: string;
}

/** GET /developer/v2/user/profile/basic response. */
export interface WhoopProfile {
  user_id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
}

/** Paginated collection envelope shared by all /developer/v2 collections. */
export interface WhoopPage<T> {
  records: T[];
  next_token?: string | null;
}

/** GET /developer/v2/cycle record. */
export interface WhoopCycleRecord {
  id: number | string;
  start: string; // ISO-8601 UTC
  end?: string | null; // null = in-progress cycle
  timezone_offset?: string;
  score_state: WhoopScoreState;
  score?: {
    strain?: number | null;
    kilojoule?: number | null;
    average_heart_rate?: number | null;
    max_heart_rate?: number | null;
  } | null;
}

/** GET /developer/v2/recovery record. */
export interface WhoopRecoveryRecord {
  cycle_id: number | string;
  sleep_id?: string | null;
  score_state: WhoopScoreState;
  created_at: string;
  updated_at?: string;
  score?: {
    user_calibrating?: boolean;
    recovery_score?: number | null;
    resting_heart_rate?: number | null;
    hrv_rmssd_milli?: number | null;
    spo2_percentage?: number | null;
    skin_temp_celsius?: number | null;
  } | null;
}

/** GET /developer/v2/activity/sleep record. */
export interface WhoopSleepRecord {
  id: string; // UUID
  start: string;
  end?: string | null;
  nap: boolean;
  score_state: WhoopScoreState;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number | null;
      total_awake_time_milli?: number | null;
      total_light_sleep_time_milli?: number | null;
      total_slow_wave_sleep_time_milli?: number | null;
      total_rem_sleep_time_milli?: number | null;
      sleep_cycle_count?: number | null;
      disturbance_count?: number | null;
    } | null;
    sleep_needed?: {
      need_from_sleep_debt_milli?: number | null;
    } | null;
    respiratory_rate?: number | null;
    sleep_performance_percentage?: number | null;
    sleep_consistency_percentage?: number | null;
    sleep_efficiency_percentage?: number | null;
  } | null;
}

/** GET /developer/v2/activity/workout record. */
export interface WhoopWorkoutRecord {
  id: string; // UUID
  sport_name: string;
  start: string;
  end: string;
  score_state: WhoopScoreState;
  score?: {
    strain?: number | null;
    average_heart_rate?: number | null;
    max_heart_rate?: number | null;
    kilojoule?: number | null;
    distance_meter?: number | null;
    altitude_gain_meter?: number | null;
  } | null;
}
