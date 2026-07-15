import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { computeVolume } from "@/lib/ai/program-builder";
import type { DraftProgram } from "@/lib/ai/program-builder-types";
import type { PhaseViewData } from "@/components/programs/ProgramPhaseView";
import type {
  BlockOverride,
  Program,
  WorkoutTemplate,
  TemplateExercise,
  Exercise,
} from "@/lib/generated/prisma/client";
import { visibleExerciseWhere, visibleProgramWhere } from "@/lib/program-access";

export type ProgramWithWorkouts = Program & {
  workouts: (WorkoutTemplate & {
    exercises: (TemplateExercise & { exercise: Exercise; blockOverrides: BlockOverride[] })[];
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
      where: visibleProgramWhere(userId),
      orderBy: [{ createdAt: "asc" }],
      include: {
        workouts: {
          orderBy: { dayNumber: "asc" },
          include: {
            exercises: {
              orderBy: { sortOrder: "asc" },
              include: { exercise: true, blockOverrides: true },
            },
          },
        },
      },
    }),
    prisma.appSettings.findUnique({ where: { userId } }),
  ]);
  return { programs, activeProgramId: settings?.activeProgramId ?? null };
}

/** Map a stored program to the phase-view shape used by ProgramPhaseView. */
export function programPhaseViewData(program: ProgramWithWorkouts): PhaseViewData {
  const block2AddSets: PhaseViewData["block2AddSets"] = [];
  const block3AddSets: PhaseViewData["block3AddSets"] = [];
  program.workouts.forEach((workout, wi) => {
    for (const slot of workout.exercises) {
      for (const override of slot.blockOverrides) {
        const entry = { day: wi + 1, exercise: slot.exercise.name };
        if (override.blockNumber === 2) block2AddSets.push(entry);
        if (override.blockNumber === 3) block3AddSets.push({ ...entry, addSets: override.addSets });
      }
    }
  });

  // Reuse the builder's volume math via a draft-shaped copy of the program.
  const draft: DraftProgram = {
    name: program.name,
    description: program.description ?? "",
    days: program.workouts.map((workout) => ({
      name: workout.name,
      focus: "",
      slots: workout.exercises.map((slot) => ({
        exercise: slot.exercise.name,
        sets: slot.baseSets,
        repMin: slot.repRangeMin,
        repMax: slot.repRangeMax,
        priority: slot.priority,
        isPerSide: slot.isPerSide,
        notes: null,
        newExercise: null,
      })),
    })),
    block2AddSets,
    block3AddSets,
  };
  const catalog = new Map(
    program.workouts
      .flatMap((w) => w.exercises)
      .map((slot) => [
        slot.exercise.name.toLowerCase(),
        {
          name: slot.exercise.name,
          primaryMuscle: slot.exercise.primaryMuscle,
          secondaryMuscles: slot.exercise.secondaryMuscles,
          equipment: slot.exercise.equipment,
          type: slot.exercise.type,
        },
      ]),
  );

  // Effort from the stored RIR targets, split compounds vs isolation.
  const rir = (isolation: boolean) => {
    const slots = program.workouts
      .flatMap((w) => w.exercises)
      .filter((s) => (s.exercise.type === "ISOLATION" || s.exercise.type === "CORE") === isolation);
    if (slots.length === 0) return null;
    return `${Math.min(...slots.map((s) => s.targetRirMin))}–${Math.max(...slots.map((s) => s.targetRirMax))}`;
  };
  const compoundRir = rir(false);
  const isolationRir = rir(true);
  const effortText =
    [
      compoundRir && `${compoundRir} reps in reserve on compounds`,
      isolationRir && `${isolationRir} on isolation`,
    ]
      .filter(Boolean)
      .join(", ") || "1–3 reps in reserve";

  return {
    days: program.workouts.map((workout) => ({
      name: workout.name,
      editHref: `/programs/${workout.id}`,
      slots: workout.exercises.map((slot) => ({
        exercise: slot.exercise.name,
        sets: slot.baseSets,
        repMin: slot.repRangeMin,
        repMax: slot.repRangeMax,
        isPerSide: slot.isPerSide,
      })),
    })),
    block2AddSets,
    block3AddSets,
    volumeByPhase: [
      computeVolume(draft, catalog, 1),
      computeVolume(draft, catalog, 2),
      computeVolume(draft, catalog, 3),
    ],
    effortText,
  };
}

export async function getProgramWorkout(id: string) {
  const userId = await requireUserId();
  const [workout, exercises] = await Promise.all([
    prisma.workoutTemplate.findFirst({
      where: { id, program: { ownerId: userId } },
      include: { program: true, exercises: { orderBy: { sortOrder: "asc" }, include: { exercise: true } } },
    }),
    prisma.exercise.findMany({ where: visibleExerciseWhere(userId), orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { workout, exercises };
}
