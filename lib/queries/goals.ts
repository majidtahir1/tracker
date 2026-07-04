/**
 * lib/queries/goals.ts — goals read layer. Current values are DERIVED here
 * on the server (latest measurements + best stored e1RM PRs), never stored
 * (ARCHITECTURE.md schema note on Goal).
 */
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { fmtLocalDate, localToday, diffDays, parseLocalDate } from "@/lib/dates";
import type { GoalType } from "@/lib/generated/prisma/enums";
import {
  GOAL_EXERCISE_NAMES,
  MEASUREMENT_FIELD_LABELS,
  goalKey,
} from "@/components/goals/goal-meta";

export interface GoalView {
  id: string;
  type: GoalType;
  measurementField: string | null;
  label: string;
  unit: string;
  startValue: number;
  targetValue: number;
  targetDate: string | null;
  createdDate: string; // YYYY-MM-DD
  /** Derived from latest measurement / best e1RM PR; null when no data yet. */
  currentValue: number | null;
  /** 0–100+, clamped at 0. Direction-aware (works for cut goals too). */
  pct: number;
  achieved: boolean;
  /** Has a target date and is tracking behind linear pace. */
  behindPace: boolean;
  /** "on pace · ~Oct 2026" style projection, when computable. */
  projection: string | null;
}

export interface GoalsPageData {
  goals: GoalView[];
  /** Prefill values for the goal form, keyed by goal key (type or type:field). */
  currentValues: Record<string, number>;
}

async function deriveCurrentValues(userId: string): Promise<Record<string, number>> {
  const values: Record<string, number> = {};

  // Latest non-null value per measurement column (scan newest → oldest).
  const measurements = await prisma.bodyMeasurement.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 60,
  });
  for (const m of measurements) {
    if (values.BODY_WEIGHT === undefined && m.weight != null) values.BODY_WEIGHT = m.weight;
    if (values.BODY_FAT === undefined && m.bodyFat != null) values.BODY_FAT = m.bodyFat;
    for (const field of Object.keys(MEASUREMENT_FIELD_LABELS)) {
      const key = `MEASUREMENT:${field}`;
      const v = (m as unknown as Record<string, unknown>)[field];
      if (values[key] === undefined && typeof v === "number") values[key] = v;
    }
  }

  // Best stored e1RM PR per big-4 exercise.
  const prExerciseNames = Object.values(GOAL_EXERCISE_NAMES);
  const prs = await prisma.personalRecord.findMany({
    where: { userId, type: "BEST_E1RM", exercise: { name: { in: prExerciseNames } } },
    include: { exercise: { select: { name: true } } },
  });
  for (const [type, name] of Object.entries(GOAL_EXERCISE_NAMES)) {
    const best = prs
      .filter((p) => p.exercise.name === name)
      .reduce((max, p) => Math.max(max, p.value), 0);
    if (best > 0) values[type] = Math.round(best);
  }

  return values;
}

export async function getGoalsPageData(): Promise<GoalsPageData> {
  const userId = await requireUserId();
  const [goals, currentValues] = await Promise.all([
    prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    deriveCurrentValues(userId),
  ]);
  const today = localToday();

  const views: GoalView[] = goals.map((g) => {
    const key = goalKey(g.type, g.measurementField);
    const currentValue = currentValues[key] ?? null;
    const createdDate = fmtLocalDate(g.createdAt);

    const span = g.targetValue - g.startValue; // negative for cut goals
    const progressed = currentValue != null ? currentValue - g.startValue : 0;
    let pct = 0;
    if (currentValue != null) {
      pct = span === 0 ? 100 : (progressed / span) * 100;
      pct = Math.max(0, Math.round(pct * 10) / 10);
    }
    const achieved =
      g.achievedAt != null ||
      (currentValue != null &&
        (span >= 0 ? currentValue >= g.targetValue : currentValue <= g.targetValue));

    // Pace vs a linear createdAt → targetDate schedule.
    let behindPace = false;
    if (!achieved && g.targetDate && currentValue != null) {
      const total = diffDays(createdDate, g.targetDate);
      const elapsed = diffDays(createdDate, today);
      if (total > 0 && elapsed > 0) {
        const expectedPct = Math.min(100, (elapsed / total) * 100);
        behindPace = pct + 5 < expectedPct; // 5-point tolerance
      }
    }

    // Projection from the observed rate since the goal was created.
    let projection: string | null = null;
    if (achieved) {
      projection = null;
    } else if (currentValue != null) {
      const elapsed = diffDays(createdDate, today);
      const towardTarget = span >= 0 ? progressed : -progressed;
      if (elapsed >= 7 && towardTarget > 0) {
        const remaining = Math.abs(g.targetValue - currentValue);
        const rate = towardTarget / elapsed; // units per day
        const daysLeft = Math.ceil(remaining / rate);
        const eta = new Date(parseLocalDate(today));
        eta.setDate(eta.getDate() + daysLeft);
        const etaLabel = eta.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        projection = `${behindPace ? "behind pace" : "on pace"} · ~${etaLabel}`;
      } else if (behindPace) {
        projection = "behind pace";
      }
    }

    return {
      id: g.id,
      type: g.type,
      measurementField: g.measurementField,
      label: g.label,
      unit: g.unit,
      startValue: g.startValue,
      targetValue: g.targetValue,
      targetDate: g.targetDate,
      createdDate,
      currentValue,
      pct: achieved ? Math.max(pct, 100) : Math.min(pct, 99.9),
      achieved,
      behindPace,
      projection,
    };
  });

  return { goals: views, currentValues };
}
