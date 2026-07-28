import test from "node:test";
import assert from "node:assert/strict";
import { calculateSetGuardrails, deterministicCoachResponse } from "../lib/ai/set-coach-guardrails";

const base = {
  lastSet: { weight: 200, reps: 12, rir: 3 },
  targets: { repMin: 8, repMax: 12, rirMin: 1, rirMax: 2 },
  weightIncrement: 5,
  isDeload: false,
  deloadWeight: null,
  remainingSets: 2,
};

test("strong performance allows INCREASE — recovery has no mechanical input (user decision 2026-07-28)", () => {
  const g = calculateSetGuardrails(base);
  assert.deepEqual(g.allowedActions, ["INCREASE", "REPEAT"]);
  assert.equal(g.candidateWeight, 205);
});

test("performance signals still gate: reps below range forces REDUCE/REPEAT", () => {
  const g = calculateSetGuardrails({ ...base, lastSet: { weight: 200, reps: 6, rir: 1 } });
  assert.deepEqual(g.allowedActions, ["REDUCE", "REPEAT"]);
  assert.equal(g.candidateWeight, 180);
});

test("RIR 0 forces REDUCE/REPEAT", () => {
  const g = calculateSetGuardrails({ ...base, lastSet: { weight: 200, reps: 10, rir: 0 } });
  assert.deepEqual(g.allowedActions, ["REDUCE", "REPEAT"]);
});

test("deterministic response follows the first allowed action", () => {
  const g = calculateSetGuardrails(base);
  const r = deterministicCoachResponse(g);
  assert.equal(r.action, "INCREASE");
  assert.equal(r.nextWeight, 205);
  assert.equal(r.source, "deterministic");
});
