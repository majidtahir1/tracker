/**
 * tests/whoop-match.test.ts — session ↔ WHOOP activity time-overlap matching.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchWhoopWorkout, overlapMs } from "../lib/whoop/match";

const t = (min: number) => new Date(Date.UTC(2026, 6, 1, 12, min));

test("overlapMs computes intersection and clamps disjoint ranges to 0", () => {
  assert.equal(overlapMs(t(0), t(60), t(30), t(90)), 30 * 60000);
  assert.equal(overlapMs(t(0), t(30), t(30), t(60)), 0);
});

test("matches the activity covering the session", () => {
  const lifting = { id: "a", start: t(5), end: t(65) };
  const other = { id: "b", start: t(-120), end: t(-60) };
  assert.equal(matchWhoopWorkout(t(0), t(70), [other, lifting]), lifting);
});

test("rejects brief overlaps (warm-up walk grazing the session)", () => {
  const walk = { id: "w", start: t(-20), end: t(3) }; // 3 min overlap
  assert.equal(matchWhoopWorkout(t(0), t(60), [walk]), null);
});

test("requires half of the shorter duration to overlap", () => {
  // 30-min activity overlapping only 10 min of a 90-min session.
  const short = { id: "s", start: t(80), end: t(110) };
  assert.equal(matchWhoopWorkout(t(0), t(90), [short]), null);
  // Same activity fully inside the session matches.
  const inside = { id: "i", start: t(30), end: t(60) };
  assert.equal(matchWhoopWorkout(t(0), t(90), [inside]), inside);
});

test("picks the largest overlap when several qualify", () => {
  const partial = { id: "p", start: t(0), end: t(20) };
  const full = { id: "f", start: t(0), end: t(55) };
  assert.equal(matchWhoopWorkout(t(0), t(60), [partial, full]), full);
});

test("returns null without session timestamps", () => {
  const w = { id: "x", start: t(0), end: t(60) };
  assert.equal(matchWhoopWorkout(null, t(60), [w]), null);
  assert.equal(matchWhoopWorkout(t(0), null, [w]), null);
});
