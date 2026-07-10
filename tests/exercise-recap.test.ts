import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicRecap, type RecapFallbackInput } from "../lib/ai/exercise-recap-fallback";
import { parseRecapResponse } from "../lib/ai/exercise-recap-provider";

function input(overrides: Partial<RecapFallbackInput> = {}): RecapFallbackInput {
  return {
    exerciseName: "Incline Dumbbell Press",
    completedSets: [
      { weight: 45, reps: 10 },
      { weight: 45, reps: 10 },
      { weight: 45, reps: 9 },
    ],
    priorSets: [
      { weight: 45, reps: 8 },
      { weight: 45, reps: 8 },
      { weight: 45, reps: 8 },
    ],
    remaining: [
      { name: "Chest-Supported Row", setsRemaining: 3 },
      { name: "Lateral Raise", setsRemaining: 3 },
    ],
    isDeload: false,
    ...overrides,
  };
}

test("beat last session: headline reflects improvement", () => {
  const r = deterministicRecap(input());
  assert.equal(r.source, "deterministic");
  assert.match(r.headline + r.message, /up|beat/i);
  assert.match(r.focusCue, /2 exercises/);
  assert.match(r.focusCue, /6 sets/);
});

test("matched last session", () => {
  const r = deterministicRecap(
    input({ completedSets: [...(input().priorSets as { weight: number; reps: number }[])] })
  );
  assert.match(r.headline + r.message, /match/i);
});

test("under last session stays encouraging, not punishing", () => {
  const r = deterministicRecap(
    input({
      completedSets: [
        { weight: 45, reps: 7 },
        { weight: 45, reps: 7 },
        { weight: 45, reps: 6 },
      ],
    })
  );
  assert.match(r.headline + r.message, /under|shy/i);
  assert.doesNotMatch(r.message, /fail/i);
});

test("no history variant", () => {
  const r = deterministicRecap(input({ priorSets: null }));
  assert.match(r.headline + r.message, /first|baseline/i);
});

test("last exercise gets a finishing cue", () => {
  const r = deterministicRecap(input({ remaining: [] }));
  assert.match(r.focusCue, /last exercise|finish/i);
});

test("deload variant avoids progression talk", () => {
  const r = deterministicRecap(input({ isDeload: true }));
  assert.match(r.headline + r.message, /deload|easy|recover/i);
});

// ---------------------------------------------------------------------------

test("parser accepts valid JSON and clamps lengths", () => {
  const parsed = parseRecapResponse(
    `Here you go: {"headline":"${"h".repeat(200)}","message":"solid work","focusCue":"rest 2m"}`
  );
  assert.ok(parsed);
  assert.equal(parsed.headline.length, 100);
  assert.equal(parsed.message, "solid work");
  assert.equal(parsed.focusCue, "rest 2m");
  assert.equal(parsed.source, "minimax");
});

test("parser rejects garbage and missing keys", () => {
  assert.equal(parseRecapResponse("no json here"), null);
  assert.equal(parseRecapResponse('{"headline":"x"}'), null);
  assert.equal(parseRecapResponse('{"headline":"x","message":"","focusCue":"y"}'), null);
  assert.equal(parseRecapResponse('{"headline":1,"message":2,"focusCue":3}'), null);
});
