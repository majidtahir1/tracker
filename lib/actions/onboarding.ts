"use server";

/**
 * lib/actions/onboarding.ts — completes (or skips) the first-run wizard.
 * Stamping onboardedAt is the only required write; the body-weight measurement
 * is best-effort on top.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { localToday } from "@/lib/dates";
import { validBodyWeightLb } from "@/lib/onboarding";

export interface OnboardingResult {
  ok: boolean;
  error?: string;
}

export async function completeOnboarding(input: {
  bodyWeightLb: number | null;
  /** "starter" activates the built-in program; anything else leaves none active. */
  programChoice: "starter" | "ai" | "manual" | "skip";
}): Promise<OnboardingResult> {
  const userId = await requireUserId();
  const weight = input.bodyWeightLb;
  if (weight != null && !validBodyWeightLb(weight)) {
    return { ok: false, error: "Body weight must be between 30 and 1000 lb." };
  }

  if (weight != null) {
    const date = localToday();
    await prisma.bodyMeasurement.upsert({
      where: { userId_date: { userId, date } },
      update: { weight },
      create: { userId, date, weight },
    });
  }

  let activeProgramId: string | null | undefined; // undefined = leave as-is
  if (input.programChoice === "starter") {
    const starter = await prisma.program.findFirst({ orderBy: { createdAt: "asc" } });
    activeProgramId = starter?.id;
  }
  await prisma.appSettings.update({
    where: { userId },
    data: {
      onboardedAt: new Date().toISOString(),
      ...(activeProgramId !== undefined ? { activeProgramId } : {}),
    },
  });
  revalidatePath("/");
  revalidatePath("/workout");
  revalidatePath("/measurements");
  return { ok: true };
}
