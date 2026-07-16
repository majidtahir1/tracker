import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveInsights, type InsightsInput } from "../lib/insights";
import type { AnalyticsData } from "../lib/queries/analytics";
import type { TimelineEntry } from "../lib/queries/records";

const TODAY = "2026-07-16"; // a Thursday — volume-gap cards are eligible

function baseAnalytics(overrides: Partial<AnalyticsData> = {}): AnalyticsData {
  return {
    range: "12W",
    hasSessions: true,
    bigFour: [],
    allSeries: [],
    weeklyRegionVolume: [],
    weeklyTargetTotal: 0,
    currentWeekMuscles: [],
    frequency: [],
    stats: { consistencyPct: null, avgRir: null, sessionsPerWeek: null, completedSessions: 8 },
    rirTrend: [],
    recoveryPerformance: [],
    bodyWeight: [],
    whoop: { recoveryTrend: [], hrvTrend: [], sleepTrend: [], strainTrend: [], hasData: false },
    ...overrides,
  };
}

function input(overrides: Partial<InsightsInput> = {}): InsightsInput {
  return {
    analytics: baseAnalytics(),
    prTimeline: [],
    streakWeeks: 0,
    blockStart: null,
    today: TODAY,
    ...overrides,
  };
}

function point(date: string, e1rm: number) {
  return { date, label: date.slice(5), e1rm, topSet: "185×8", isPr: false };
}

function pr(date: string, name = "Bench Press"): TimelineEntry {
  return { id: date + name, exerciseName: name, type: "BEST_E1RM", value: 243, weight: 205, reps: 8, date, unseen: false };
}

test("no sessions yields a single empty-state card", () => {
  const out = deriveInsights(input({ analytics: baseAnalytics({ hasSessions: false }) }));
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "empty");
});

test("rising big-four lift produces an up strength card with the delta", () => {
  const analytics = baseAnalytics({
    bigFour: [{ name: "Bench Press", series: [point("2026-06-11", 231), point("2026-07-14", 243)] }],
  });
  const out = deriveInsights(input({ analytics }));
  const strength = out.find((i) => i.kind === "strength");
  assert.ok(strength);
  assert.equal(strength.direction, "up");
  assert.match(strength.headline, /Bench Press e1RM \+12 lb/);
});

test("falling lift is a down card; near-flat lifts collapse into one steady card", () => {
  const analytics = baseAnalytics({
    bigFour: [
      { name: "Box Squat", series: [point("2026-06-11", 300), point("2026-07-14", 290)] },
      { name: "Bench Press", series: [point("2026-06-11", 231), point("2026-07-14", 231.4)] },
      { name: "Romanian Deadlift", series: [point("2026-06-11", 275), point("2026-07-14", 275.2)] },
    ],
  });
  const out = deriveInsights(input({ analytics }));
  const strength = out.filter((i) => i.kind === "strength");
  assert.equal(strength.length, 2);
  assert.equal(strength[0].direction, "down");
  assert.match(strength[1].headline, /2 lifts holding steady/);
});

test("biggest non-big-four mover appears; small movers do not", () => {
  const analytics = baseAnalytics({
    bigFour: [{ name: "Bench Press", series: [] }],
    allSeries: [
      { name: "Bench Press", series: [point("2026-06-11", 100), point("2026-07-14", 200)] }, // excluded: big four
      { name: "Lat Pulldown", series: [point("2026-06-11", 140), point("2026-07-14", 149)] },
      { name: "Leg Press", series: [point("2026-06-11", 400), point("2026-07-14", 403)] }, // < 5 lb: skipped
    ],
  });
  const out = deriveInsights(input({ analytics }));
  const movers = out.filter((i) => i.kind === "strength");
  assert.equal(movers.length, 1);
  assert.match(movers[0].headline, /Lat Pulldown e1RM \+9 lb/);
});

test("PRs count within the block and name the latest", () => {
  const out = deriveInsights(input({
    prTimeline: [pr("2026-07-15", "Romanian Deadlift"), pr("2026-07-01"), pr("2026-05-01")],
    blockStart: "2026-06-15",
  }));
  const card = out.find((i) => i.kind === "pr");
  assert.ok(card);
  assert.match(card.headline, /2 PRs this block/);
  assert.match(card.detail, /Romanian Deadlift, 205×8 \(e1rm\)/);
});

test("volume gap warns below 60% of target, worst first, max three", () => {
  const analytics = baseAnalytics({
    currentWeekMuscles: [
      { muscle: "REAR_DELTS", label: "Rear delts", sets: 2, target: 7 },
      { muscle: "CHEST", label: "Chest", sets: 11, target: 12 }, // 92%: fine
      { muscle: "BICEPS", label: "Biceps", sets: 0, target: 6 },
      { muscle: "CALVES", label: "Calves", sets: 1, target: 6 },
      { muscle: "LATS", label: "Lats", sets: 3, target: 14 },
    ],
  });
  const out = deriveInsights(input({ analytics }));
  const gaps = out.filter((i) => i.kind === "volume");
  assert.equal(gaps.length, 3);
  assert.match(gaps[0].headline, /Biceps/); // 0% is worst
  assert.ok(gaps.every((g) => g.direction === "warn"));
});

test("volume gaps are suppressed early in the week", () => {
  const analytics = baseAnalytics({
    currentWeekMuscles: [{ muscle: "BICEPS", label: "Biceps", sets: 0, target: 6 }],
  });
  const out = deriveInsights(input({ analytics, today: "2026-07-14" })); // Tuesday
  assert.equal(out.filter((i) => i.kind === "volume").length, 0);
});

test("streak beats sessions-per-week for the consistency card", () => {
  const withStreak = deriveInsights(input({ streakWeeks: 8 }));
  assert.match(withStreak.find((i) => i.kind === "consistency")!.headline, /8-week streak/);

  const noStreak = deriveInsights(input({
    analytics: baseAnalytics({ stats: { consistencyPct: 70, avgRir: null, sessionsPerWeek: 2.8, completedSessions: 8 } }),
  }));
  const card = noStreak.find((i) => i.kind === "consistency")!;
  assert.match(card.headline, /2.8 sessions\/week/);
  assert.equal(card.direction, "warn");
});

test("body weight uses the moving average and skips tiny changes", () => {
  const analytics = baseAnalytics({
    bodyWeight: [
      { date: "2026-06-11", label: "Jun 11", weight: 188, ma: 187.5 },
      { date: "2026-07-14", label: "Jul 14", weight: 185, ma: 185.4 },
    ],
  });
  const out = deriveInsights(input({ analytics }));
  const card = out.find((i) => i.kind === "bodyweight")!;
  assert.match(card.headline, /Body weight -2.1 lb/);

  const flat = deriveInsights(input({
    analytics: baseAnalytics({
      bodyWeight: [
        { date: "2026-06-11", label: "Jun 11", weight: 188, ma: 187.5 },
        { date: "2026-07-14", label: "Jul 14", weight: 187, ma: 187.3 },
      ],
    }),
  }));
  assert.equal(flat.filter((i) => i.kind === "bodyweight").length, 0);
});

test("recovery card: week-over-week average, red-zone warning, absent without wearable", () => {
  const day = (date: string, score: number) => ({ date, label: date.slice(5), score });
  const trend = [
    day("2026-07-03", 60), day("2026-07-04", 62), day("2026-07-05", 58), day("2026-07-06", 61),
    day("2026-07-07", 59), day("2026-07-08", 63), day("2026-07-09", 57),
    day("2026-07-10", 70), day("2026-07-11", 72), day("2026-07-12", 68), day("2026-07-13", 71),
    day("2026-07-14", 69), day("2026-07-15", 73), day("2026-07-16", 67),
  ];
  const out = deriveInsights(input({
    analytics: baseAnalytics({ whoop: { recoveryTrend: trend, hrvTrend: [], sleepTrend: [], strainTrend: [], hasData: true } }),
  }));
  const card = out.find((i) => i.kind === "recovery")!;
  assert.match(card.headline, /Recovery averaging 70/);
  assert.equal(card.direction, "up");

  const red = deriveInsights(input({
    analytics: baseAnalytics({
      whoop: {
        recoveryTrend: [day("2026-07-13", 55), day("2026-07-14", 35), day("2026-07-15", 30), day("2026-07-16", 38)],
        hrvTrend: [], sleepTrend: [], strainTrend: [], hasData: true,
      },
    }),
  }));
  assert.match(red.find((i) => i.kind === "recovery")!.headline, /red/);

  const none = deriveInsights(input());
  assert.equal(none.filter((i) => i.kind === "recovery").length, 0);
});
