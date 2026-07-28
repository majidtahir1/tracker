# iOS workout parity: cancel, swap exercise, choose workout — design

Approved 2026-07-28. Goal: bring three web workout features to the Capacitor iOS
app by exposing existing server logic through `/api/mobile/*` and adding mobile
UI. Web behavior is the reference semantics throughout.

## 1. Cancel an in-progress workout

- New server action `cancelWorkoutForMobile(sessionId)` in `lib/actions/workout.ts`:
  identical checks to the web `cancelWorkout` (ownership, `status !== "COMPLETED"`,
  hard delete of the session — SetLog/SessionExercise cascade) but returns
  `{ ok: boolean; error?: string }` instead of calling `redirect()` (which throws
  and cannot cross the mobile API boundary).
- Route: `action: "cancel"` with `{ sessionId }` in `app/api/mobile/workout/route.ts`.
- iOS UI (`SessionLogger` in `mobile/src/App.tsx`): a destructive "Cancel workout"
  button below "Finish workout". First tap swaps in an inline confirm —
  "Discard this workout and its logged sets?" with **Discard** / **Keep going**
  (same inline-confirm pattern as delete-account; no OS dialogs). Discard calls
  `cancel` and returns to the Workout overview.

## 2. Swap an exercise mid-workout

- Server: reuse `substituteExercise({ sessionExerciseId, newExerciseId, reason })`
  unchanged — it already returns plain JSON and permanently updates the template
  slot (progression lineage continues on the new exercise) plus logs a
  SubstitutionEvent.
- Route: `action: "substitute"` with `{ sessionExerciseId, newExerciseId }`,
  reason fixed to `"Swapped mid-session"` (web parity).
- Data: no change — `getSessionDetail` already ships `alternatives: {id, name}[]`
  per exercise to mobile.
- iOS UI (`ExerciseLogger`): a small "Swap" button in the exercise panel header.
  Expands an inline list of that exercise's curated alternatives; tapping one
  calls `substitute` then reloads the session (panel re-renders with the new
  exercise and server-recalculated targets). No free-text search (web parity).
  Empty state when the exercise has no curated alternatives.

## 3. Choose a different workout than scheduled

- Data: the mobile `workout` section (`app/api/mobile/data/[section]/route.ts`)
  additionally returns `{ programs, activeProgramId }` from the web's
  `getProgramOverview()` (every visible program with its active templates).
  Preview reuses the section's existing `?templateId=` override — the server
  ownership-checks it and returns `next` for that template with
  `next.isOverride = true`.
- Start: existing `start` action already accepts `templateId` +
  `scheduleOverride`; the picker starts with `scheduleOverride: true` and
  today's date.
- iOS UI (`WorkoutScreen`): below the next-workout card, a
  "Choose a different workout" button (hidden while a session is in progress —
  web parity; the server would silently resume the in-progress session anyway).
  Expands an inline list grouped by program, active program first. Tapping a
  workout re-fetches the overview with that `templateId`; the card above becomes
  a **preview** ("Instead of today's scheduled workout") and its Start button
  starts the chosen template. "Back to scheduled" clears the override.
  Preview-first was an explicit user choice over start-on-tap.

## Errors & testing

- All three actions surface `{ok:false,error}` in the app's existing error style.
- Server tests: `cancelWorkoutForMobile` rejects foreign and completed sessions;
  workout-section payload includes `programs`/`activeProgramId`; substitute and
  cancel route actions dispatch correctly. (DB-free tests where the codebase's
  node:test style allows; otherwise verified via the drive below.)
- UI verified via the vite bundle + Playwright at phone viewport
  (tracker-ios-build-workflow drive pattern), plus `mobile:typecheck` and
  `mobile:build`.

## Out of scope

- Free-text exercise search in the swap picker (web doesn't have it either).
- Editing/canceling completed workouts.
- Any web UI changes.
