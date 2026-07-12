/**
 * lib/fitbit/types.ts — raw Google Health API v4 payload shapes (Fitbit data),
 * verified against live responses (July 2026). Two API quirks matter:
 * int64 values arrive as JSON strings ("28"), and civil dates are objects
 * ({year, month, day}) — mappers coerce both. Durations are "Ns" strings.
 */

/** int64 fields arrive as strings; some numeric fields are plain numbers. */
export type GhaNumberish = number | string;

/** POST https://oauth2.googleapis.com/token response. Google refresh tokens
 * do NOT rotate — refresh responses usually omit refresh_token. */
export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  scope?: string;
  token_type?: string;
}

/** GET /v4/users/me/dataTypes/{type}/dataPoints response envelope. */
export interface GhaDataPointList<T> {
  dataPoints?: T[];
  nextPageToken?: string | null;
}

/** Civil (local) date object. */
export interface GhaDate {
  year?: number;
  month?: number;
  day?: number;
}

/** Time interval: RFC-3339 UTC instants plus the device's UTC offset ("-18000s"). */
export interface GhaInterval {
  startTime?: string;
  endTime?: string;
  startUtcOffset?: string;
  endUtcOffset?: string;
  civilStartTime?: { date?: GhaDate } | null;
  civilEndTime?: { date?: GhaDate } | null;
}

interface GhaDataPointBase {
  name?: string; // "users/{n}/dataTypes/{type}/dataPoints/{id}"
}

/** dataTypes/sleep — Session type. No server-side time filter support. */
export interface GhaSleepPoint extends GhaDataPointBase {
  sleep?: {
    interval?: GhaInterval;
    type?: "CLASSIC" | "STAGES" | string;
    stages?: Array<{
      type?: string; // AWAKE | LIGHT | DEEP | REM
      startTime?: string;
      endTime?: string;
    }> | null;
    metadata?: { nap?: boolean; processed?: boolean } | null;
    summary?: {
      minutesAsleep?: GhaNumberish | null;
      minutesAwake?: GhaNumberish | null;
      minutesInSleepPeriod?: GhaNumberish | null;
      stagesSummary?: Array<{
        type?: string;
        minutes?: GhaNumberish | null;
      }> | null;
    } | null;
  };
}

/** dataTypes/exercise — Session type. No server-side time filter support. */
export interface GhaExercisePoint extends GhaDataPointBase {
  exercise?: {
    interval?: GhaInterval;
    exerciseType?: string; // enum, e.g. WORKOUT | RUNNING
    displayName?: string; // human name, e.g. "Workout"
    activeDuration?: string; // "67694s"
    metricsSummary?: {
      caloriesKcal?: GhaNumberish | null;
      averageHeartRateBeatsPerMinute?: GhaNumberish | null;
      steps?: GhaNumberish | null;
      distanceMeters?: GhaNumberish | null;
    } | null;
  };
}

/** dataTypes/daily-resting-heart-rate — Daily type. */
export interface GhaDailyRestingHeartRatePoint extends GhaDataPointBase {
  dailyRestingHeartRate?: {
    date?: GhaDate;
    beatsPerMinute?: GhaNumberish | null;
  };
}

/** dataTypes/daily-heart-rate-variability — Daily type (RMSSD in ms).
 * Shape unverified against live data (no HRV on the test account). */
export interface GhaDailyHeartRateVariabilityPoint extends GhaDataPointBase {
  dailyHeartRateVariability?: {
    date?: GhaDate;
    rmssd?: GhaNumberish | null;
    dailyRmssd?: GhaNumberish | null;
    deepRmssd?: GhaNumberish | null;
  };
}

/** dataTypes/steps — Interval type (per-minute); per-day totals summed locally. */
export interface GhaStepsPoint extends GhaDataPointBase {
  steps?: {
    interval?: GhaInterval;
    count?: GhaNumberish | null;
  };
}
