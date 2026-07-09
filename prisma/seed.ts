/**
 * Seed — Program v1.0 (docs/PROGRAM.md) per docs/ARCHITECTURE.md §3.
 * Idempotent: upserts by natural keys. Run: npm run db:seed
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../lib/generated/prisma/client";
import type {
  Equipment,
  ExerciseType,
  MuscleGroup,
  Priority,
} from "../lib/generated/prisma/enums";

const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

// ---------- Program constants (ARCHITECTURE.md §3.3–3.4) ----------

const REST_BY_TYPE: Record<ExerciseType, number> = {
  HEAVY_COMPOUND: 180,
  COMPOUND: 150,
  MACHINE_COMPOUND: 105,
  ISOLATION: 75,
  CORE: 60,
};

const RIR_BY_TYPE: Record<ExerciseType, { min: number; max: number }> = {
  HEAVY_COMPOUND: { min: 1, max: 2 },
  COMPOUND: { min: 1, max: 2 },
  MACHINE_COMPOUND: { min: 1, max: 2 },
  ISOLATION: { min: 0, max: 1 },
  CORE: { min: 0, max: 1 },
};

// ---------- Exercise library ----------

type ExerciseSeed = {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  weightIncrement?: number; // default 5
  isBodyweight?: boolean;
  notes?: string;
};

const EXERCISES: ExerciseSeed[] = [
  // Monday — Push Dominant Upper
  { name: "Bench Press", primaryMuscle: "CHEST", secondaryMuscles: ["FRONT_DELTS", "TRICEPS"], equipment: "BARBELL", type: "HEAVY_COMPOUND" },
  { name: "Incline Dumbbell Press", primaryMuscle: "UPPER_CHEST", secondaryMuscles: ["FRONT_DELTS", "TRICEPS"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Chest Supported Row", primaryMuscle: "BACK", secondaryMuscles: ["LATS", "REAR_DELTS", "BICEPS"], equipment: "MACHINE", type: "MACHINE_COMPOUND" },
  { name: "Neutral Grip Lat Pulldown", primaryMuscle: "LATS", secondaryMuscles: ["BACK", "BICEPS"], equipment: "CABLE", type: "MACHINE_COMPOUND" },
  { name: "Seated Dumbbell Shoulder Press", primaryMuscle: "FRONT_DELTS", secondaryMuscles: ["LATERAL_DELTS", "TRICEPS"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Cable Lateral Raise", primaryMuscle: "LATERAL_DELTS", equipment: "CABLE", type: "ISOLATION", weightIncrement: 2.5 },
  { name: "Rope Pushdown", primaryMuscle: "TRICEPS", equipment: "CABLE", type: "ISOLATION", weightIncrement: 2.5 },
  { name: "Incline Dumbbell Curl", primaryMuscle: "BICEPS", secondaryMuscles: ["FOREARMS"], equipment: "DUMBBELL", type: "ISOLATION", weightIncrement: 2.5 },
  // Tuesday — Quad Dominant Lower
  { name: "Box Squat", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES", "HAMSTRINGS"], equipment: "BARBELL", type: "HEAVY_COMPOUND" },
  { name: "Leg Press", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES"], equipment: "MACHINE", type: "MACHINE_COMPOUND" },
  { name: "Bulgarian Split Squat", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES", "HAMSTRINGS"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Leg Extension", primaryMuscle: "QUADS", equipment: "MACHINE", type: "ISOLATION" },
  { name: "Standing Calf Raise", primaryMuscle: "CALVES", equipment: "MACHINE", type: "ISOLATION" },
  { name: "Cable Crunch", primaryMuscle: "CORE", equipment: "CABLE", type: "CORE" },
  // Thursday — Pull Dominant Upper
  { name: "Pull-ups", primaryMuscle: "LATS", secondaryMuscles: ["BACK", "BICEPS"], equipment: "BODYWEIGHT", type: "COMPOUND", isBodyweight: true },
  { name: "Machine Chest Press", primaryMuscle: "CHEST", secondaryMuscles: ["FRONT_DELTS", "TRICEPS"], equipment: "MACHINE", type: "MACHINE_COMPOUND" },
  { name: "Rear Delt Fly", primaryMuscle: "REAR_DELTS", equipment: "MACHINE", type: "ISOLATION", weightIncrement: 2.5 },
  { name: "Face Pull", primaryMuscle: "REAR_DELTS", secondaryMuscles: ["LATERAL_DELTS", "BACK"], equipment: "CABLE", type: "ISOLATION", weightIncrement: 2.5 },
  { name: "Preacher Curl", primaryMuscle: "BICEPS", secondaryMuscles: ["FOREARMS"], equipment: "MACHINE", type: "ISOLATION", weightIncrement: 2.5 },
  { name: "Overhead Rope Extension", primaryMuscle: "TRICEPS", equipment: "CABLE", type: "ISOLATION", weightIncrement: 2.5 },
  // Friday — Posterior Chain Lower
  { name: "Romanian Deadlift", primaryMuscle: "HAMSTRINGS", secondaryMuscles: ["GLUTES", "BACK"], equipment: "BARBELL", type: "HEAVY_COMPOUND" },
  { name: "Hack Squat", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES"], equipment: "MACHINE", type: "MACHINE_COMPOUND" },
  { name: "Lying Hamstring Curl", primaryMuscle: "HAMSTRINGS", equipment: "MACHINE", type: "ISOLATION" },
  { name: "Walking Lunges", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES", "HAMSTRINGS"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Seated Calf Raise", primaryMuscle: "CALVES", equipment: "MACHINE", type: "ISOLATION" },
  { name: "Hanging Knee Raise", primaryMuscle: "CORE", equipment: "BODYWEIGHT", type: "CORE", isBodyweight: true },
  // Named alternates
  { name: "Neutral Grip Pulldown", primaryMuscle: "LATS", secondaryMuscles: ["BACK", "BICEPS"], equipment: "CABLE", type: "MACHINE_COMPOUND" },
  { name: "Pendulum Squat", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES"], equipment: "MACHINE", type: "MACHINE_COMPOUND" },
  // Home-training alternatives
  { name: "Heel-Elevated Goblet Squat", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES"], equipment: "DUMBBELL", type: "COMPOUND", notes: "Home alternative to Leg Press; strong quad stimulus with less spinal loading." },
  { name: "Front Squat", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES", "CORE"], equipment: "BARBELL", type: "HEAVY_COMPOUND", notes: "Free-weight alternative to Hack Squat." },
  { name: "Safety Bar Squat", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES", "HAMSTRINGS"], equipment: "BARBELL", type: "HEAVY_COMPOUND", notes: "Free-weight alternative to Hack Squat." },
  { name: "Cable Leg Curl", primaryMuscle: "HAMSTRINGS", equipment: "CABLE", type: "ISOLATION", notes: "Use an ankle strap; home alternative to Lying Hamstring Curl." },
  { name: "Sliding Leg Curl", primaryMuscle: "HAMSTRINGS", secondaryMuscles: ["GLUTES"], equipment: "BODYWEIGHT", type: "ISOLATION", isBodyweight: true, notes: "Use towels or sliders; home alternative to Lying Hamstring Curl." },
  { name: "Nordic Curl (Assisted)", primaryMuscle: "HAMSTRINGS", secondaryMuscles: ["GLUTES"], equipment: "BODYWEIGHT", type: "COMPOUND", isBodyweight: true, notes: "Assisted Nordic curl; advanced home alternative to Lying Hamstring Curl." },
];

const ALTERNATIVES: Array<[string, string]> = [
  ["Pull-ups", "Neutral Grip Pulldown"],
  ["Hack Squat", "Pendulum Squat"],
  ["Leg Press", "Heel-Elevated Goblet Squat"],
  ["Hack Squat", "Front Squat"],
  ["Hack Squat", "Safety Bar Squat"],
  ["Lying Hamstring Curl", "Cable Leg Curl"],
  ["Lying Hamstring Curl", "Sliding Leg Curl"],
  ["Lying Hamstring Curl", "Nordic Curl (Assisted)"],
];

// ---------- Templates (PROGRAM.md day tables) ----------

type SlotSeed = {
  exercise: string;
  sets: number;
  repMin: number;
  repMax: number;
  priority?: Priority; // default NORMAL
  isPerSide?: boolean;
  notes?: string;
};

type TemplateSeed = { name: string; dayNumber: number; sortOrder: number; slots: SlotSeed[] };

const TEMPLATES: TemplateSeed[] = [
  {
    name: "Push Dominant Upper",
    dayNumber: 1,
    sortOrder: 0,
    slots: [
      { exercise: "Bench Press", sets: 3, repMin: 6, repMax: 8, priority: "HIGH" },
      { exercise: "Incline Dumbbell Press", sets: 3, repMin: 8, repMax: 10, priority: "HIGH" },
      { exercise: "Chest Supported Row", sets: 4, repMin: 8, repMax: 10, priority: "HIGH" },
      { exercise: "Neutral Grip Lat Pulldown", sets: 3, repMin: 10, repMax: 12, priority: "HIGH" },
      { exercise: "Seated Dumbbell Shoulder Press", sets: 3, repMin: 8, repMax: 10, priority: "MEDIUM" },
      { exercise: "Cable Lateral Raise", sets: 4, repMin: 12, repMax: 15, priority: "HIGHEST" },
      { exercise: "Rope Pushdown", sets: 3, repMin: 10, repMax: 12 },
      { exercise: "Incline Dumbbell Curl", sets: 3, repMin: 10, repMax: 12 },
    ],
  },
  {
    name: "Quad Dominant Lower",
    dayNumber: 2,
    sortOrder: 1,
    slots: [
      { exercise: "Box Squat", sets: 3, repMin: 6, repMax: 8, priority: "HIGH" },
      { exercise: "Leg Press", sets: 3, repMin: 10, repMax: 12 },
      { exercise: "Bulgarian Split Squat", sets: 3, repMin: 10, repMax: 10, isPerSide: true, notes: "10 each leg" },
      { exercise: "Leg Extension", sets: 3, repMin: 12, repMax: 15 },
      { exercise: "Standing Calf Raise", sets: 4, repMin: 12, repMax: 15 },
      { exercise: "Cable Crunch", sets: 3, repMin: 12, repMax: 15 },
    ],
  },
  {
    name: "Pull Dominant Upper",
    dayNumber: 3,
    sortOrder: 2,
    slots: [
      { exercise: "Pull-ups", sets: 4, repMin: 8, repMax: 10, priority: "HIGH", notes: "Alt: Neutral Grip Pulldown" },
      { exercise: "Chest Supported Row", sets: 3, repMin: 10, repMax: 12, notes: "Different grip than Monday" },
      { exercise: "Machine Chest Press", sets: 3, repMin: 10, repMax: 12 },
      { exercise: "Rear Delt Fly", sets: 4, repMin: 12, repMax: 15 },
      { exercise: "Cable Lateral Raise", sets: 4, repMin: 12, repMax: 15, priority: "HIGHEST" },
      { exercise: "Face Pull", sets: 3, repMin: 12, repMax: 15 },
      { exercise: "Preacher Curl", sets: 3, repMin: 10, repMax: 12 },
      { exercise: "Overhead Rope Extension", sets: 3, repMin: 10, repMax: 12 },
    ],
  },
  {
    name: "Posterior Chain Lower",
    dayNumber: 4,
    sortOrder: 3,
    slots: [
      { exercise: "Romanian Deadlift", sets: 3, repMin: 8, repMax: 10, priority: "HIGH" },
      { exercise: "Hack Squat", sets: 3, repMin: 10, repMax: 12, notes: "Alt: Pendulum Squat" },
      { exercise: "Lying Hamstring Curl", sets: 4, repMin: 10, repMax: 12 },
      { exercise: "Walking Lunges", sets: 2, repMin: 12, repMax: 12, isPerSide: true, notes: "12 each leg" },
      { exercise: "Seated Calf Raise", sets: 4, repMin: 12, repMax: 15 },
      { exercise: "Hanging Knee Raise", sets: 3, repMin: 10, repMax: 15 },
    ],
  },
];

// Block overrides: [program day number, exerciseName] pairs.
const BLOCK2_ADD_SET: Array<[number, string]> = [
  [1, "Bench Press"],
  [1, "Incline Dumbbell Press"],
  [1, "Chest Supported Row"],
  [2, "Box Squat"],
  [2, "Leg Press"],
  [3, "Pull-ups"],
  [4, "Romanian Deadlift"],
];

const BLOCK3_ADD_SET: Array<[number, string]> = [
  [1, "Incline Dumbbell Press"],
  [1, "Cable Lateral Raise"],
  [1, "Chest Supported Row"],
  [1, "Neutral Grip Lat Pulldown"],
  [1, "Rope Pushdown"],
  [1, "Incline Dumbbell Curl"],
  [3, "Rear Delt Fly"],
  [3, "Cable Lateral Raise"],
  [3, "Pull-ups"],
];

// ---------- Local-date helpers (mirror lib/dates.ts; seed stays standalone) ----------

// ---------- Main ----------

async function main() {
  // Catalog-only seed: per-user rows (AppSettings, TrainingBlock) are created
  // by signup provisioning (lib/provision.ts), never seeded.

  // 2. Exercises
  const exerciseIdByName = new Map<string, string>();
  for (const ex of EXERCISES) {
    const data = {
      primaryMuscle: ex.primaryMuscle,
      secondaryMuscles: JSON.stringify(ex.secondaryMuscles ?? []),
      equipment: ex.equipment,
      type: ex.type,
      weightIncrement: ex.weightIncrement ?? 5,
      isBodyweight: ex.isBodyweight ?? false,
      notes: ex.notes ?? null,
    };
    const row = await prisma.exercise.upsert({
      where: { name: ex.name },
      update: data,
      create: { name: ex.name, ...data },
    });
    exerciseIdByName.set(ex.name, row.id);
  }

  // 2b. ExerciseAlternative links
  for (const [forName, altName] of ALTERNATIVES) {
    const exerciseId = exerciseIdByName.get(forName)!;
    const alternativeId = exerciseIdByName.get(altName)!;
    await prisma.exerciseAlternative.upsert({
      where: { exerciseId_alternativeId: { exerciseId, alternativeId } },
      update: {},
      create: { exerciseId, alternativeId },
    });
  }

  // 5. Program + ordered templates + slots
  const program = await prisma.program.upsert({
    where: { name: "UPPER / LOWER" },
    update: { description: "Four-day upper/lower hypertrophy program" },
    create: { name: "UPPER / LOWER", description: "Four-day upper/lower hypertrophy program" },
  });
  // Remove only unattached legacy templates that have no workout history.
  await prisma.workoutTemplate.deleteMany({
    where: { programId: null, sessions: { none: {} } },
  });

  const typeByName = new Map(EXERCISES.map((e) => [e.name, e.type]));
  const slotIdByDayAndName = new Map<string, string>();

  for (const tpl of TEMPLATES) {
    const template = await prisma.workoutTemplate.upsert({
      where: { programId_dayNumber: { programId: program.id, dayNumber: tpl.dayNumber } },
      update: { name: tpl.name, sortOrder: tpl.sortOrder },
      create: { name: tpl.name, programId: program.id, dayNumber: tpl.dayNumber, sortOrder: tpl.sortOrder, isActive: true },
    });

    for (let i = 0; i < tpl.slots.length; i++) {
      const slot = tpl.slots[i];
      const type = typeByName.get(slot.exercise)!;
      const rir = RIR_BY_TYPE[type];
      const data = {
        exerciseId: exerciseIdByName.get(slot.exercise)!,
        baseSets: slot.sets,
        repRangeMin: slot.repMin,
        repRangeMax: slot.repMax,
        targetRirMin: rir.min,
        targetRirMax: rir.max,
        priority: slot.priority ?? ("NORMAL" as Priority),
        restSeconds: REST_BY_TYPE[type],
        isPerSide: slot.isPerSide ?? false,
        notes: slot.notes ?? null,
      };
      const row = await prisma.templateExercise.upsert({
        where: { templateId_sortOrder: { templateId: template.id, sortOrder: i } },
        update: data,
        create: { templateId: template.id, sortOrder: i, ...data },
      });
      slotIdByDayAndName.set(`${tpl.dayNumber}:${slot.exercise}`, row.id);
    }
  }

  // 6. Block overrides
  for (const [blockNumber, pairs] of [
    [2, BLOCK2_ADD_SET],
    [3, BLOCK3_ADD_SET],
  ] as const) {
    for (const [day, name] of pairs) {
      const templateExerciseId = slotIdByDayAndName.get(`${day}:${name}`);
      if (!templateExerciseId) throw new Error(`No slot for day ${day} ${name}`);
      await prisma.blockOverride.upsert({
        where: { templateExerciseId_blockNumber: { templateExerciseId, blockNumber } },
        update: { addSets: 1 },
        create: { templateExerciseId, blockNumber, addSets: 1 },
      });
    }
  }

  // ---- Verification summary ----
  const [exercises, alternatives, templates, slots, overrides] = await Promise.all([
    prisma.exercise.count(),
    prisma.exerciseAlternative.count(),
    prisma.workoutTemplate.count(),
    prisma.templateExercise.count(),
    prisma.blockOverride.count(),
  ]);
  console.log("Seed complete:");
  console.log(`  exercises:            ${exercises}`);
  console.log(`  exercise alternatives:${alternatives}`);
  console.log(`  workout templates:    ${templates}`);
  console.log(`  template slots:       ${slots}`);
  console.log(`  block overrides:      ${overrides}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
