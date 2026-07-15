import { unlink } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { resolveSafe } from "@/lib/photos-storage";
import { revokeGoogleHealthAccess } from "@/lib/fitbit/client";
import { revokeWhoopAccess } from "@/lib/whoop/client";

/** Cleanup invoked by Better Auth immediately before its cascading user delete. */
export async function prepareAccountDeletion(userId: string): Promise<void> {
  const [photos, whoop, google] = await Promise.all([
    prisma.progressPhoto.findMany({ where: { userId }, select: { filePath: true } }),
    prisma.whoopConnection.findUnique({ where: { userId }, select: { id: true } }),
    prisma.fitbitConnection.findUnique({ where: { userId }, select: { id: true } }),
  ]);

  const cleanup: Promise<unknown>[] = photos.flatMap(({ filePath }) => {
    const path = resolveSafe(filePath);
    return path ? [unlink(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") console.error("account deletion: photo cleanup failed", error);
    })] : [];
  });
  if (whoop) cleanup.push(revokeWhoopAccess(userId));
  if (google) cleanup.push(revokeGoogleHealthAccess(userId));

  const results = await Promise.allSettled(cleanup);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("account deletion: external cleanup failed", result.reason);
    }
  }
}
