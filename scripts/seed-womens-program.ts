/**
 * Seed — Women's Beginner Hypertrophy Program v1.0.
 * 4-day upper/lower split (garage gym), glute + shoulder emphasis.
 * Idempotent: upserts by natural keys. Run: tsx scripts/seed-womens-program.ts
 *
 * Also creates the user "amina" (password from AMINA_PASSWORD env or CLI arg)
 * and points her AppSettings at this program.
 */
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";
import type {
  Equipment,
  ExerciseType,
  MuscleGroup,
  Priority,
} from "../lib/generated/prisma/enums";

const PROGRAM_NAME = "Women's Beginner Hypertrophy";
const PROGRAM_DESCRIPTION =
  "4-day upper/lower split for beginners (garage gym). Glute and shoulder emphasis, " +
  "4 exercises per day, double progression, 2-3 RIR weeks 1-4 then 1-2 RIR, deload week 13.";

const REST_BY_TYPE: Record<ExerciseType, number> = {
  HEAVY_COMPOUND: 150,
  COMPOUND: 120, // program: compounds rest 2 minutes
  MACHINE_COMPOUND: 120,
  ISOLATION: 75, // program: isolation 60-90s
  CORE: 60,
};

// Program intensity: 2-3 RIR weeks 1-4, 1-2 RIR weeks 5-12. Slot targets are
// static, so compounds carry the conservative beginner range.
const RIR_BY_TYPE: Record<ExerciseType, { min: number; max: number }> = {
  HEAVY_COMPOUND: { min: 2, max: 3 },
  COMPOUND: { min: 2, max: 3 },
  MACHINE_COMPOUND: { min: 2, max: 3 },
  ISOLATION: { min: 1, max: 2 },
  CORE: { min: 1, max: 2 },
};

// ---------- New exercises (existing catalog rows are reused by name) ----------

type ExerciseSeed = {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  weightIncrement?: number;
  isBodyweight?: boolean;
  notes?: string;
};

const NEW_EXERCISES: ExerciseSeed[] = [
  { name: "Lat Pulldown", primaryMuscle: "LATS", secondaryMuscles: ["BACK", "BICEPS"], equipment: "CABLE", type: "MACHINE_COMPOUND" },
  { name: "Chest Supported Dumbbell Row", primaryMuscle: "BACK", secondaryMuscles: ["LATS", "REAR_DELTS", "BICEPS"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Goblet Squat", primaryMuscle: "QUADS", secondaryMuscles: ["GLUTES", "CORE"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Dumbbell Romanian Deadlift", primaryMuscle: "HAMSTRINGS", secondaryMuscles: ["GLUTES", "BACK"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Dumbbell Hip Thrust", primaryMuscle: "GLUTES", secondaryMuscles: ["HAMSTRINGS"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Step-ups", primaryMuscle: "GLUTES", secondaryMuscles: ["QUADS", "HAMSTRINGS"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Arnold Press", primaryMuscle: "FRONT_DELTS", secondaryMuscles: ["LATERAL_DELTS", "TRICEPS"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Reverse Lunges", primaryMuscle: "GLUTES", secondaryMuscles: ["QUADS", "HAMSTRINGS"], equipment: "DUMBBELL", type: "COMPOUND" },
  { name: "Cable Kickbacks", primaryMuscle: "GLUTES", equipment: "CABLE", type: "ISOLATION", weightIncrement: 2.5 },
  { name: "Dumbbell Curl", primaryMuscle: "BICEPS", secondaryMuscles: ["FOREARMS"], equipment: "DUMBBELL", type: "ISOLATION", weightIncrement: 2.5 },
  { name: "Hammer Curl", primaryMuscle: "BICEPS", secondaryMuscles: ["FOREARMS"], equipment: "DUMBBELL", type: "ISOLATION", weightIncrement: 2.5 },
  { name: "Seated Dumbbell Calf Raise", primaryMuscle: "CALVES", equipment: "DUMBBELL", type: "ISOLATION" },
  { name: "Dead Bug", primaryMuscle: "CORE", equipment: "BODYWEIGHT", type: "CORE", isBodyweight: true },
];

// Existing catalog rows reused: Seated Dumbbell Shoulder Press, Incline Dumbbell
// Press, Cable Lateral Raise, Rope Pushdown ("Rope Triceps Pushdown"), Rear Delt
// Fly, Face Pull, Standing Calf Raise, Cable Crunch, Cable Leg Curl ("Cable
// Hamstring Curl").

// ---------- Templates ----------

type SlotSeed = {
  exercise: string;
  sets: number;
  repMin: number;
  repMax: number;
  priority?: Priority;
  isPerSide?: boolean;
  notes?: string;
};

type TemplateSeed = { name: string; dayNumber: number; sortOrder: number; slots: SlotSeed[] };

const TEMPLATES: TemplateSeed[] = [
  {
    name: "Upper A – Shoulder Focus",
    dayNumber: 1,
    sortOrder: 0,
    slots: [
      { exercise: "Seated Dumbbell Shoulder Press", sets: 3, repMin: 8, repMax: 10, priority: "HIGH" },
      { exercise: "Lat Pulldown", sets: 3, repMin: 10, repMax: 12, priority: "HIGH" },
      { exercise: "Chest Supported Dumbbell Row", sets: 3, repMin: 10, repMax: 12 },
      { exercise: "Cable Lateral Raise", sets: 3, repMin: 12, repMax: 15, priority: "HIGHEST" },
    ],
  },
  {
    name: "Lower A – Glute Focus",
    dayNumber: 2,
    sortOrder: 1,
    slots: [
      { exercise: "Goblet Squat", sets: 3, repMin: 10, repMax: 12, priority: "HIGH" },
      { exercise: "Dumbbell Romanian Deadlift", sets: 3, repMin: 10, repMax: 12, priority: "HIGH" },
      { exercise: "Dumbbell Hip Thrust", sets: 3, repMin: 12, repMax: 15, priority: "HIGHEST" },
      { exercise: "Step-ups", sets: 3, repMin: 10, repMax: 10, isPerSide: true, notes: "10 each leg" },
    ],
  },
  {
    name: "Upper B – Back & Shoulder",
    dayNumber: 3,
    sortOrder: 2,
    slots: [
      { exercise: "Lat Pulldown", sets: 3, repMin: 10, repMax: 12, priority: "HIGH" },
      { exercise: "Chest Supported Dumbbell Row", sets: 3, repMin: 10, repMax: 12, priority: "HIGH" },
      { exercise: "Arnold Press", sets: 3, repMin: 10, repMax: 12 },
      { exercise: "Rear Delt Fly", sets: 3, repMin: 12, repMax: 15 },
    ],
  },
  {
    name: "Lower B – Glutes & Hamstrings",
    dayNumber: 4,
    sortOrder: 3,
    slots: [
      { exercise: "Dumbbell Romanian Deadlift", sets: 3, repMin: 10, repMax: 12, priority: "HIGH" },
      { exercise: "Dumbbell Hip Thrust", sets: 3, repMin: 12, repMax: 15, priority: "HIGHEST" },
      { exercise: "Reverse Lunges", sets: 3, repMin: 10, repMax: 10, isPerSide: true, notes: "10 each leg" },
      { exercise: "Cable Kickbacks", sets: 3, repMin: 12, repMax: 15 },
    ],
  },
];

// Overrides apply only in their own phase (lib/schedule.ts resolveTargets), so
// block 3 restates the block 2 additions that persist through weeks 9-12.
// Weeks 5-8 (block 2): +1 set to shoulder press, lat pulldown, hip thrust, RDL.
const BLOCK2_ADD_SET: Array<[number, string, number]> = [
  [1, "Seated Dumbbell Shoulder Press", 1],
  [1, "Lat Pulldown", 1],
  [2, "Dumbbell Hip Thrust", 1],
  [2, "Dumbbell Romanian Deadlift", 1],
];

// Weeks 9-12 (block 3): block 2 additions persist; hip thrust gains a further
// set, and kickbacks, lateral raises (both days), rear delt fly gain one each.
const BLOCK3_ADD_SET: Array<[number, string, number]> = [
  [1, "Seated Dumbbell Shoulder Press", 1],
  [1, "Lat Pulldown", 1],
  [2, "Dumbbell Hip Thrust", 2],
  [2, "Dumbbell Romanian Deadlift", 1],
  [4, "Cable Kickbacks", 1],
  [1, "Cable Lateral Raise", 1],
  [3, "Rear Delt Fly", 1],
];

// ---------- User ----------

const USERNAME = "amina";
const PASSWORD = process.argv[2] ?? process.env.AMINA_PASSWORD;

async function main() {
  // 1. Exercises (create new; leave existing catalog rows untouched)
  for (const ex of NEW_EXERCISES) {
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: {},
      create: {
        name: ex.name,
        primaryMuscle: ex.primaryMuscle,
        secondaryMuscles: JSON.stringify(ex.secondaryMuscles ?? []),
        equipment: ex.equipment,
        type: ex.type,
        difficulty: "BEGINNER",
        weightIncrement: ex.weightIncrement ?? 5,
        isBodyweight: ex.isBodyweight ?? false,
        notes: ex.notes ?? null,
      },
    });
  }
  const exercises = await prisma.exercise.findMany({ select: { id: true, name: true, type: true } });
  const exerciseByName = new Map(exercises.map((e) => [e.name, e]));

  // 2. Program + templates + slots
  const program = await prisma.program.upsert({
    where: { name: PROGRAM_NAME },
    update: { description: PROGRAM_DESCRIPTION },
    create: { name: PROGRAM_NAME, description: PROGRAM_DESCRIPTION },
  });

  const slotIdByDayAndName = new Map<string, string>();
  for (const tpl of TEMPLATES) {
    const template = await prisma.workoutTemplate.upsert({
      where: { programId_dayNumber: { programId: program.id, dayNumber: tpl.dayNumber } },
      update: { name: tpl.name, sortOrder: tpl.sortOrder },
      create: { name: tpl.name, programId: program.id, dayNumber: tpl.dayNumber, sortOrder: tpl.sortOrder, isActive: true },
    });

    for (let i = 0; i < tpl.slots.length; i++) {
      const slot = tpl.slots[i];
      const exercise = exerciseByName.get(slot.exercise);
      if (!exercise) throw new Error(`Unknown exercise: ${slot.exercise}`);
      const rir = RIR_BY_TYPE[exercise.type];
      const data = {
        exerciseId: exercise.id,
        baseSets: slot.sets,
        repRangeMin: slot.repMin,
        repRangeMax: slot.repMax,
        targetRirMin: rir.min,
        targetRirMax: rir.max,
        priority: slot.priority ?? ("NORMAL" as Priority),
        restSeconds: REST_BY_TYPE[exercise.type],
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

  // 3. Block overrides
  for (const [blockNumber, entries] of [
    [2, BLOCK2_ADD_SET],
    [3, BLOCK3_ADD_SET],
  ] as const) {
    for (const [day, name, addSets] of entries) {
      const templateExerciseId = slotIdByDayAndName.get(`${day}:${name}`);
      if (!templateExerciseId) throw new Error(`No slot for day ${day} ${name}`);
      await prisma.blockOverride.upsert({
        where: { templateExerciseId_blockNumber: { templateExerciseId, blockNumber } },
        update: { addSets },
        create: { templateExerciseId, blockNumber, addSets },
      });
    }
  }

  // 4. User amina — signup provisions AppSettings + TrainingBlock via hook
  let user = await prisma.user.findUnique({ where: { username: USERNAME } });
  if (!user) {
    if (!PASSWORD) throw new Error("Password required: tsx scripts/seed-womens-program.ts <password>");
    await auth.api.signUpEmail({
      body: {
        name: "Amina",
        username: USERNAME,
        email: `${USERNAME}@tracker.local`,
        password: PASSWORD,
      },
    });
    user = await prisma.user.findUniqueOrThrow({ where: { username: USERNAME } });
  }

  // 5. Make this program amina's active program (provisioning defaults to the
  // oldest program, which is the original UPPER / LOWER).
  await prisma.appSettings.update({
    where: { userId: user.id },
    data: { activeProgramId: program.id },
  });

  // ---- Verification summary ----
  const [templates, slots, overrides] = await Promise.all([
    prisma.workoutTemplate.count({ where: { programId: program.id } }),
    prisma.templateExercise.count({ where: { template: { programId: program.id } } }),
    prisma.blockOverride.count({ where: { templateExercise: { template: { programId: program.id } } } }),
  ]);
  console.log(`Seed complete: "${PROGRAM_NAME}" (${program.id})`);
  console.log(`  workout templates: ${templates}`);
  console.log(`  template slots:    ${slots}`);
  console.log(`  block overrides:   ${overrides}`);
  console.log(`  user:              ${user.username} (${user.id}), active program set`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
