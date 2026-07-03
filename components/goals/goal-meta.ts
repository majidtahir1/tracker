/**
 * Shared goal metadata — plain data, safe for server, client, and actions.
 */
import type { GoalType } from "@/lib/generated/prisma/enums";

export const GOAL_TYPE_META: Record<GoalType, { label: string; unit: string }> = {
  BODY_WEIGHT: { label: "Body Weight", unit: "lb" },
  BODY_FAT: { label: "Body Fat", unit: "%" },
  BENCH_1RM: { label: "Bench Press e1RM", unit: "lb" },
  SQUAT_1RM: { label: "Box Squat e1RM", unit: "lb" },
  DEADLIFT_1RM: { label: "Romanian Deadlift e1RM", unit: "lb" },
  SHOULDER_PRESS_1RM: { label: "Shoulder Press e1RM", unit: "lb" },
  MEASUREMENT: { label: "Measurement", unit: "in" },
};

/** Exercise name each 1RM goal type reads its current e1RM from. */
export const GOAL_EXERCISE_NAMES: Partial<Record<GoalType, string>> = {
  BENCH_1RM: "Bench Press",
  SQUAT_1RM: "Box Squat",
  DEADLIFT_1RM: "Romanian Deadlift",
  SHOULDER_PRESS_1RM: "Seated Dumbbell Shoulder Press",
};

/** Measurement fields a MEASUREMENT goal can target (BodyMeasurement columns). */
export const MEASUREMENT_FIELD_LABELS: Record<string, string> = {
  waist: "Waist",
  chest: "Chest",
  shoulders: "Shoulders",
  leftArm: "Left Arm",
  rightArm: "Right Arm",
  leftForearm: "Left Forearm",
  rightForearm: "Right Forearm",
  leftThigh: "Left Thigh",
  rightThigh: "Right Thigh",
  leftCalf: "Left Calf",
  rightCalf: "Right Calf",
  neck: "Neck",
};

/** Stable key for a goal slot: the type, or "MEASUREMENT:waist". */
export function goalKey(type: GoalType, measurementField: string | null): string {
  return type === "MEASUREMENT" ? `MEASUREMENT:${measurementField}` : type;
}
