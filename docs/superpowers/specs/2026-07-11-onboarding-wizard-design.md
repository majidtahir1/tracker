# First-Run Onboarding Wizard — Design

**Date:** 2026-07-11
**Status:** Approved

## Problem

Signup provisioning silently assigns the starter program and a training block, so a new user lands on a dashboard that presupposes choices they never made (feedback from first TestFlight run, 2026-07-11). There is no moment that captures a starting body weight or offers the WHOOP integration.

## Decisions (user-confirmed)

- **Steps:** program choice, starting body weight, WHOOP connect. Nutrition targets excluded.
- **Skippability:** fully skippable — every step has a skip, plus a global "Skip setup". Skipping keeps today's defaults (starter program active).
- **Entry:** immediately after signup at `/onboarding`, full-screen without app chrome. Existing/trained accounts never see it.
- **Units:** body weight is lb. The app is imperial-only end to end; a unit system is out of scope.

## Flow

1. Signup success redirects to `/onboarding` (was `/`).
2. Dashboard guard: redirect to `/onboarding` iff `AppSettings.onboardedAt` is null **and** the user has zero COMPLETED workout sessions. This re-prompts a brand-new user who quit mid-wizard, and exempts every account that has actually trained (covers pre-feature accounts with no backfill).
3. Completing or skipping stamps `onboardedAt` and routes to the destination (dashboard, or a program builder per step 1's choice).

## Steps

**1. "How do you want to train?"** — three choice cards:
- **Keep the starter program** (recommended, preselected). Pitch built from live data: program name, days/week, exercise count, ~minutes per session. Makes the provisioning default an informed choice.
- **Build it with the AI coach** — finish button routes to `/programs/new` afterward.
- **Build it myself** — routes to the manual program builder afterward.
The choice never blocks the remaining steps; it only changes the final destination. Starter program stays active in all cases until a new program is saved as active.

**2. Starting body weight** — one `lb` number input (30–1000 validated), saved as a `BodyMeasurement` for today (upsert on date). Skippable.

**3. WHOOP** — one-paragraph value pitch (recovery-aware weight recommendations), a Connect button that opens the existing `/api/whoop/auth` flow, and "I don't use WHOOP" to continue. Connecting returns to `/onboarding` (the whoop callback's redirect target is reused as-is if it lands on the dashboard — acceptable; the guard bounces back only if onboarding is unfinished, which is correct).

## Architecture

- **Schema:** `AppSettings.onboardedAt String?` (ISO datetime, null = not onboarded). `db:push`; no backfill.
- **`lib/onboarding.ts`:** `shouldOnboard(settings, completedCount): boolean` — pure, unit-tested.
- **`lib/actions/onboarding.ts`:** `completeOnboarding(input: { bodyWeightLb: number | null })` — validates weight (or null), upserts today's `BodyMeasurement.weight` when present, stamps `onboardedAt`, revalidates `/`. Returns `{ ok }`. Also `skipOnboarding()` = same minus measurement.
- **`app/onboarding/page.tsx`:** server component — requires auth; if already onboarded (or has completed sessions) redirects to `/`; loads starter-program stats (active program's template count, per-day exercise counts, est. minutes reusing the workout-overview estimate helper) and renders the wizard.
- **`components/onboarding/OnboardingWizard.tsx`:** client component — step state, progress dots, per-step skip, global "Skip setup". Destination after completion: `/` (starter), `/programs/new` (AI), manual builder route (build myself).
- **Dashboard guard:** in `app/page.tsx`, after loading settings + completed count, `redirect("/onboarding")` when `shouldOnboard` says so.
- **Signup redirect:** signup page's post-success navigation targets `/onboarding`.

## Error handling

- Action failures surface inline in the wizard; skip always works (stamping the flag is the only required write).
- If the active program is missing (empty catalog), step 1 renders without the starter card and preselects the AI builder.

## Testing

`tests/onboarding.test.ts`: `shouldOnboard` truth table (null flag × completed count), weight validation bounds of the action's pure validator. UI verified manually on phone + desktop.

## Out of scope

- Nutrition targets step, units system, feature tour overlays, editing onboarding answers later (Settings/Measurements already cover the data).
