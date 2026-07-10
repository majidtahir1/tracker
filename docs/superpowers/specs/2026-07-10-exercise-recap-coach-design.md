# Exercise Recap Coach — Design

**Date:** 2026-07-10
**Status:** Approved

## Problem

The workout logger has a manual, mid-exercise "Ask Coach" flow (`askSetCoach`) that prescribes the next set's weight under guardrails. There is no feedback moment when an exercise is *finished*. The user wants automatic AI coach feedback when the last set of an exercise is checked off — motivating, realistic, and giving concrete direction for the rest of the workout.

## Decisions (user-confirmed)

- **Placement:** feedback rides with the existing auto-advance — a dismissible coach banner at the top of the newly expanded next exercise card. After the final exercise, it renders above the bottom Finish area.
- **Trigger:** automatic for every exercise whose sets all complete (one LLM call per exercise, ~6 per workout). Never in edit mode.
- **Context:** whole session — the finished exercise vs. history, remaining exercises, recovery/WHOOP, program week/phase.
- **Persistence:** ephemeral client state. Not stored; gone on reload. This is deliberate — the recap is in-the-moment coaching, not a record.

## Architecture

New, parallel to the set coach (not bolted onto it — `askSetCoach`'s response schema and guardrail validation are about prescribing a next-set weight, which is meaningless after the last set).

### Server

**`lib/ai/exercise-recap-types.ts`**

```ts
export interface ExerciseRecapResponse {
  headline: string;      // ≤100 chars, e.g. "Pressing volume up 8% on last week."
  message: string;       // ≤240 chars, realistic assessment of the completed exercise
  focusCue: string;      // ≤160 chars, one concrete direction for the rest of the workout
  source: "minimax" | "deterministic";
}
```

**`lib/ai/exercise-recap-prompt.ts`** — `EXERCISE_RECAP_SYSTEM_PROMPT`. Tone: direct, encouraging, realistic. Rules: use only the supplied JSON context; never invent history; compare against previous sessions only when history is present; exactly one concrete focus cue for the remaining work (or a finishing cue when no exercises remain); no weight prescriptions for the completed exercise; JSON-only output with keys `headline`, `message`, `focusCue`.

**`lib/ai/exercise-recap-fallback.ts`** — pure deterministic fallback, unit-testable:
- Compares completed sets against the most recent prior session for the slot: total volume and top set (weight × reps). Produces "beat / matched / just under last time" phrasing; a no-history variant for first sessions.
- Focus cue from remaining work: "N exercises (M sets) to go — keep rest honest" variants, or a finish-line message when it was the last exercise.

**`lib/ai/exercise-recap-provider.ts`** — MiniMax call following the set-coach provider pattern (same env vars, 15s timeout, JSON extraction, per-field length clamping). Returns `null` on any failure.

**`lib/actions/exercise-recap.ts`** — `"use server"`; `getExerciseRecap(sessionExerciseId): Promise<{ ok: true; recap: ExerciseRecapResponse } | { ok: false; error: string }>`:
1. Auth via `requireUserId`; load the sessionExercise with exercise, templateExercise, session, completed sets, and the session's sibling exercises (with their completed-set counts and targets). Reject if not found/not owner or session not `IN_PROGRESS`.
2. Require all target sets completed (`completedSets >= targetSets`); otherwise `{ ok: false }`.
3. Gather history (last 2 completed non-deload sessions for the slot — same query shape as `askSetCoach`), effective recovery, and WHOOP day context.
4. Build context JSON: finished exercise (name, prescription, completed sets), history, remaining exercises `[{ name, setsRemaining, targetReps }]`, totals (sets done/left in session), recovery score, WHOOP block if present, program week/phase/isDeload.
5. `requestMiniMaxRecap(context) ?? deterministicRecap(...)` — the action never fails user-visibly once past validation.

### Client (`components/workout/WorkoutLogger.tsx`)

- New state: `recap: { forExerciseId: string | null; data: ExerciseRecapResponse } | null` — `forExerciseId` is the *next* exercise's sessionExerciseId, or `null` when the finished exercise was the last (rendered above the Finish bar).
- In `toggleRow`, inside the existing "all rows complete" branch (which already computes `nextEx`): fire `getExerciseRecap(ex.sessionExerciseId)` in the same transition, non-blocking for the UI; on `ok`, set recap state. Skipped entirely in `editMode`.
- A completed exercise re-triggering (e.g. unchecking and rechecking a set) simply replaces the current recap.
- `RecapBanner` component: accent-muted card with Sparkles icon, `headline` bold, `message`, `focusCue` as a highlighted line, dismiss (X) button. Rendered at the top of the expanded card whose id matches `forExerciseId`, or above the bottom bar when `forExerciseId` is null.
- While the call is in flight, nothing is shown (no spinner) — the banner appears when ready. If the user has moved on past the target exercise, the banner still renders on that card (state keyed by id, not by "currently expanded").

## Error handling

- MiniMax unavailable/slow/malformed → deterministic fallback (labelled "Local coaching fallback" like the set coach panel).
- Action-level validation failures (not in progress, sets incomplete, not owner) → `{ ok: false }`; client silently discards. Auto-fired calls must never surface errors.

## Testing

`tests/exercise-recap.test.ts`:
- `deterministicRecap`: beat / matched / under / no-history / last-exercise / deload variants.
- Provider parser: valid JSON accepted and clamped; garbage, missing keys, over-length fields → null.

Client trigger logic remains in the component (matches existing codebase style — no component test infra); verified manually in the running app.

## Out of scope

- Persisting recaps (e.g. for the session summary page).
- Recap on the session summary / finish screen.
- Streaming or loading indicators.
