/**
 * tests/whoop-mappers.test.ts — pure WHOOP payload → Prisma-row mappers.
 * Run with `npm test` (tsx --test, TZ pinned to America/New_York so the
 * UTC→local day conversion is deterministic).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapCycle,
  mapRecovery,
  mapSleep,
  mapWorkout,
  utcToLocalDate,
} from "../lib/whoop/mappers";
import type {
  WhoopCycleRecord,
  WhoopRecoveryRecord,
  WhoopSleepRecord,
  WhoopWorkoutRecord,
} from "../lib/whoop/types";

// 03:30 UTC on Jul 2 is 23:30 Jul 1 in New York (EDT, UTC-4).
test("utcToLocalDate converts UTC instants to the local day", () => {
  assert.equal(utcToLocalDate("2026-07-02T03:30:00.000Z"), "2026-07-01");
  assert.equal(utcToLocalDate("2026-07-02T12:00:00.000Z"), "2026-07-02");
});

test("mapCycle maps a scored cycle", () => {
  const record: WhoopCycleRecord = {
    id: 93845,
    start: "2026-07-01T08:00:00.000Z",
    end: "2026-07-02T08:00:00.000Z",
    score_state: "SCORED",
    score: { strain: 14.32, kilojoule: 8500.5, average_heart_rate: 72, max_heart_rate: 165 },
  };
  const row = mapCycle(record);
  assert.equal(row.id, "93845");
  assert.equal(row.date, "2026-07-01");
  assert.equal(row.strain, 14.32);
  assert.equal(row.avgHeartRate, 72);
  assert.ok(row.end instanceof Date);
});

test("mapCycle handles in-progress, unscored cycles", () => {
  const row = mapCycle({ id: "1", start: "2026-07-02T08:00:00.000Z", end: null, score_state: "PENDING_SCORE", score: null });
  assert.equal(row.end, null);
  assert.equal(row.strain, null);
  assert.equal(row.kilojoule, null);
});

test("mapRecovery takes its date from the parent cycle and rounds the score", () => {
  const record: WhoopRecoveryRecord = {
    cycle_id: 93845,
    sleep_id: "sleep-uuid",
    score_state: "SCORED",
    created_at: "2026-07-05T09:00:00.000Z",
    score: { user_calibrating: false, recovery_score: 66.7, resting_heart_rate: 52.1, hrv_rmssd_milli: 84.4 },
  };
  const row = mapRecovery(record, new Map([["93845", "2026-07-01"]]));
  assert.equal(row.cycleId, "93845");
  assert.equal(row.date, "2026-07-01"); // cycle wins over created_at
  assert.equal(row.recoveryScore, 67);
  assert.equal(row.hrvRmssdMilli, 84.4);
  assert.equal(row.userCalibrating, false);
});

test("mapRecovery falls back to created_at's day when the cycle is unknown", () => {
  const row = mapRecovery(
    { cycle_id: 1, score_state: "PENDING_SCORE", created_at: "2026-07-05T09:00:00.000Z", score: null },
    new Map(),
  );
  assert.equal(row.date, "2026-07-05");
  assert.equal(row.recoveryScore, null);
  assert.equal(row.userCalibrating, false);
});

test("mapSleep returns null for in-progress sleeps and keeps flagged naps", () => {
  const base: WhoopSleepRecord = {
    id: "uuid-1",
    start: "2026-07-01T03:00:00.000Z",
    end: null,
    nap: false,
    score_state: "PENDING_SCORE",
  };
  assert.equal(mapSleep(base), null);

  const nap = mapSleep({ ...base, end: "2026-07-01T04:00:00.000Z", nap: true });
  assert.ok(nap);
  assert.equal(nap.isNap, true);
  assert.equal(nap.date, "2026-07-01"); // 00:00 EDT wake
});

test("mapSleep maps stage summary and sleep debt", () => {
  const record: WhoopSleepRecord = {
    id: "uuid-2",
    start: "2026-07-01T03:00:00.000Z",
    end: "2026-07-01T11:00:00.000Z",
    nap: false,
    score_state: "SCORED",
    score: {
      stage_summary: {
        total_in_bed_time_milli: 28800000,
        total_awake_time_milli: 1800000,
        total_light_sleep_time_milli: 14400000,
        total_slow_wave_sleep_time_milli: 7200000,
        total_rem_sleep_time_milli: 5400000,
        sleep_cycle_count: 5,
        disturbance_count: 8,
      },
      sleep_needed: { need_from_sleep_debt_milli: 900000 },
      respiratory_rate: 15.2,
      sleep_performance_percentage: 91,
      sleep_efficiency_percentage: 93.5,
    },
  };
  const row = mapSleep(record);
  assert.ok(row);
  assert.equal(row.date, "2026-07-01"); // 07:00 EDT wake
  assert.equal(row.inBedMilli, 28800000);
  assert.equal(row.slowWaveSleepMilli, 7200000);
  assert.equal(row.sleepDebtMilli, 900000);
  assert.equal(row.performancePct, 91);
  assert.equal(row.consistencyPct, null);
});

test("mapWorkout maps a scored workout on its start day", () => {
  const record: WhoopWorkoutRecord = {
    id: "uuid-3",
    sport_name: "Running",
    start: "2026-07-01T22:00:00.000Z",
    end: "2026-07-01T23:00:00.000Z",
    score_state: "SCORED",
    score: { strain: 10.5, average_heart_rate: 148, max_heart_rate: 176, kilojoule: 2500, distance_meter: 8046.7 },
  };
  const row = mapWorkout(record);
  assert.equal(row.date, "2026-07-01"); // 18:00 EDT
  assert.equal(row.sportName, "Running");
  assert.equal(row.strain, 10.5);
  assert.equal(row.distanceMeter, 8046.7);
  assert.equal(row.altitudeGainMeter, null);
});
