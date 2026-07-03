/**
 * lib/queries/whoop.ts — server-only read layer for the WHOOP integration:
 * connection status plus a fire-and-forget throttled auto-sync.
 */
import { isWhoopConfigured } from "@/lib/whoop/config";
import { getConnection } from "@/lib/whoop/client";
import { syncWhoop } from "@/lib/whoop/sync";

export interface WhoopStatus {
  configured: boolean;
  connected: boolean;
  lastSyncedAt: string | null; // ISO
  reauthRequired: boolean;
  lastSyncError: string | null;
}

export async function getWhoopStatus(): Promise<WhoopStatus> {
  const configured = isWhoopConfigured();
  const connection = configured ? await getConnection() : null;
  return {
    configured,
    connected: connection != null,
    lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
    reauthRequired: connection?.lastSyncError === "reauth_required",
    lastSyncError: connection?.lastSyncError ?? null,
  };
}

/**
 * Throttled, non-forced sync for page loads. Swallows every error — callers
 * fire-and-forget (`void maybeAutoSync()`).
 */
export async function maybeAutoSync(): Promise<void> {
  try {
    await syncWhoop();
  } catch {
    // syncWhoop already never throws; this is belt-and-braces.
  }
}
