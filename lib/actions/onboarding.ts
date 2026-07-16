"use server";

/**
 * lib/actions/onboarding.ts — completes (or skips) the first-run wizard.
 * Thin web wrapper over lib/onboarding-server.ts (shared with the mobile
 * API): resolve the session, delegate, revalidate.
 */
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import {
  completeOnboardingForUser,
  type OnboardingResult,
} from "@/lib/onboarding-server";

export type { OnboardingResult };

export async function completeOnboarding(input: {
  bodyWeightLb: number | null;
  /** "starter" activates the built-in program; anything else leaves none active. */
  programChoice: "starter" | "ai" | "manual" | "skip";
}): Promise<OnboardingResult> {
  const userId = await requireUserId();
  const result = await completeOnboardingForUser(userId, input);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/workout");
    revalidatePath("/measurements");
  }
  return result;
}
