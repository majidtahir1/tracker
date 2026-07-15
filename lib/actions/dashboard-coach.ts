"use server";

import { prisma } from "@/lib/db";
import { localToday } from "@/lib/dates";
import { requireUserId } from "@/lib/session";
import { buildLatestCoachBrief, type CoachBriefData } from "@/lib/ai/dashboard-coach";
import { buildDailyBrief } from "@/lib/ai/daily-brief";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

/**
 * The phased coach card: the morning brief carries the day until a workout
 * is completed today, when the post-workout reflection takes over.
 */
export async function getLatestCoachBrief(): Promise<CoachBriefData | null> {
  const userId = await requireUserId();
  try {
    await enforceRateLimit(userId, "ai:dashboard-coach", 60, 60 * 60);
  } catch (error) {
    if (error instanceof RateLimitError) return null;
    throw error;
  }
  const today = localToday();
  const completedToday = await prisma.workoutSession.findFirst({
    where: { userId, status: "COMPLETED", date: today },
    select: { id: true },
  });
  if (completedToday) return (await buildLatestCoachBrief())?.brief ?? null;
  return buildDailyBrief(userId, today);
}
