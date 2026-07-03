"use server";

import { buildLatestCoachBrief, type CoachBriefData } from "@/lib/ai/dashboard-coach";

export async function getLatestCoachBrief(): Promise<CoachBriefData | null> {
  return (await buildLatestCoachBrief())?.brief ?? null;
}
