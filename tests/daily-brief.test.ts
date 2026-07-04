import test from "node:test";
import assert from "node:assert/strict";
import { composeDailyBrief, pickQuote, type DailyBriefInputs } from "../lib/ai/daily-brief";

const base: DailyBriefInputs = {
  date: "2026-07-04",
  dayKey: "cycle:123",
  recoveryScore: 82,
  sleepHours: 7.5,
  sleepPerformancePct: 88,
  yesterday: { workoutName: "Upper A", totalSets: 18, totalVolume: 12450, prCount: 2 },
  todayWorkout: { name: "Lower A", inProgress: false },
  isDeloadWeek: false,
};

test("recovered day: green-light headline, recap, workout, and a quote", () => {
  const brief = composeDailyBrief(base);
  assert.match(brief.headline, /Green light: Lower A/);
  assert.match(brief.message, /Upper A — 18 sets, 12,450 lb and 2 PRs/);
  assert.match(brief.message, /82% recovered on 7\.5h of sleep \(88%\)/);
  assert.match(brief.message, /Lower A is on the schedule/);
  assert.equal(brief.encouragement, pickQuote("cycle:123"));
  assert.equal(brief.source, "deterministic");
});

test("fatigued day: back-off headline and no hype quote", () => {
  const brief = composeDailyBrief({ ...base, recoveryScore: 31 });
  assert.match(brief.headline, /Recovery is low/);
  assert.match(brief.message, /keep the weights honest/);
  assert.match(brief.encouragement, /Backing off today/);
});

test("rest day with no whoop data: rest headline, rest-day guidance", () => {
  const brief = composeDailyBrief({
    ...base,
    recoveryScore: null,
    sleepHours: null,
    sleepPerformancePct: null,
    yesterday: null,
    todayWorkout: null,
  });
  assert.match(brief.headline, /Rest day/);
  assert.match(brief.message, /Yesterday was a rest day/);
  assert.match(brief.message, /Nothing scheduled/);
});

test("in-progress session: nudges to finish", () => {
  const brief = composeDailyBrief({
    ...base,
    todayWorkout: { name: "Lower A", inProgress: true },
  });
  assert.match(brief.message, /already underway/);
});

test("pickQuote is deterministic per day key", () => {
  assert.equal(pickQuote("2026-07-04"), pickQuote("2026-07-04"));
  assert.equal(typeof pickQuote("x"), "string");
});
