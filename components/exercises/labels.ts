/**
 * Display labels for exercise enums. Plain data — safe to import from both
 * server and client components.
 */
import type {
  Difficulty,
  Equipment,
  ExerciseType,
  MuscleGroup,
} from "@/lib/generated/prisma/enums";

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  CHEST: "Chest",
  UPPER_CHEST: "Upper Chest",
  BACK: "Back",
  LATS: "Lats",
  FRONT_DELTS: "Front Delts",
  LATERAL_DELTS: "Lateral Delts",
  REAR_DELTS: "Rear Delts",
  TRICEPS: "Triceps",
  BICEPS: "Biceps",
  FOREARMS: "Forearms",
  QUADS: "Quads",
  HAMSTRINGS: "Hamstrings",
  GLUTES: "Glutes",
  CALVES: "Calves",
  CORE: "Core",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  BARBELL: "Barbell",
  DUMBBELL: "Dumbbell",
  MACHINE: "Machine",
  CABLE: "Cable",
  BODYWEIGHT: "Bodyweight",
};

export const TYPE_LABELS: Record<ExerciseType, string> = {
  HEAVY_COMPOUND: "Heavy Compound",
  COMPOUND: "Compound",
  MACHINE_COMPOUND: "Machine Compound",
  ISOLATION: "Isolation",
  CORE: "Core",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** ISO day (1=Mon..7=Sun) → short name. */
export function dayName(isoDay: number): string {
  return DAY_NAMES[isoDay] ?? "";
}
