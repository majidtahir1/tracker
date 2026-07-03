"use server";

/**
 * lib/actions/records.ts — acknowledge unseen PR badges (/records).
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

/** Mark every unseen PersonalRecord as seen (clears "NEW" badges). */
export async function markAllPrsSeen(): Promise<void> {
  await prisma.personalRecord.updateMany({
    where: { seenByUser: false },
    data: { seenByUser: true },
  });
  revalidatePath("/records");
}
