"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import {
  cloneBuiltInProgram,
  isOwnedProgram,
  isOwnedSlot,
  isOwnedWorkout,
  isVisibleExercise,
} from "@/lib/program-access";

function refresh() {
  revalidatePath("/programs");
  revalidatePath("/workout");
  revalidatePath("/");
}

export async function createProgram(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Program name must be 2–80 characters");
  await prisma.program.create({ data: { name, ownerId: userId, description: String(formData.get("description") ?? "").trim() || null } });
  refresh();
}

export async function activateProgram(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("programId") ?? "");
  if (!id) throw new Error("Program is required");
  const owned = await isOwnedProgram(userId, id);
  const activeProgramId = owned ? id : await cloneBuiltInProgram(userId, id);
  if (!activeProgramId) throw new Error("Program not found");
  await prisma.appSettings.update({ where: { userId }, data: { activeProgramId } });
  refresh();
}

export async function addWorkout(formData: FormData) {
  const userId = await requireUserId();
  const programId = String(formData.get("programId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!programId || name.length < 2) throw new Error("Program and workout name are required");
  if (!(await isOwnedProgram(userId, programId))) throw new Error("Program not found");
  const count = await prisma.workoutTemplate.count({ where: { programId } });
  await prisma.workoutTemplate.create({ data: { programId, name, dayNumber: count + 1, sortOrder: count } });
  refresh();
}

export async function updateWorkout(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("workoutId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || name.length < 2) throw new Error("Workout name is required");
  if (!(await isOwnedWorkout(userId, id))) throw new Error("Workout not found");
  await prisma.workoutTemplate.update({ where: { id }, data: { name } });
  refresh();
}

export async function updateProgramExercise(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("slotId") ?? "");
  const baseSets = Number(formData.get("sets"));
  const repRangeMin = Number(formData.get("repMin"));
  const repRangeMax = Number(formData.get("repMax"));
  if (!id || !Number.isInteger(baseSets) || baseSets < 1 || repRangeMin < 1 || repRangeMax < repRangeMin) {
    throw new Error("Invalid exercise targets");
  }
  if (!(await isOwnedSlot(userId, id))) throw new Error("Program slot not found");
  await prisma.templateExercise.update({ where: { id }, data: { baseSets, repRangeMin, repRangeMax } });
  refresh();
}

export async function updateWorkoutDetails(formData: FormData) {
  const userId = await requireUserId();
  const workoutId = String(formData.get("workoutId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slotIds = formData.getAll("slotId").map(String);
  if (!workoutId || name.length < 2) throw new Error("Workout name is required");
  if (!(await isOwnedWorkout(userId, workoutId))) throw new Error("Workout not found");
  for (let index = 0; index < slotIds.length; index++) {
    if (!(await isOwnedSlot(userId, slotIds[index]))) throw new Error("Program slot not found");
    const exerciseId = String(formData.get(`exercise-${index}`) ?? "");
    if (!(await isVisibleExercise(userId, exerciseId))) throw new Error("Exercise not found");
  }
  const updates = slotIds.map((slotId, index) => {
    const exerciseId = String(formData.get(`exercise-${index}`) ?? "");
    const baseSets = Number(formData.get(`sets-${index}`));
    const repRangeMin = Number(formData.get(`repMin-${index}`));
    const repRangeMax = Number(formData.get(`repMax-${index}`));
    if (!exerciseId || !Number.isInteger(baseSets) || baseSets < 1 || repRangeMin < 1 || repRangeMax < repRangeMin) {
      throw new Error(`Invalid targets for exercise ${index + 1}`);
    }
    return prisma.templateExercise.update({
      where: { id: slotId },
      data: { exerciseId, baseSets, repRangeMin, repRangeMax },
    });
  });
  await prisma.$transaction([prisma.workoutTemplate.update({ where: { id: workoutId }, data: { name } }), ...updates]);
  refresh();
}

export async function addProgramExercise(formData: FormData) {
  const userId = await requireUserId();
  const workoutId = String(formData.get("workoutId") ?? "");
  const exerciseId = String(formData.get("exerciseId") ?? "");
  if (!workoutId || !exerciseId) throw new Error("Workout and exercise are required");
  if (!(await isOwnedWorkout(userId, workoutId))) throw new Error("Workout not found");
  if (!(await isVisibleExercise(userId, exerciseId))) throw new Error("Exercise not found");
  const last = await prisma.templateExercise.findFirst({ where: { templateId: workoutId }, orderBy: { sortOrder: "desc" } });
  await prisma.templateExercise.create({
    data: {
      templateId: workoutId, exerciseId, sortOrder: (last?.sortOrder ?? -1) + 1,
      baseSets: 3, repRangeMin: 8, repRangeMax: 12,
      targetRirMin: 1, targetRirMax: 2, restSeconds: 120,
    },
  });
  refresh();
}
