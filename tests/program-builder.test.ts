import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDraft,
  computeVolume,
  type CatalogExercise,
} from "../lib/ai/program-builder";

const CATALOG: CatalogExercise[] = [
  { name: "Lat Pulldown", primaryMuscle: "LATS", secondaryMuscles: '["BACK","BICEPS"]', equipment: "CABLE", type: "MACHINE_COMPOUND" },
  { name: "Dumbbell Hip Thrust", primaryMuscle: "GLUTES", secondaryMuscles: '["HAMSTRINGS"]', equipment: "DUMBBELL", type: "COMPOUND" },
];
const byName = new Map(CATALOG.map((e) => [e.name.toLowerCase(), e]));

function validProgram() {
  return {
    message: "ok",
    program: {
      name: "Test Program",
      description: "desc",
      days: [
        {
          name: "Day A",
          focus: "back",
          slots: [
            { exercise: "lat pulldown", sets: 3, repMin: 8, repMax: 12, priority: "HIGH", isPerSide: false, notes: null, newExercise: null },
            { exercise: "Dumbbell Hip Thrust", sets: 3, repMin: 10, repMax: 15, priority: "HIGHEST", isPerSide: false, notes: null, newExercise: null },
          ],
        },
      ],
      block2AddSets: [{ day: 1, exercise: "Lat Pulldown" }],
      block3AddSets: [{ day: 1, exercise: "Lat Pulldown", addSets: 2 }],
    },
  };
}

test("validateDraft accepts a valid program and canonicalizes catalog names", () => {
  const { draft, errors } = validateDraft(validProgram(), byName);
  assert.deepEqual(errors, []);
  assert.ok(draft);
  assert.equal(draft.days[0].slots[0].exercise, "Lat Pulldown"); // case fixed
  assert.equal(draft.block2AddSets[0].exercise, "Lat Pulldown");
  assert.equal(draft.block3AddSets[0].addSets, 2);
});

test("validateDraft rejects unknown exercises without newExercise metadata", () => {
  const bad = validProgram();
  bad.program.days[0].slots[0].exercise = "Mystery Machine Row";
  const { draft, errors } = validateDraft(bad, byName);
  assert.equal(draft, null);
  assert.ok(errors.some((e) => e.includes("Mystery Machine Row")));
});

test("validateDraft accepts unknown exercises with complete newExercise metadata", () => {
  const p = validProgram();
  p.program.days[0].slots[0] = {
    exercise: "Meadows Row",
    sets: 3, repMin: 8, repMax: 12, priority: "NORMAL", isPerSide: true, notes: null,
    newExercise: { primaryMuscle: "LATS", secondaryMuscles: ["BACK"], equipment: "BARBELL", type: "COMPOUND" },
  } as never;
  p.program.block2AddSets = [];
  p.program.block3AddSets = [];
  const { draft, errors } = validateDraft(p, byName);
  assert.deepEqual(errors, []);
  assert.equal(draft?.days[0].slots[0].newExercise?.primaryMuscle, "LATS");
});

test("validateDraft rejects block adds pointing at exercises not on that day", () => {
  const p = validProgram();
  p.program.block2AddSets = [{ day: 1, exercise: "Bench Press" }];
  const { draft, errors } = validateDraft(p, byName);
  assert.equal(draft, null);
  assert.ok(errors.some((e) => e.includes("block2AddSets")));
});

test("validateDraft rejects out-of-range sets and reps", () => {
  const p = validProgram();
  p.program.days[0].slots[0].sets = 9;
  p.program.days[0].slots[1].repMin = 20;
  p.program.days[0].slots[1].repMax = 10;
  const { draft, errors } = validateDraft(p, byName);
  assert.equal(draft, null);
  assert.equal(errors.length, 2);
});

test("validateDraft rejects duplicate exercises within a day", () => {
  const p = validProgram();
  p.program.days[0].slots[1] = { ...p.program.days[0].slots[0] };
  const { draft, errors } = validateDraft(p, byName);
  assert.equal(draft, null);
  assert.ok(errors.some((e) => e.includes("twice")));
});

test("computeVolume counts direct and indirect weekly sets", () => {
  const { draft } = validateDraft(validProgram(), byName);
  const volume = computeVolume(draft!, byName);
  const lats = volume.find((v) => v.muscle === "LATS");
  const back = volume.find((v) => v.muscle === "BACK");
  const glutes = volume.find((v) => v.muscle === "GLUTES");
  assert.equal(lats?.directSets, 3);
  assert.equal(back?.indirectSets, 3);
  assert.equal(glutes?.directSets, 3);
});
