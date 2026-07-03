"use server";

/**
 * lib/actions/exercises.ts — exercise write layer (server actions).
 * toggleFavorite, updateExercise (notes/video/flags), createExercise
 * (custom exercises), substituteExercise (history-preserving slot swap).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { localToday } from "@/lib/dates";
import {
  Difficulty,
  Equipment,
  ExerciseType,
  MuscleGroup,
} from "@/lib/generated/prisma/enums";

export interface ExerciseActionState {
  ok: boolean;
  error?: string;
}

function isEnumValue<T extends Record<string, string>>(e: T, v: string): v is T[keyof T] {
  return Object.values(e).includes(v);
}

function cleanUrl(raw: FormDataEntryValue | null): string | null | { error: string } {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { error: "Video link must be an http(s) URL." };
    }
    return value;
  } catch {
    return { error: "Video link must be a valid URL." };
  }
}

/** Star/unstar an exercise from the library grid or detail header. */
export async function toggleFavorite(exerciseId: string): Promise<void> {
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return;
  await prisma.exercise.update({
    where: { id: exerciseId },
    data: { isFavorite: !exercise.isFavorite },
  });
  revalidatePath("/exercises");
  revalidatePath(`/exercises/${exerciseId}`);
}

/** Edit form on the detail page: notes, video link, favorite, injury-friendly. */
export async function updateExercise(
  _prev: ExerciseActionState,
  formData: FormData
): Promise<ExerciseActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing exercise id." };

  const videoUrl = cleanUrl(formData.get("videoUrl"));
  if (videoUrl !== null && typeof videoUrl === "object") return { ok: false, error: videoUrl.error };

  const notes = String(formData.get("notes") ?? "").trim() || null;

  try {
    await prisma.exercise.update({
      where: { id },
      data: {
        notes,
        videoUrl,
        isFavorite: formData.get("isFavorite") === "on",
        injuryFriendly: formData.get("injuryFriendly") === "on",
      },
    });
  } catch {
    return { ok: false, error: "Could not save — exercise not found." };
  }

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${id}`);
  return { ok: true };
}

/** Add-custom-exercise form on the library page. Redirects to the new detail page. */
export async function createExercise(
  _prev: ExerciseActionState,
  formData: FormData
): Promise<ExerciseActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Name must be at least 2 characters." };

  const primaryMuscle = String(formData.get("primaryMuscle") ?? "");
  if (!isEnumValue(MuscleGroup, primaryMuscle)) {
    return { ok: false, error: "Pick a primary muscle group." };
  }
  const equipment = String(formData.get("equipment") ?? "");
  if (!isEnumValue(Equipment, equipment)) return { ok: false, error: "Pick the equipment." };

  const type = String(formData.get("type") ?? "");
  if (!isEnumValue(ExerciseType, type)) return { ok: false, error: "Pick an exercise type." };

  const difficulty = String(formData.get("difficulty") ?? "INTERMEDIATE");
  if (!isEnumValue(Difficulty, difficulty)) return { ok: false, error: "Invalid difficulty." };

  const secondaryMuscles = formData
    .getAll("secondaryMuscles")
    .map(String)
    .filter((m): m is MuscleGroup => isEnumValue(MuscleGroup, m) && m !== primaryMuscle);

  const weightIncrement = formData.get("weightIncrement") === "2.5" ? 2.5 : 5;

  const videoUrl = cleanUrl(formData.get("videoUrl"));
  if (videoUrl !== null && typeof videoUrl === "object") return { ok: false, error: videoUrl.error };

  const existing = await prisma.exercise.findUnique({ where: { name } });
  if (existing) return { ok: false, error: `"${name}" already exists in the library.` };

  const created = await prisma.exercise.create({
    data: {
      name,
      primaryMuscle,
      secondaryMuscles: JSON.stringify(secondaryMuscles),
      equipment,
      type,
      difficulty,
      weightIncrement,
      isBodyweight: formData.get("isBodyweight") === "on",
      injuryFriendly: formData.get("injuryFriendly") === "on",
      videoUrl,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidatePath("/exercises");
  redirect(`/exercises/${created.id}`);
}

/**
 * History-preserving substitution: repoints the template slot at a new
 * exercise (the slot id — and with it all progression history — is stable)
 * and records a SubstitutionEvent for the audit trail.
 */
export async function substituteExercise(
  templateExerciseId: string,
  newExerciseId: string,
  reason?: string
): Promise<ExerciseActionState> {
  const slot = await prisma.templateExercise.findUnique({ where: { id: templateExerciseId } });
  if (!slot) return { ok: false, error: "Program slot not found." };
  if (slot.exerciseId === newExerciseId) return { ok: false, error: "Already using that exercise." };

  const newExercise = await prisma.exercise.findUnique({ where: { id: newExerciseId } });
  if (!newExercise) return { ok: false, error: "Replacement exercise not found." };

  await prisma.$transaction([
    prisma.templateExercise.update({
      where: { id: templateExerciseId },
      data: { exerciseId: newExerciseId },
    }),
    prisma.substitutionEvent.create({
      data: {
        templateExerciseId,
        oldExerciseId: slot.exerciseId,
        newExerciseId,
        reason: reason?.trim() || null,
        date: localToday(),
      },
    }),
  ]);

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${slot.exerciseId}`);
  revalidatePath(`/exercises/${newExerciseId}`);
  revalidatePath("/workout");
  return { ok: true };
}
