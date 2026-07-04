"use server";

/**
 * lib/actions/records.ts — acknowledge unseen PR badges (/records).
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/** Mark every unseen PersonalRecord as seen (clears "NEW" badges). */
export async function markAllPrsSeen(): Promise<void> {
  const userId = await requireUserId();
  await prisma.personalRecord.updateMany({
    where: { userId, seenByUser: false },
    data: { seenByUser: true },
  });
  revalidatePath("/records");
}
