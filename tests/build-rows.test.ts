import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRows } from "../components/workout/build-rows";
import type { LoggerExercise, SetData } from "../components/workout/types";

function makeExercise(overrides: Partial<LoggerExercise>): LoggerExercise {
  return {
    sessionExerciseId: "se1",
    templateExerciseId: "te1",
    exerciseId: "e1",
    name: "Incline Dumbbell Press",
    isBodyweight: false,
    isPerSide: false,
    weightIncrement: 5,
    priority: "PRIMARY",
    targetSets: 3,
    targetRepMin: 8,
    targetRepMax: 10,
    targetRirMin: 1,
    targetRirMax: 2,
    restSeconds: 150,
    targetWeight: 45,
    recommendation: "REPEAT",
    prevWorkingWeight: 45,
    notes: null,
    prevSets: [
      { weight: 45, reps: 8, rir: 2 },
      { weight: 45, reps: 8, rir: 1 },
      { weight: 45, reps: 8, rir: 1 },
    ],
    alternatives: [],
    sets: [],
    ...overrides,
  };
}

function set(setNumber: number, completed = true): SetData {
  return { id: `set${setNumber}`, setNumber, weight: 45, reps: 10, rir: 1, completed };
}

test("pads an unstarted exercise to targetSets with numbers 1..n", () => {
  const rows = buildRows(makeExercise({ sets: [] }));
  assert.deepEqual(
    rows.map((r) => r.setNumber),
    [1, 2, 3]
  );
});

test("keeps unique set numbers when persisted sets are non-contiguous", () => {
  // Sets 2 and 3 were completed and saved; set 1 never was. After a reload,
  // padding must fill set 1 — not mint a duplicate setNumber 3.
  const rows = buildRows(makeExercise({ sets: [set(2), set(3)] }));
  assert.deepEqual(
    rows.map((r) => r.setNumber),
    [1, 2, 3]
  );
  assert.equal(rows[0].completed, false);
  assert.equal(rows[1].completed, true);
  assert.equal(rows[2].completed, true);
});

test("keeps persisted sets beyond targetSets", () => {
  const rows = buildRows(makeExercise({ sets: [set(1), set(2), set(3), set(4)] }));
  assert.deepEqual(
    rows.map((r) => r.setNumber),
    [1, 2, 3, 4]
  );
});

test("prefills padded rows from targetWeight and matching prev set", () => {
  const rows = buildRows(
    makeExercise({
      sets: [set(1)],
      targetWeight: 50,
      recommendation: "INCREASE",
    })
  );
  assert.equal(rows[1].weight, 50);
  assert.equal(rows[1].reps, 8); // INCREASE resets to targetRepMin
  assert.equal(rows[2].weight, 50);
});
