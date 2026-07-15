import { prisma } from "@/lib/db";

export const visibleProgramWhere = (userId: string) => ({
  OR: [{ ownerId: userId }, { isBuiltIn: true }],
});

export const visibleExerciseWhere = (userId: string) => ({
  OR: [{ ownerId: userId }, { isBuiltIn: true }],
});

export async function isOwnedProgram(userId: string, programId: string): Promise<boolean> {
  return Boolean(await prisma.program.findFirst({ where: { id: programId, ownerId: userId }, select: { id: true } }));
}

export async function isOwnedWorkout(userId: string, workoutId: string): Promise<boolean> {
  return Boolean(await prisma.workoutTemplate.findFirst({
    where: { id: workoutId, program: { ownerId: userId } },
    select: { id: true },
  }));
}

export async function isOwnedSlot(userId: string, slotId: string): Promise<boolean> {
  return Boolean(await prisma.templateExercise.findFirst({
    where: { id: slotId, template: { program: { ownerId: userId } } },
    select: { id: true },
  }));
}

export async function isVisibleExercise(userId: string, exerciseId: string): Promise<boolean> {
  return Boolean(await prisma.exercise.findFirst({
    where: { id: exerciseId, ...visibleExerciseWhere(userId) },
    select: { id: true },
  }));
}

/** Clone an immutable starter into a user-owned program. */
export async function cloneBuiltInProgram(userId: string, programId: string): Promise<string | null> {
  const source = await prisma.program.findFirst({
    // Built-ins and pre-ownership legacy rows are safe cloning sources. A
    // program owned by another user must never be cloneable by ID.
    where: { id: programId, OR: [{ isBuiltIn: true }, { ownerId: null }] },
    include: {
      workouts: {
        orderBy: { sortOrder: "asc" },
        include: { exercises: { orderBy: { sortOrder: "asc" }, include: { blockOverrides: true } } },
      },
    },
  });
  if (!source) return null;

  return prisma.$transaction(async (tx) => {
    let name = `${source.name} — My Copy`;
    let suffix = 2;
    while (await tx.program.findUnique({ where: { name }, select: { id: true } })) {
      name = `${source.name} — My Copy ${suffix++}`;
    }
    const program = await tx.program.create({
      data: { name, description: source.description, ownerId: userId },
    });
    for (const workout of source.workouts) {
      const createdWorkout = await tx.workoutTemplate.create({
        data: {
          programId: program.id,
          name: workout.name,
          dayNumber: workout.dayNumber,
          sortOrder: workout.sortOrder,
          isActive: workout.isActive,
        },
      });
      for (const slot of workout.exercises) {
        const createdSlot = await tx.templateExercise.create({
          data: {
            templateId: createdWorkout.id,
            exerciseId: slot.exerciseId,
            sortOrder: slot.sortOrder,
            baseSets: slot.baseSets,
            repRangeMin: slot.repRangeMin,
            repRangeMax: slot.repRangeMax,
            targetRirMin: slot.targetRirMin,
            targetRirMax: slot.targetRirMax,
            priority: slot.priority,
            restSeconds: slot.restSeconds,
            isPerSide: slot.isPerSide,
            notes: slot.notes,
          },
        });
        if (slot.blockOverrides.length) {
          await tx.blockOverride.createMany({
            data: slot.blockOverrides.map((override) => ({
              templateExerciseId: createdSlot.id,
              blockNumber: override.blockNumber,
              addSets: override.addSets,
            })),
          });
        }
      }
    }
    return program.id;
  });
}
