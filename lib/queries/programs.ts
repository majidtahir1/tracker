import { prisma } from "@/lib/db";

export async function getPrograms() {
  return prisma.program.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    include: {
      workouts: {
        orderBy: { dayNumber: "asc" },
        include: { exercises: { orderBy: { sortOrder: "asc" }, include: { exercise: true } } },
      },
    },
  });
}

export async function getProgramWorkout(id: string) {
  const [workout, exercises] = await Promise.all([
    prisma.workoutTemplate.findUnique({
      where: { id },
      include: { program: true, exercises: { orderBy: { sortOrder: "asc" }, include: { exercise: true } } },
    }),
    prisma.exercise.findMany({ where: {}, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { workout, exercises };
}
