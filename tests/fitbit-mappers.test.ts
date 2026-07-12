/**
 * tests/fitbit-mappers.test.ts — pure Google Health API dataPoint →
 * Prisma-row mappers (Fitbit data). Fixtures mirror live API responses:
 * int64s as strings, civil dates as {year, month, day}, durations as "Ns".
 * Run with `npm test` (tsx --test, TZ pinned to America/New_York).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataPointId,
  deviceLocalDate,
  durationToMinutes,
  ghaDateToLocal,
  mapExercise,
  mapSleep,
  mergeDailySeries,
  num,
  prettyExerciseType,
  utcToLocalDate,
} from "../lib/fitbit/mappers";
import type { GhaExercisePoint, GhaSleepPoint } from "../lib/fitbit/types";

test("num coerces int64 strings and rejects junk", () => {
  assert.equal(num("28"), 28);
  assert.equal(num(62.5), 62.5);
  assert.equal(num(""), null);
  assert.equal(num(undefined), null);
  assert.equal(num("abc"), null);
});

test("ghaDateToLocal formats civil date objects", () => {
  assert.equal(ghaDateToLocal({ year: 2026, month: 7, day: 3 }), "2026-07-03");
  assert.equal(ghaDateToLocal({ year: 2026, month: 7 }), null);
  assert.equal(ghaDateToLocal(undefined), null);
});

test("durationToMinutes parses Ns strings", () => {
  assert.equal(durationToMinutes("67694s"), 1128);
  assert.equal(durationToMinutes("60s"), 1);
  assert.equal(durationToMinutes("bogus"), null);
  assert.equal(durationToMinutes(undefined), null);
});

// 03:30 UTC on Jul 2 is 23:30 Jul 1 in New York (EDT, UTC-4).
test("utcToLocalDate converts UTC instants to the machine-local day", () => {
  assert.equal(utcToLocalDate("2026-07-02T03:30:00.000Z"), "2026-07-01");
});

test("deviceLocalDate uses the payload's UTC offset over the machine zone", () => {
  // 21:35Z at -05:00 (offset -18000s) = 16:35 local, same day.
  assert.equal(deviceLocalDate("2026-06-09T21:35:00Z", "-18000s"), "2026-06-09");
  // 02:00Z at -05:00 = 21:00 the previous day.
  assert.equal(deviceLocalDate("2026-06-10T02:00:00Z", "-18000s"), "2026-06-09");
  // No offset → machine-local (EDT) fallback.
  assert.equal(deviceLocalDate("2026-07-02T03:30:00Z", undefined), "2026-07-01");
});

test("dataPointId extracts the last segment of the resource name", () => {
  assert.equal(dataPointId("users/670/dataTypes/sleep/dataPoints/294510"), "294510");
  assert.equal(dataPointId(undefined), null);
});

test("mapSleep reads stagesSummary, the nap flag, and the device-local wake day", () => {
  const point: GhaSleepPoint = {
    name: "users/670/dataTypes/sleep/dataPoints/2945102443163753640",
    sleep: {
      interval: {
        startTime: "2026-06-09T20:58:00Z",
        startUtcOffset: "-18000s",
        endTime: "2026-06-09T21:35:00Z",
        endUtcOffset: "-18000s",
      },
      type: "STAGES",
      stages: [
        { startTime: "2026-06-09T20:58:00Z", endTime: "2026-06-09T21:07:00Z", type: "AWAKE" },
        { startTime: "2026-06-09T21:07:00Z", endTime: "2026-06-09T21:20:00Z", type: "LIGHT" },
        { startTime: "2026-06-09T21:20:00Z", endTime: "2026-06-09T21:35:00Z", type: "DEEP" },
      ],
      metadata: { nap: true, processed: true },
      summary: {
        minutesInSleepPeriod: "37",
        minutesAsleep: "28",
        minutesAwake: "9",
        stagesSummary: [
          { type: "AWAKE", minutes: "9" },
          { type: "LIGHT", minutes: "13" },
          { type: "DEEP", minutes: "15" },
        ],
      },
    },
  };
  const row = mapSleep(point);
  assert.ok(row);
  assert.equal(row.id, "2945102443163753640");
  assert.equal(row.date, "2026-06-09"); // device-local (-05:00) wake day
  assert.equal(row.isNap, true);
  assert.equal(row.minutesAsleep, 28);
  assert.equal(row.minutesAwake, 9);
  assert.equal(row.timeInBedMin, 37);
  assert.equal(row.lightMin, 13);
  assert.equal(row.deepMin, 15);
  assert.equal(row.remMin, null);
  assert.equal(row.wakeMin, 9);
});

test("mapSleep handles CLASSIC sessions and rejects incomplete points", () => {
  const classic = mapSleep({
    name: "users/670/dataTypes/sleep/dataPoints/x1",
    sleep: {
      interval: { startTime: "2026-07-10T03:00:00Z", endTime: "2026-07-10T10:30:00Z" },
      type: "CLASSIC",
      summary: { minutesAsleep: "410", minutesAwake: "40" },
    },
  });
  assert.ok(classic);
  assert.equal(classic.isNap, false);
  assert.equal(classic.lightMin, null);
  assert.equal(classic.minutesAsleep, 410);
  assert.equal(classic.timeInBedMin, 450); // interval fallback

  assert.equal(mapSleep({ sleep: { interval: { startTime: "2026-07-10T03:00:00Z" } } }), null);
  assert.equal(mapSleep({ name: "users/670/dataTypes/sleep/dataPoints/x2" }), null);
});

test("prettyExerciseType humanizes enum values", () => {
  assert.equal(prettyExerciseType("WEIGHT_LIFTING"), "Weight lifting");
  assert.equal(prettyExerciseType(""), "Exercise");
});

test("mapExercise reads live-shape metrics and prefers displayName", () => {
  const point: GhaExercisePoint = {
    name: "users/670/dataTypes/exercise/dataPoints/7288345100456020384",
    exercise: {
      interval: {
        startTime: "2026-07-04T05:17:56Z",
        startUtcOffset: "-18000s",
        endTime: "2026-07-05T00:06:11Z",
        endUtcOffset: "-18000s",
      },
      exerciseType: "WORKOUT",
      displayName: "Workout",
      activeDuration: "67694s",
      metricsSummary: {
        caloriesKcal: 308,
        averageHeartRateBeatsPerMinute: "115",
      },
    },
  };
  const row = mapExercise(point);
  assert.ok(row);
  assert.equal(row.id, "7288345100456020384");
  assert.equal(row.date, "2026-07-04"); // 00:17 device-local (-05:00)
  assert.equal(row.activityName, "Workout");
  assert.equal(row.durationMin, 1128); // activeDuration, not the interval
  assert.equal(row.calories, 308);
  assert.equal(row.avgHeartRate, 115);
  assert.equal(row.steps, null);
  assert.equal(row.distance, null);
  assert.equal(row.distanceUnit, null);

  assert.equal(mapExercise({ exercise: {} }), null);
});

test("mergeDailySeries reads civil dates and sums int64-string step counts", () => {
  const rows = mergeDailySeries(
    [
      {
        dailyRestingHeartRate: {
          date: { year: 2026, month: 7, day: 3 },
          beatsPerMinute: "69",
        },
      },
      { dailyRestingHeartRate: { date: { year: 2026, month: 7, day: 4 } } }, // no value
    ],
    [
      {
        dailyHeartRateVariability: {
          date: { year: 2026, month: 7, day: 3 },
          rmssd: "62.5",
        },
      },
    ],
    [
      {
        steps: {
          interval: {
            startTime: "2026-07-03T12:00:00Z",
            civilStartTime: { date: { year: 2026, month: 7, day: 3 } },
          },
          count: "10",
        },
      },
      {
        steps: {
          // Civil date wins over the UTC instant's local day.
          interval: {
            startTime: "2026-07-04T04:59:00Z",
            startUtcOffset: "-18000s",
            civilStartTime: { date: { year: 2026, month: 7, day: 3 } },
          },
          count: "25",
        },
      },
      { steps: { interval: { startTime: "2026-07-03T13:00:00Z" }, count: "0" } }, // skipped
    ],
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    date: "2026-07-03",
    restingHeartRate: 69,
    hrvDailyRmssd: 62.5,
    hrvDeepRmssd: null,
    steps: 35, // 10 + 25 as numbers, not "1025" string concat
  });
});

test("mergeDailySeries falls back to the UTC-offset day when civil date is absent", () => {
  const rows = mergeDailySeries(
    [],
    [],
    [
      {
        steps: {
          interval: { startTime: "2026-07-05T04:59:00Z", startUtcOffset: "-18000s" },
          count: "10",
        },
      },
    ],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-07-04"); // 23:59 the previous day at -05:00
  assert.equal(rows[0].steps, 10);
});
