import test from "node:test";
import assert from "node:assert/strict";
import { recommendProgression, type PriorSet } from "../lib/progression";

const TARGETS = { repRangeMin: 8, repRangeMax: 12, targetRirMin: 1, priorTargetSets: 3 };

function sets(entries: Array<[number, number, number | null]>): PriorSet[] {
  return entries.map(([weight, reps, rir]) => ({ weight, reps, rir, completed: true }));
}

test("first time: no history means no weight suggestion", () => {
  const r = recommendProgression({ priorSets: null, targets: TARGETS, weightIncrement: 5 });
  assert.equal(r.rec, "FIRST_TIME");
});

test("increase: all working sets at top of range within RIR target", () => {
  const r = recommendProgression({
    priorSets: sets([[50, 12, 2], [50, 12, 2], [50, 12, 1]]),
    targets: TARGETS,
    weightIncrement: 5,
  });
  assert.equal(r.rec, "INCREASE");
  assert.equal(r.weight, 55);
  assert.equal(r.targetReps, 8);
});

test("repeat: mid-range reps keep the same weight", () => {
  const r = recommendProgression({
    priorSets: sets([[50, 12, 2], [50, 10, 1], [50, 9, 1]]),
    targets: TARGETS,
    weightIncrement: 5,
  });
  assert.equal(r.rec, "REPEAT");
  assert.equal(r.weight, 50);
});

test("reduce: only after two grinding sessions with zero rep progress", () => {
  const grind = sets([[100, 9, 0], [100, 8, 0], [100, 8, 0]]);
  const r = recommendProgression({
    priorSets: grind,
    previousSets: grind,
    targets: TARGETS,
    weightIncrement: 5,
  });
  assert.equal(r.rec, "REDUCE");
  assert.equal(r.weight, 90);
});

test("a single hard session is REPEAT, not REDUCE", () => {
  const r = recommendProgression({
    priorSets: sets([[100, 9, 0], [100, 8, 0], [100, 8, 0]]),
    previousSets: null,
    targets: TARGETS,
    weightIncrement: 5,
  });
  assert.equal(r.rec, "REPEAT");
});

test("skipped sets block an increase even at top-of-range reps", () => {
  const r = recommendProgression({
    priorSets: sets([[50, 12, 2], [50, 12, 2]]), // only 2 of 3 target sets
    targets: TARGETS,
    weightIncrement: 5,
  });
  assert.equal(r.rec, "REPEAT");
});
