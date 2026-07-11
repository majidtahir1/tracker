import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { shouldOnboard } from "@/lib/onboarding";
import OnboardingWizard, { type StarterProgram } from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const userId = await requireUserId();
  const [settings, completedCount] = await Promise.all([
    prisma.appSettings.findUnique({ where: { userId } }),
    prisma.workoutSession.count({ where: { userId, status: "COMPLETED" } }),
  ]);
  if (!shouldOnboard(settings, completedCount)) redirect("/");

  let starter: StarterProgram | null = null;
  if (settings?.activeProgramId) {
    const program = await prisma.program.findUnique({
      where: { id: settings.activeProgramId },
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
