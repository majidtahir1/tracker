import test from "node:test";
import assert from "node:assert/strict";
import { mondayOfCurrentWeek } from "../lib/provision";

test("mondayOfCurrentWeek returns the ISO Monday for mid-week dates", () => {
  // Wed 2026-07-01 -> Mon 2026-06-29
  assert.equal(mondayOfCurrentWeek(new Date("2026-07-01T12:00:00")), "2026-06-29");
});

test("mondayOfCurrentWeek is identity on Mondays", () => {
  assert.equal(mondayOfCurrentWeek(new Date("2026-06-29T09:00:00")), "2026-06-29");
});

test("mondayOfCurrentWeek maps Sunday back to the preceding Monday", () => {
  // Sun 2026-07-05 -> Mon 2026-06-29
  assert.equal(mondayOfCurrentWeek(new Date("2026-07-05T20:00:00")), "2026-06-29");
});
