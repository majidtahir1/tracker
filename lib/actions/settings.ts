"use server";

/**
 * lib/actions/settings.ts — server actions for the settings page.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export interface NotificationPrefs {
  notifyMorningBrief: boolean;
  notifyStreakSaver: boolean;
}

export async function updateNotificationPrefs(prefs: NotificationPrefs): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const data = {
    notifyMorningBrief: Boolean(prefs.notifyMorningBrief),
    notifyStreakSaver: Boolean(prefs.notifyStreakSaver),
  };
  await prisma.appSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  revalidatePath("/settings");
  return { ok: true };
}
