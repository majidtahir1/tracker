import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldOnboard, validBodyWeightLb } from "../lib/onboarding";

test("brand-new user (no flag, no workouts) onboards", () => {
  assert.equal(shouldOnboard({ onboardedAt: null }, 0), true);
  assert.equal(shouldOnboard(null, 0), true);
});

test("completed or skipped wizard never re-shows", () => {
  assert.equal(shouldOnboard({ onboardedAt: "2026-07-11T12:00:00.000Z" }, 0), false);
});

test("any completed workout exempts the account, even without the flag", () => {
  assert.equal(shouldOnboard({ onboardedAt: null }, 1), false);
  assert.equal(shouldOnboard(null, 12), false);
});

test("body weight bounds", () => {
  assert.equal(validBodyWeightLb(185), true);
  assert.equal(validBodyWeightLb(30), true);
  assert.equal(validBodyWeightLb(1000), true);
  assert.equal(validBodyWeightLb(29.9), false);
  assert.equal(validBodyWeightLb(1000.5), false);
  assert.equal(validBodyWeightLb(NaN), false);
  assert.equal(validBodyWeightLb("185"), false);
  assert.equal(validBodyWeightLb(null), false);
});
