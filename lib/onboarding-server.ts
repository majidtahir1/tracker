/**
 * lib/onboarding-server.ts — the first-run wizard's data layer, shared by
 * the web server action (lib/actions/onboarding.ts) and the mobile JSON API
 * (app/api/mobile/onboarding). Pure gating/validation lives in
 * lib/onboarding.ts; this file owns the Prisma reads/writes.
 */
import { prisma } from "@/lib/db";
import { localToday } from "@/lib/dates";
import { validBodyWeightLb } from "@/lib/onboarding";
import { cloneBuiltInProgram } from "@/lib/program-access";

export interface StarterProgramSummary {
  name: string;
  daysPerWeek: number;
  exercisesMin: number;
  exercisesMax: number;
  estMinutesMin: number;
  estMinutesMax: number;
}

/**
 * Summary of the built-in starter (the oldest catalog program) for the
 * wizard's "keep the starter" card, or null when none is seeded.
 */
export async function getStarterSummary(): Promise<StarterProgramSummary | null> {
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
  if (!program || program.workouts.length === 0) return null;

  // Same session-length estimate as the workout overview: rest + ~45s work per set.
  const minutes = program.workouts.map((t) => {
    const workSeconds = t.exercises.reduce((n, e) => n + e.baseSets * (e.restSeconds + 45), 0);
    return Math.round(workSeconds / 60 / 5) * 5;
  });
  const exercises = program.workouts.map((t) => t.exercises.length);
  return {
    name: program.name,
    daysPerWeek: program.workouts.length,
    exercisesMin: Math.min(...exercises),
    exercisesMax: Math.max(...exercises),
    estMinutesMin: Math.min(...minutes),
    estMinutesMax: Math.max(...minutes),
  };
}

export interface OnboardingResult {
  ok: boolean;
  error?: string;
}

/**
 * Complete (or skip) the first-run wizard for a user. Stamping onboardedAt
 * is the only required write; the body-weight measurement is best-effort on
 * top. "starter" clones and activates the built-in program; anything else
 * leaves the active program untouched.
 */
export async function completeOnboardingForUser(
  userId: string,
  input: {
    bodyWeightLb: number | null;
    programChoice: "starter" | "ai" | "manual" | "skip";
  },
): Promise<OnboardingResult> {
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
    const starter = await prisma.program.findFirst({
      where: { isBuiltIn: true },
      orderBy: { createdAt: "asc" },
    });
    activeProgramId = starter ? await cloneBuiltInProgram(userId, starter.id) : null;
  }
  await prisma.appSettings.update({
    where: { userId },
    data: {
      onboardedAt: new Date().toISOString(),
      ...(activeProgramId !== undefined ? { activeProgramId } : {}),
    },
  });
  return { ok: true };
}
