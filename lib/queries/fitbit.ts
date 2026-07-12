/**
 * lib/queries/fitbit.ts — server-only read layer for the Fitbit integration:
 * connection status, a today-snapshot for the recovery card, plus a
 * fire-and-forget throttled auto-sync.
 */
import { prisma } from "@/lib/db";
import { localToday } from "@/lib/dates";
import { isFitbitConfigured } from "@/lib/fitbit/config";
import { requireUserId } from "@/lib/session";
import { getConnection } from "@/lib/fitbit/client";
import { syncFitbit } from "@/lib/fitbit/sync";

export interface FitbitStatus {
  configured: boolean;
  connected: boolean;
  lastSyncedAt: string | null; // ISO
  reauthRequired: boolean;
  lastSyncError: string | null;
}

export async function getFitbitStatus(): Promise<FitbitStatus> {
  const userId = await requireUserId();
  const configured = isFitbitConfigured();
  const connection = configured ? await getConnection(userId) : null;
  return {
    configured,
    connected: connection != null,
    lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
    reauthRequired: connection?.lastSyncError === "reauth_required",
    lastSyncError: connection?.lastSyncError ?? null,
  };
}

export interface FitbitTodaySnapshot {
  date: string; // YYYY-MM-DD the metrics belong to (may be before today)
  isToday: boolean;
  restingHr: number | null;
  hrvMs: number | null; // dailyRmssd
  sleepHours: number | null; // main sleep, minutesAsleep
  sleepEfficiency: number | null;
  steps: number | null;
}

/**
 * Today's Fitbit metrics for the recovery card — or, when the device hasn't
 * uploaded today yet, the most recent day with data. Null when nothing is
 * synced at all.
 */
export async function getFitbitToday(): Promise<FitbitTodaySnapshot | null> {
  const userId = await requireUserId();
  const today = localToday();

  const daily = await prisma.fitbitDaily.findFirst({
    where: { userId, date: { lte: today } },
    orderBy: { date: "desc" },
  });
  // Prefer the daily row's day so sleep and steps describe the same date;
  // fall back to the latest sleep when there are no daily rows at all.
  const sleep = await prisma.fitbitSleep.findFirst({
    where: { userId, isNap: false, ...(daily ? { date: daily.date } : {}) },
    orderBy: { end: "desc" },
  });
  if (!daily && !sleep) return null;

  const date = daily?.date ?? sleep!.date;
  return {
    date,
    isToday: date === today,
    restingHr: daily?.restingHeartRate ?? null,
    hrvMs: daily?.hrvDailyRmssd != null ? Math.round(daily.hrvDailyRmssd) : null,
    sleepHours:
      sleep?.minutesAsleep != null ? Math.round((sleep.minutesAsleep / 60) * 10) / 10 : null,
    sleepEfficiency: sleep?.efficiency ?? null,
    steps: daily?.steps ?? null,
  };
}

/**
 * Throttled, non-forced sync for page loads. Swallows every error — callers
 * fire-and-forget (`void maybeAutoSyncFitbit()`).
 */
export async function maybeAutoSyncFitbit(): Promise<void> {
  try {
    const userId = await requireUserId();
    await syncFitbit(userId);
  } catch {
    // Swallow everything (including requireUserId's redirect) — callers
    // fire-and-forget, so nothing may escape here.
  }
}
