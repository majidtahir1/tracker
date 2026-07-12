"use server";

/**
 * lib/actions/whoop.ts — server actions (write layer) for the WHOOP
 * integration: manual sync and disconnect.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { syncWhoop, type SyncResult } from "@/lib/whoop/sync";

const WHOOP_PATHS = ["/recovery", "/", "/history", "/calendar", "/analytics", "/settings"] as const;

function revalidateWhoopPaths(): void {
  for (const path of WHOOP_PATHS) revalidatePath(path);
}

/** Force a sync now (ignores the 15-minute throttle). */
export async function syncWhoopNow(): Promise<SyncResult> {
  const userId = await requireUserId();
  const result = await syncWhoop(userId, { force: true });
  revalidateWhoopPaths();
  return result;
}

/** Remove the WHOOP connection; already-synced data is kept. */
export async function disconnectWhoop(): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await prisma.whoopConnection.deleteMany({ where: { userId } });
  revalidateWhoopPaths();
  return { ok: true };
}
