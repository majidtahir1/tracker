"use server";

/**
 * lib/actions/notifications.ts — write layer for in-app notifications.
 * Mark-as-read actions used by the dashboard notification list.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/** Mark a single notification as read. */
export async function markNotificationRead(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("notification id required");
  }
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  revalidatePath("/");
}

/** Mark every unread notification as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const userId = await requireUserId();
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  revalidatePath("/");
}
