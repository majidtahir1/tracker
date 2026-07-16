/**
 * lib/insights.ts — deterministic training insights for the mobile Analytics
 * tab (docs/superpowers/specs/2026-07-16-mobile-analytics-insights-design.md).
 * Pure: no Prisma, no clock — the caller injects `today` and query results.
 * Every number is computed; nothing is generated.
 */
import type { AnalyticsData, ExerciseSeries } from "@/lib/queries/analytics";
import type { TimelineEntry } from "@/lib/queries/records";
import { PR_TYPE_LABELS } from "@/lib/pr";
import { addDays, type LocalDate } from "@/lib/dates";

export type InsightDirection = "up" | "down" | "warn" | "info";

export interface Insight {
  kind: "strength" | "pr" | "volume" | "consistency" | "bodyweight" | "recovery" | "empty";
  headline: string;
  detail: string;
  direction: InsightDirection;
}

export interface InsightsInput {
  analytics: AnalyticsData;
  /** Records timeline, newest first. */
  prTimeline: TimelineEntry[];
  streakWeeks: number;
  /** Current training block start (Monday), or null before any block. */
  blockStart: LocalDate | null;
  today: LocalDate;
}

/** e1RM change: latest point vs the newest point at least ~4 weeks older. */
function seriesDelta(series: ExerciseSeries, today: LocalDate): { delta: number; from: number; to: number; weeks: number } | null {
  const points = series.series;
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const cutoff = addDays(today, -28);
  let baseline = points[0];
  for (const point of points) {
    if (point.date <= cutoff) baseline = point;
    else break;
  }
  if (baseline === latest) baseline = points[0];
  const spanDays = Math.max(
    7,
    Math.round((Date.parse(latest.date) - Date.parse(baseline.date)) / 86_400_000),
  );
  return {
    delta: Math.round(latest.e1rm - baseline.e1rm),
    from: Math.round(baseline.e1rm),
    to: Math.round(latest.e1rm),
    weeks: Math.max(1, Math.round(spanDays / 7)),
  };
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** ISO day of week 1-7 (Mon-Sun) without touching the runtime timezone. */
function isoDow(date: LocalDate): number {
  const utcDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

export function deriveInsights(input: InsightsInput): Insight[] {
  const { analytics, prTimeline, streakWeeks, blockStart, today } = input;

  if (!analytics.hasSessions) {
    return [{
      kind: "empty",
      headline: "No training data yet",
      detail: "Log a few workouts and this page starts tracking strength trends, PRs, volume gaps, and consistency.",
      direction: "info",
    }];
  }

  const insights: Insight[] = [];

  // 1. Strength — big four, plus the biggest mover outside it.
  const bigFourNames = new Set(analytics.bigFour.map((s) => s.name));
  const steady: string[] = [];
  for (const series of analytics.bigFour) {
    const change = seriesDelta(series, today);
    if (!change) continue;
    if (Math.abs(change.delta) < 1) {
      steady.push(series.name);
      continue;
    }
    insights.push({
      kind: "strength",
      headline: `${series.name} e1RM ${signed(change.delta)} lb`,
      detail: `${change.from} lb → ${change.to} lb over ~${change.weeks} wk${change.weeks === 1 ? "" : "s"}`,
      direction: change.delta > 0 ? "up" : "down",
    });
  }
  if (steady.length > 0) {
    insights.push({
      kind: "strength",
      headline: `${steady.length === 1 ? steady[0] : `${steady.length} lifts`} holding steady`,
      detail: `${steady.join(", ")} — e1RM within 1 lb of four weeks ago.`,
      direction: "info",
    });
  }
  let mover: { name: string; change: NonNullable<ReturnType<typeof seriesDelta>> } | null = null;
  for (const series of analytics.allSeries) {
    if (bigFourNames.has(series.name)) continue;
    const change = seriesDelta(series, today);
    if (!change || Math.abs(change.delta) < 5) continue;
    if (!mover || Math.abs(change.delta) > Math.abs(mover.change.delta)) mover = { name: series.name, change };
  }
  if (mover) {
    insights.push({
      kind: "strength",
      headline: `${mover.name} e1RM ${signed(mover.change.delta)} lb`,
      detail: `Biggest mover outside the big four: ${mover.change.from} lb → ${mover.change.to} lb.`,
      direction: mover.change.delta > 0 ? "up" : "down",
    });
  }

  // 2. PRs this block (fallback: last 4 weeks) + the most recent one.
  const prWindowStart = blockStart ?? addDays(today, -28);
  const windowPrs = prTimeline.filter((pr) => pr.date >= prWindowStart);
  if (windowPrs.length > 0) {
    const latest = windowPrs[0];
    const setLabel = latest.type === "MOST_SESSION_VOLUME"
      ? `${Math.round(latest.value).toLocaleString("en-US")} lb session volume`
      : latest.weight != null && latest.reps != null
        ? `${latest.weight}×${latest.reps} (${PR_TYPE_LABELS[latest.type].replace("PR · ", "").toLowerCase()})`
        : `${Math.round(latest.value * 10) / 10} ${PR_TYPE_LABELS[latest.type].replace("PR · ", "").toLowerCase()}`;
    insights.push({
      kind: "pr",
      headline: `${windowPrs.length} PR${windowPrs.length === 1 ? "" : "s"} ${blockStart ? "this block" : "in 4 weeks"}`,
      detail: `Latest: ${latest.exerciseName}, ${setLabel}.`,
      direction: "up",
    });
  }

  // 3. Volume gaps — only meaningful from Thursday on; early week everything
  // is trivially "under target".
  if (isoDow(today) >= 4) {
    const gaps = analytics.currentWeekMuscles
      .filter((row) => row.target > 0 && row.sets / row.target < 0.6)
      .sort((a, b) => a.sets / a.target - b.sets / b.target)
      .slice(0, 3);
    for (const gap of gaps) {
      insights.push({
        kind: "volume",
        headline: `${gap.label} behind target`,
        detail: `${gap.sets} of ${gap.target} weekly sets so far this week.`,
        direction: "warn",
      });
    }
  }

  // 4. Consistency.
  if (streakWeeks > 0) {
    insights.push({
      kind: "consistency",
      headline: `${streakWeeks}-week streak`,
      detail: "Every scheduled session completed, week after week.",
      direction: "up",
    });
  } else if (analytics.stats.sessionsPerWeek != null) {
    insights.push({
      kind: "consistency",
      headline: `${analytics.stats.sessionsPerWeek} sessions/week`,
      detail: `Plan calls for 4. Consistency ${analytics.stats.consistencyPct ?? 0}% over this range.`,
      direction: analytics.stats.sessionsPerWeek >= 3.5 ? "up" : "warn",
    });
  }

  // 5. Body weight — moving average now vs ~4 weeks ago.
  const ma = analytics.bodyWeight.filter((p) => p.ma != null);
  if (ma.length >= 2) {
    const latest = ma[ma.length - 1];
    const cutoff = addDays(today, -28);
    let baseline = ma[0];
    for (const point of ma) {
      if (point.date <= cutoff) baseline = point;
      else break;
    }
    const delta = Math.round((latest.ma! - baseline.ma!) * 10) / 10;
    if (Math.abs(delta) >= 0.5) {
      insights.push({
        kind: "bodyweight",
        headline: `Body weight ${signed(delta)} lb`,
        detail: `Trend average ${baseline.ma} lb → ${latest.ma} lb since ${baseline.label}.`,
        direction: delta > 0 ? "up" : "down",
      });
    }
  }

  // 6. Recovery — wearable trend, last week vs the week before.
  const recovery = analytics.whoop.recoveryTrend;
  if (analytics.whoop.hasData && recovery.length >= 4) {
    const last = recovery.slice(-7);
    const prior = recovery.slice(-14, -7);
    const lastAvg = Math.round(last.reduce((n, r) => n + r.score, 0) / last.length);
    const lastThree = recovery.slice(-3);
    if (lastThree.length === 3 && lastThree.every((r) => r.score < 40)) {
      insights.push({
        kind: "recovery",
        headline: "Recovery in the red",
        detail: `Last three scores under 40 — consider easing intensity.`,
        direction: "warn",
      });
    } else if (prior.length > 0) {
      const priorAvg = Math.round(prior.reduce((n, r) => n + r.score, 0) / prior.length);
      const delta = lastAvg - priorAvg;
      insights.push({
        kind: "recovery",
        headline: `Recovery averaging ${lastAvg}`,
        detail: `${signed(delta)} vs the week before.`,
        direction: delta >= 0 ? "up" : "down",
      });
    }
  }

  return insights;
}
