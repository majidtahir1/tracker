import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import OnboardingWizard, { type StarterProgram } from "@/components/onboarding/OnboardingWizard";

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

  let starter: StarterProgram | null = null;
  {
    // The built-in starter is the oldest program in the catalog — the wizard's
    // "keep the starter" choice activates it (nothing is active until then).
    const program = await prisma.program.findFirst({
      where: { isBuiltIn: true },
      orderBy: { createdAt: "asc" },
      include: {
        workouts: {
          where: { isActive: true },
          include: { exercises: { select: { baseSets: true, restSeconds: true } } },
        },
      },
    });
    if (program && program.workouts.length > 0) {
      // Same session-length estimate as the workout overview: rest + ~45s work per set.
      const minutes = program.workouts.map((t) => {
        const workSeconds = t.exercises.reduce((n, e) => n + e.baseSets * (e.restSeconds + 45), 0);
        return Math.round(workSeconds / 60 / 5) * 5;
      });
      const exercises = program.workouts.map((t) => t.exercises.length);
      starter = {
        name: program.name,
        daysPerWeek: program.workouts.length,
        exercisesMin: Math.min(...exercises),
        exercisesMax: Math.max(...exercises),
        estMinutesMin: Math.min(...minutes),
        estMinutesMax: Math.max(...minutes),
      };
    }
  }

  return <OnboardingWizard starter={starter} />;
}
