import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import type { Program, WorkoutTemplate, TemplateExercise, Exercise } from "@/lib/generated/prisma/client";

export type ProgramWithWorkouts = Program & {
  workouts: (WorkoutTemplate & {
    exercises: (TemplateExercise & { exercise: Exercise })[];
  })[];
};

export interface GetProgramsResult {
  programs: ProgramWithWorkouts[];
  activeProgramId: string | null;
}

export async function getPrograms(): Promise<GetProgramsResult> {
  const userId = await requireUserId();
  const [programs, settings] = await Promise.all([
    prisma.program.findMany({
      orderBy: [{ createdAt: "asc" }],
      include: {
        workouts: {
          orderBy: { dayNumber: "asc" },
          include: { exercises: { orderBy: { sortOrder: "asc" }, include: { exercise: true } } },
        },
      },
    }),
    prisma.appSettings.findUnique({ where: { userId } }),
  ]);
  return { programs, activeProgramId: settings?.activeProgramId ?? null };
}

export async function getProgramWorkout(id: string) {
  await requireUserId();
  const [workout, exercises] = await Promise.all([
    prisma.workoutTemplate.findUnique({
      where: { id },
      include: { program: true, exercises: { orderBy: { sortOrder: "asc" }, include: { exercise: true } } },
    }),
    prisma.exercise.findMany({ where: {}, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { workout, exercises };
}
