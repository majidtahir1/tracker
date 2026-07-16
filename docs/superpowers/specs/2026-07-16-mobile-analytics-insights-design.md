# Mobile Analytics → Insights

**Date:** 2026-07-16
**Status:** Approved

## Problem

The iOS Analytics tab adds little value: three number tiles (session count,
series count, "WHOOP connected") and a raw `DataSummary` dump. The web page
has ten charts; shrinking them onto a phone was rejected in favor of a
different product: written, computed insights that answer "am I progressing?"
at a glance.

## Decision summary

- **Scope:** mobile only; web analytics unchanged.
- **Content:** deterministic insights — computed facts with deltas and
  direction markers. No charts, no AI (distinct from the dashboard's MiniMax
  daily coach; works without AI consent, never misstates a number).
- **Engine location:** server-side pure function so it is unit-testable and
  reusable by web later.

## Engine — `lib/insights.ts` (pure)

```ts
type InsightDirection = "up" | "down" | "warn" | "info";
interface Insight {
  kind: "strength" | "pr" | "volume" | "consistency" | "bodyweight" | "recovery" | "empty";
  headline: string;   // "Bench Press e1RM +12 lb"
  detail: string;     // "231 lb → 243 lb over the last 4 weeks"
  direction: InsightDirection;
}
deriveInsights(input): Insight[]
```

Input is assembled by the caller from existing queries: `AnalyticsData`
(`getAnalyticsData("12W")`), the PR timeline, and streak data. The function is
pure — no Prisma, no Date.now() (caller passes "today").

### Catalog (fixed order; each card names its own window — no range toggle)

1. **Strength** — per big-four lift with ≥2 e1RM points: delta of latest
   point vs the point ~4 weeks prior (fallback: earliest in range). Also the
   single biggest mover outside the big four. Direction up/down; flat (<1 lb
   change) collapses into one "holding steady" card.
2. **PRs** — count within the current block plus the most recent PR
   (exercise, value, type). Skipped when zero.
3. **Volume gaps** — from `currentWeekMuscles`: muscles at <60% of weekly
   target mid/late week; worst 2–3 only, direction "warn".
4. **Consistency** — streak weeks + sessions/week vs the 4/week plan
   (`stats.sessionsPerWeek`, `stats.consistencyPct`).
5. **Body weight** — latest moving average vs ~4 weeks prior; skipped without
   ≥2 measurements.
6. **Recovery** — only when wearable data exists in range: average recovery
   this range vs prior stretch, or low-recovery streak warning.
7. **Empty** — `hasSessions === false` → single "info" card inviting the user
   to log workouts; suppresses all other cards.

## API

New `case "insights"` in `app/api/mobile/data/[section]/route.ts`:
returns `{ insights: Insight[], stats: { completedSessions, prCount, streakWeeks } }`.
The existing `analytics` section remains (web + older app builds).

## Mobile UI (`mobile/src/App.tsx` — AnalyticsScreen)

Rewritten: headline stat row (sessions, PRs, streak), then one card per
insight — icon by direction (up ↑ accent, down ↓ muted, warn ⚠ warning
color, info neutral), headline bold, detail small. No charts, no DataSummary.

## Testing

- Unit tests for `deriveInsights` in `tests/insights.test.ts` (suite is pure
  functions only): trending up, trending down, flat collapse, volume gap
  threshold, empty data, no-wearable skip, PR presence/absence.
- Manual verification: Playwright drive of the rewritten screen at iPhone
  viewport against the dev server.

## Out of scope

- Web analytics changes; range toggle; AI-generated summaries; persisting
  insights.
