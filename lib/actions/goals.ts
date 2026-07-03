"use server";

/**
 * lib/actions/goals.ts — goal write layer (server actions).
 * One goal per slot (type, or type+measurementField), enforced here since
 * SQLite treats NULLs as distinct in the compound unique index.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { localToday } from "@/lib/dates";
import { GoalType } from "@/lib/generated/prisma/enums";
import {
  GOAL_TYPE_META,
  MEASUREMENT_FIELD_LABELS,
} from "@/components/goals/goal-meta";

export interface GoalActionState {
  ok: boolean;
  error?: string;
}

function parseNum(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Create or edit a goal. Pass `id` to edit; otherwise upserts by (type, field). */
export async function saveGoal(
  _prev: GoalActionState,
  formData: FormData
): Promise<GoalActionState> {
  const id = String(formData.get("id") ?? "").trim() || null;

  const type = String(formData.get("type") ?? "");
  if (!Object.values(GoalType).includes(type as GoalType)) {
    return { ok: false, error: "Pick a goal type." };
  }
  const goalType = type as GoalType;

  let measurementField: string | null = null;
  if (goalType === "MEASUREMENT") {
    measurementField = String(formData.get("measurementField") ?? "");
    if (!MEASUREMENT_FIELD_LABELS[measurementField]) {
      return { ok: false, error: "Pick which measurement to target." };
    }
  }

  const startValue = parseNum(formData.get("startValue"));
  const targetValue = parseNum(formData.get("targetValue"));
  if (startValue == null || startValue < 0) return { ok: false, error: "Enter a valid starting value." };
  if (targetValue == null || targetValue <= 0) return { ok: false, error: "Enter a valid target value." };
  if (targetValue === startValue) {
    return { ok: false, error: "Target must differ from the starting value." };
  }

  const targetDate = String(formData.get("targetDate") ?? "").trim() || null;
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return { ok: false, error: "Target date must be a valid date." };
  }
  if (targetDate && targetDate <= localToday()) {
    return { ok: false, error: "Target date must be in the future." };
  }

  const meta = GOAL_TYPE_META[goalType];
  const label =
    goalType === "MEASUREMENT"
      ? MEASUREMENT_FIELD_LABELS[measurementField as string]
      : meta.label;
  const unit = goalType === "MEASUREMENT" ? "in" : meta.unit;

  const data = {
    type: goalType,
    measurementField,
    label,
    unit,
    startValue,
    targetValue,
    targetDate,
    achievedAt: null, // re-derived against the new target
  };

  // One goal per slot: match by id when editing, else by (type, field).
  const existing = id
    ? await prisma.goal.findUnique({ where: { id } })
    : await prisma.goal.findFirst({ where: { type: goalType, measurementField } });

  if (id && !existing) return { ok: false, error: "Goal not found." };

  if (!id && existing) {
    return {
      ok: false,
      error: `A ${label} goal already exists — edit it instead.`,
    };
  }

  // When editing, block collisions with another goal in the same slot.
  if (id) {
    const clash = await prisma.goal.findFirst({
      where: { type: goalType, measurementField, NOT: { id } },
    });
    if (clash) return { ok: false, error: `A ${label} goal already exists.` };
  }

  if (existing) {
    await prisma.goal.update({ where: { id: existing.id }, data });
  } else {
    await prisma.goal.create({ data });
  }

  revalidatePath("/goals");
  return { ok: true };
}

/** Mark a goal achieved today (celebration state persists even if values drift). */
export async function markGoalAchieved(goalId: string): Promise<GoalActionState> {
  try {
    await prisma.goal.update({ where: { id: goalId }, data: { achievedAt: localToday() } });
  } catch {
    return { ok: false, error: "Goal not found." };
  }
  revalidatePath("/goals");
  return { ok: true };
}

export async function deleteGoal(goalId: string): Promise<GoalActionState> {
  try {
    await prisma.goal.delete({ where: { id: goalId } });
  } catch {
    return { ok: false, error: "Goal not found." };
  }
  revalidatePath("/goals");
  return { ok: true };
}
