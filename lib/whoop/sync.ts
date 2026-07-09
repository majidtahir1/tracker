/**
 * lib/whoop/sync.ts — pull cycles/recoveries/sleeps/workouts from WHOOP and
 * upsert them locally. Never throws: failures are recorded on the connection
 * row and returned in the SyncResult.
 */
import { prisma } from "@/lib/db";
import { isWhoopConfigured } from "@/lib/whoop/config";
import { fetchCollection, getConnection, WhoopAuthError } from "@/lib/whoop/client";
import { mapCycle, mapRecovery, mapSleep, mapWorkout } from "@/lib/whoop/mappers";
import type {
  WhoopCycleRecord,
  WhoopRecoveryRecord,
  WhoopSleepRecord,
  WhoopWorkoutRecord,
} from "@/lib/whoop/types";

export interface SyncResult {
  ok: boolean;
  skipped?: boolean;
  error?: string | null;
  counts?: { cycles: number; recoveries: number; sleeps: number; workouts: number };
}

const THROTTLE_MS = 15 * 60 * 1000; // skip syncs within 15 minutes
const OVERLAP_MS = 48 * 60 * 60 * 1000; // re-fetch 48h back to catch re-scores
const FIRST_SYNC_MS = 90 * 24 * 60 * 60 * 1000; // 90 days on first sync

export async function syncWhoop(
  userId: string,
  opts?: { force?: boolean },
): Promise<SyncResult> {
  if (!isWhoopConfigured()) return { ok: false, error: "not_configured" };
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
  const window = { start, end: now };

  try {
    // Cycles first — recoveries derive their date from the parent cycle's day.
    const cycles = (await fetchCollection<WhoopCycleRecord>(userId, "/cycle", window)).map(
      mapCycle,
    );
    const cycleDateById = new Map(cycles.map((c) => [c.id, c.date]));
    for (const cycle of cycles) {
      const { id, ...data } = cycle;
      await prisma.whoopCycle.upsert({
        where: { id },
        create: { ...cycle, userId },
        update: { ...data, userId },
      });
    }

    const recoveries = (
      await fetchCollection<WhoopRecoveryRecord>(userId, "/recovery", window)
    ).map((record) => mapRecovery(record, cycleDateById));
    for (const recovery of recoveries) {
      const { cycleId, ...data } = recovery;
      await prisma.whoopRecovery.upsert({
        where: { cycleId },
        create: { ...recovery, userId },
        update: { ...data, userId },
      });
    }

    const sleeps = (await fetchCollection<WhoopSleepRecord>(userId, "/activity/sleep", window))
      .map(mapSleep)
      .filter((s) => s !== null);
    for (const sleep of sleeps) {
      const { id, ...data } = sleep;
      await prisma.whoopSleep.upsert({
        where: { id },
        create: { ...sleep, userId },
        update: { ...data, userId },
      });
    }

    const workouts = (
      await fetchCollection<WhoopWorkoutRecord>(userId, "/activity/workout", window)
    ).map(mapWorkout);
    for (const workout of workouts) {
      const { id, ...data } = workout;
      await prisma.whoopWorkout.upsert({
        where: { id },
        create: { ...workout, userId },
        update: { ...data, userId },
      });
    }

    await prisma.whoopConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: now, lastSyncError: null },
    });

    return {
      ok: true,
      counts: {
        cycles: cycles.length,
        recoveries: recoveries.length,
        sleeps: sleeps.length,
        workouts: workouts.length,
      },
    };
  } catch (err) {
    const error = err instanceof WhoopAuthError ? "reauth_required" : "sync_failed";
    // Best effort — the connection row may have been deleted mid-sync.
    await prisma.whoopConnection
      .update({ where: { id: connection.id }, data: { lastSyncError: error } })
      .catch(() => {});
    return { ok: false, error };
  }
}
