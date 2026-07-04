"use server";

/**
 * lib/actions/tracking.ts — server actions (write layer) for body tracking:
 * measurements, nutrition, recovery, photo deletion.
 * Photo *upload* is the one route-handler exception (app/api/photos/route.ts).
 */
import { revalidatePath } from "next/cache";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { recoveryScore, isFatigued } from "@/lib/recovery";
import { fatigueWarningNotification } from "@/lib/notifications";

export interface ActionState {
  ok: boolean;
  error?: string;
  /** Bumped on every successful save so clients can react (e.g. reset form). */
  savedAt?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(formData: FormData): string | null {
  const raw = String(formData.get("date") ?? "").trim();
  return DATE_RE.test(raw) ? raw : null;
}

/** "" → null; otherwise a finite non-negative number (else undefined = invalid). */
function parseNum(
  formData: FormData,
  name: string,
  opts: { int?: boolean; max?: number } = {},
): number | null | undefined {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  if (opts.max != null && n > opts.max) return undefined;
  return opts.int ? Math.round(n) : n;
}

function parseNotes(formData: FormData): string | null {
  const raw = String(formData.get("notes") ?? "").trim();
  return raw === "" ? null : raw.slice(0, 1000);
}

// ---------------------------------------------------------------- measurements

const MEASUREMENT_FIELDS = [
  "weight",
  "bodyFat",
  "waist",
  "chest",
  "shoulders",
  "leftArm",
  "rightArm",
  "leftForearm",
  "rightForearm",
  "leftThigh",
  "rightThigh",
  "leftCalf",
  "rightCalf",
  "neck",
] as const;

export async function saveMeasurement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const date = parseDate(formData);
  if (!date) return { ok: false, error: "Pick a valid date." };

  const data: Record<string, number | string | null> = {};
  let anyValue = false;
  for (const field of MEASUREMENT_FIELDS) {
    const max = field === "bodyFat" ? 100 : 2000;
    const v = parseNum(formData, field, { max });
    if (v === undefined) return { ok: false, error: `Invalid value for ${field}.` };
    data[field] = v;
    if (v != null) anyValue = true;
  }
  if (!anyValue) return { ok: false, error: "Enter at least one measurement." };
  data.notes = parseNotes(formData);

  await prisma.bodyMeasurement.upsert({
    where: { userId_date: { userId, date } },
    update: data,
    create: { userId, date, ...data },
  });

  revalidatePath("/measurements");
  revalidatePath("/");
  return { ok: true, savedAt: Date.now() };
}

// ---------------------------------------------------------------- nutrition

export async function saveNutrition(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const date = parseDate(formData);
  if (!date) return { ok: false, error: "Pick a valid date." };

  const fields = ["calories", "protein", "carbs", "fat", "fiber", "waterOz"] as const;
  const data: Record<string, number | string | null> = {};
  let anyValue = false;
  for (const field of fields) {
    const v = parseNum(formData, field, { int: true, max: 100000 });
    if (v === undefined) return { ok: false, error: `Invalid value for ${field}.` };
    data[field] = v;
    if (v != null) anyValue = true;
  }
  if (!anyValue) return { ok: false, error: "Enter at least one value." };
  data.notes = parseNotes(formData);

  await prisma.nutritionLog.upsert({
    where: { userId_date: { userId, date } },
    update: data,
    create: { userId, date, ...data },
  });

  revalidatePath("/nutrition");
  revalidatePath("/");
  return { ok: true, savedAt: Date.now() };
}

// ---------------------------------------------------------------- recovery

export async function saveRecovery(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const date = parseDate(formData);
  if (!date) return { ok: false, error: "Pick a valid date." };

  const sleepHours = parseNum(formData, "sleepHours", { max: 24 });
  if (sleepHours === undefined) return { ok: false, error: "Invalid sleep hours." };

  const ratingFields = [
    "sleepQuality",
    "stress",
    "energy",
    "motivation",
    "workoutDifficulty",
    "soreness",
  ] as const;
  const ratings: Record<string, number | null> = {};
  for (const field of ratingFields) {
    const v = parseNum(formData, field, { int: true, max: 5 });
    if (v === undefined || (v != null && v < 1)) {
      return { ok: false, error: `Invalid value for ${field}.` };
    }
    ratings[field] = v;
  }

  const anyValue = sleepHours != null || ratingFields.some((f) => ratings[f] != null);
  if (!anyValue) return { ok: false, error: "Answer at least one question." };

  const score = recoveryScore({
    sleepHours,
    sleepQuality: ratings.sleepQuality,
    stress: ratings.stress,
    energy: ratings.energy,
    motivation: ratings.motivation,
    workoutDifficulty: ratings.workoutDifficulty,
    soreness: ratings.soreness,
  });

  const data = { sleepHours, ...ratings, score, notes: parseNotes(formData) };

  await prisma.recoveryLog.upsert({
    where: { userId_date: { userId, date } },
    update: data,
    create: { userId, date, ...data },
  });

  // Low score → fatigue warning notification (idempotent via dedupeKey).
  if (isFatigued(score) && score != null) {
    const candidate = fatigueWarningNotification(userId, date, score);
    const existingNotification = await prisma.notification.findUnique({
      where: { userId_dedupeKey: { userId, dedupeKey: candidate.dedupeKey } },
    });
    if (!existingNotification) {
      await prisma.notification.create({ data: candidate });
    }
  }

  revalidatePath("/recovery");
  revalidatePath("/");
  return { ok: true, savedAt: Date.now() };
}

// ---------------------------------------------------------------- photos

export async function deletePhoto(photoId: string): Promise<ActionState> {
  const userId = await requireUserId();
  const photo = await prisma.progressPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.userId !== userId) return { ok: false, error: "Photo not found." };

  await prisma.progressPhoto.delete({ where: { id: photoId } });

  // Remove the file — only ever touch files inside public/photos.
  const photosDir = path.join(process.cwd(), "public", "photos");
  const abs = path.resolve(path.join(process.cwd(), "public", photo.filePath));
  if (abs.startsWith(photosDir + path.sep)) {
    try {
      await unlink(abs);
    } catch {
      // File already gone — the DB row is the source of truth.
    }
  }

  revalidatePath("/photos");
  return { ok: true, savedAt: Date.now() };
}
