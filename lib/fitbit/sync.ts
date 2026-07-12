/**
 * lib/fitbit/sync.ts — pull sleep/exercise/daily metrics from the Google
 * Health API and upsert them locally. Never throws: failures are recorded on
 * the connection row and returned in the SyncResult.
 */
import { prisma } from "@/lib/db";
import { addDays, fmtLocalDate, parseLocalDate } from "@/lib/dates";
import { isFitbitConfigured } from "@/lib/fitbit/config";
import { fetchDataPoints, getConnection, FitbitAuthError } from "@/lib/fitbit/client";
import { mapExercise, mapSleep, mergeDailySeries } from "@/lib/fitbit/mappers";
import type {
  GhaDailyHeartRateVariabilityPoint,
  GhaDailyRestingHeartRatePoint,
  GhaExercisePoint,
  GhaSleepPoint,
  GhaStepsPoint,
} from "@/lib/fitbit/types";

export interface SyncResult {
  ok: boolean;
  skipped?: boolean;
  error?: string | null;
  counts?: { sleeps: number; activities: number; dailies: number };
}

const THROTTLE_MS = 15 * 60 * 1000; // skip syncs within 15 minutes
const OVERLAP_MS = 48 * 60 * 60 * 1000; // re-fetch 48h back to catch late uploads
const FIRST_SYNC_MS = 90 * 24 * 60 * 60 * 1000; // 90 days on first sync
const MAX_PAGE_SIZE = 10_000; // sample/interval types; session types cap at 25

/** AIP-160 filter for a session/interval start_time within [start, end). */
function timeFilter(field: string, start: Date, end: Date): string {
  return `${field} >= "${start.toISOString()}" AND ${field} < "${end.toISOString()}"`;
}

/** AIP-160 filter for a daily type's civil date within [start, end]. */
function dateFilter(field: string, start: Date, end: Date): string {
  return `${field} >= "${fmtLocalDate(start)}" AND ${field} < "${addDays(fmtLocalDate(end), 1)}"`;
}

export async function syncFitbit(
  userId: string,
  opts?: { force?: boolean },
): Promise<SyncResult> {
  if (!isFitbitConfigured()) return { ok: false, error: "not_configured" };
  const connection = await getConnection(userId);
  if (!connection) return { ok: false, error: "not_connected" };

  const now = new Date();
  if (
    !opts?.force &&
    connection.lastSyncedAt &&
    now.getTime() - connection.lastSyncedAt.getTime() < THROTTLE_MS
  ) {
    return { ok: true, skipped: true };
  }

  const start = connection.lastSyncedAt
    ? new Date(connection.lastSyncedAt.getTime() - OVERLAP_MS)
    : new Date(now.getTime() - FIRST_SYNC_MS);

  try {
    // Session types don't support server-side time filters — fetch all pages
    // and window client-side on the session's end time.
    const sleeps = (await fetchDataPoints<GhaSleepPoint>(userId, "sleep", null))
      .map(mapSleep)
      .filter((s) => s !== null)
      .filter((s) => s.end >= start);
    for (const sleep of sleeps) {
      const { id, ...data } = sleep;
      await prisma.fitbitSleep.upsert({
        where: { id },
        create: { ...sleep, userId },
        update: { ...data, userId },
      });
    }

    const activities = (await fetchDataPoints<GhaExercisePoint>(userId, "exercise", null))
      .map(mapExercise)
      .filter((a) => a !== null)
      .filter((a) => a.end >= start);
    for (const activity of activities) {
      const { id, ...data } = activity;
      await prisma.fitbitActivity.upsert({
        where: { id },
        create: { ...activity, userId },
        update: { ...data, userId },
      });
    }

    const restingHr = await fetchDataPoints<GhaDailyRestingHeartRatePoint>(
      userId,
      "daily-resting-heart-rate",
      dateFilter("daily_resting_heart_rate.date", start, now),
      { pageSize: MAX_PAGE_SIZE },
    );
    const hrv = await fetchDataPoints<GhaDailyHeartRateVariabilityPoint>(
      userId,
      "daily-heart-rate-variability",
      dateFilter("daily_heart_rate_variability.date", start, now),
      { pageSize: MAX_PAGE_SIZE },
    );
    // Per-day step totals are summed locally, so fetch whole days: start at
    // local midnight of the window's first day or boundary days undercount.
    const steps = await fetchDataPoints<GhaStepsPoint>(
      userId,
      "steps",
      timeFilter("steps.interval.start_time", parseLocalDate(fmtLocalDate(start)), now),
      { pageSize: MAX_PAGE_SIZE },
    );

    const dailies = mergeDailySeries(restingHr, hrv, steps);
    for (const daily of dailies) {
      const { date, ...data } = daily;
      await prisma.fitbitDaily.upsert({
        where: { userId_date: { userId, date } },
        create: { ...daily, userId },
        update: data,
      });
    }

    await prisma.fitbitConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: now, lastSyncError: null },
    });

    return {
      ok: true,
      counts: {
        sleeps: sleeps.length,
        activities: activities.length,
        dailies: dailies.length,
      },
    };
  } catch (err) {
    const error = err instanceof FitbitAuthError ? "reauth_required" : "sync_failed";
    // Best effort — the connection row may have been deleted mid-sync.
    await prisma.fitbitConnection
      .update({ where: { id: connection.id }, data: { lastSyncError: error } })
      .catch(() => {});
    return { ok: false, error };
  }
}
