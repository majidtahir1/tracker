import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getStarterSummary } from "@/lib/onboarding-server";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const userId = await requireUserId();
  const [settings, completedCount] = await Promise.all([
    prisma.appSettings.findUnique({ where: { userId } }),
    prisma.workoutSession.count({ where: { userId, status: "COMPLETED" } }),
  ]);
  // The wizard stays reachable (via the dashboard's "finish setup" link) after
  // a skip, until a program is activated or a workout is logged. Only the
  // dashboard's automatic redirect keys off onboardedAt (shouldOnboard).
  const done = completedCount > 0 || (settings?.onboardedAt != null && settings.activeProgramId != null);
  if (done) redirect("/");

  // The built-in starter is the oldest program in the catalog — the wizard's
  // "keep the starter" choice activates it (nothing is active until then).
  const starter = await getStarterSummary();

  return <OnboardingWizard starter={starter} />;
}
