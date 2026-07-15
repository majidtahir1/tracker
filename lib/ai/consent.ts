import { prisma } from "@/lib/db";

/** AI providers receive user context only after an explicit settings opt-in. */
export async function hasAiDataConsent(userId: string): Promise<boolean> {
  const settings = await prisma.appSettings.findUnique({
    where: { userId },
    select: { aiDataSharingEnabled: true },
  });
  return settings?.aiDataSharingEnabled === true;
}
