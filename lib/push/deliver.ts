/**
 * lib/push/deliver.ts — idempotent push delivery. Every push is keyed by a
 * dedupeKey and recorded in PushSent BEFORE sending, so cron re-runs and
 * event replays never re-notify. Best-effort like the APNs sender: never
 * throws into the caller's flow.
 */
import { prisma } from "@/lib/db";
import { sendPushToUser, type PushMessage } from "@/lib/push/apns";

/**
 * Send `msg` to the user's devices unless a push with this dedupeKey was
 * already sent. Returns true when a send was attempted (i.e. first time).
 */
export async function deliverPush(
  userId: string,
  dedupeKey: string,
  msg: PushMessage,
): Promise<boolean> {
  try {
    // Claim the key first — a unique violation means someone already sent it.
    await prisma.pushSent.create({ data: { userId, dedupeKey } });
  } catch {
    return false;
  }
  const report = await sendPushToUser(userId, msg);
  if (!report.configured) {
    // APNs isn't configured — nothing was or could be sent. Release the
    // dedupe claim so the push goes out once credentials are in place
    // instead of being silently burned for this key.
    console.warn("[push] APNs not configured — releasing dedupe claim", dedupeKey);
    await prisma.pushSent.deleteMany({ where: { userId, dedupeKey } });
    return false;
  }
  return true;
}
