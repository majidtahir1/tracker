"use server";

/**
 * lib/actions/fitbit.ts — server actions (write layer) for the Fitbit
 * integration: manual sync and disconnect.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { syncFitbit, type SyncResult } from "@/lib/fitbit/sync";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

const FITBIT_PATHS = ["/recovery", "/", "/history", "/calendar", "/analytics", "/settings"] as const;

function revalidateFitbitPaths(): void {
  for (const path of FITBIT_PATHS) revalidatePath(path);
}

/** Force a sync now (ignores the 15-minute throttle). */
export async function syncFitbitNow(): Promise<SyncResult> {
  const userId = await requireUserId();
  try {
    await enforceRateLimit(userId, "sync:fitbit", 4, 15 * 60);
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, error: error.message };
    throw error;
  }
  const result = await syncFitbit(userId, { force: true });
  revalidateFitbitPaths();
  return result;
}

/** Remove the Fitbit connection; already-synced data is kept. */
export async function disconnectFitbit(): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await prisma.fitbitConnection.deleteMany({ where: { userId } });
  revalidateFitbitPaths();
  return { ok: true };
}
