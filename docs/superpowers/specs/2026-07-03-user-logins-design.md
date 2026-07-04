# User Logins — Design

Date: 2026-07-03
Status: Approved

## Goal

Add basic multi-user support so a small private group (the owner plus a few
trusted people) can each use the tracker with their own data. Username +
password login, open signup page, no email flows.

## Requirements

- Audience: owner + a few known people on a personal deployment. No public
  hardening (rate limiting, email verification, password reset) required.
- Login method: username + password.
- Account creation: open `/signup` page — anyone with the URL can register.
- Existing data: migrated to an account created for the owner; nothing lost.
- Exercise catalog and programs are **shared** across users; all logs and
  personal data are per-user.

## Auth layer

Use **Better Auth** with its **Prisma adapter** (SQLite) and the **username
plugin** so users sign in with username + password.

- If Better Auth still requires an email field under the hood, synthesize a
  placeholder (`<username>@tracker.local`) at signup. Verify against the
  Better Auth docs during implementation.
- Better Auth generates its own `User`, `Session`, `Account`, and
  `Verification` models into `prisma/schema.prisma`, plus a catch-all API
  route at `app/api/auth/[...all]`.
- Email verification, password reset, and rate limiting stay **off**.
- New pages: `/login` and `/signup`. The existing layout gains a small user
  menu with a logout action.

## Enforcement

- `lib/auth.ts` exposes `requireUser()`: reads the Better Auth session from
  the cookie server-side and redirects to `/login` if absent; returns the
  current user otherwise.
- Every page and server action calls `requireUser()`.
- All functions in `lib/queries/*` and `lib/actions/*` take (or derive) an
  explicit `userId` parameter so no query can accidentally cross users.

## Data model changes

### Stays global (shared catalog)

`Exercise`, `ExerciseAlternative`, `Program`, `WorkoutTemplate`,
`TemplateExercise`.

### Per-user fields split out of the catalog

- `Exercise.isFavorite` moves to a new `UserExercisePref` table
  (`userId`, `exerciseId`, `isFavorite`, unique on `[userId, exerciseId]`).
  Catalog-level `notes` and `injuryFriendly` stay global.
- `Program.isActive` is removed and replaced by `activeProgramId` on the
  per-user settings row.

### Gains a `userId` column (relation to `User` + index)

`TrainingBlock`, `WorkoutSession`, `PersonalRecord`, `BodyMeasurement`,
`ProgressPhoto`, `NutritionLog`, `RecoveryLog`, `Goal`, `Notification`,
`CoachBrief`, `SubstitutionEvent`, `WhoopCycle`, `WhoopRecovery`,
`WhoopSleep`, `WhoopWorkout`.

Children inherit scope through their parents: `SessionExercise`, `SetLog`
(via `WorkoutSession`), `BlockOverride` (via `TrainingBlock`).

### Singletons become per-user rows

- `WhoopConnection`: `id "singleton"` → keyed by `userId` (unique).
- `AppSettings`: same, and gains `activeProgramId`.

WHOOP `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET` env vars stay global — one
WHOOP developer app; each user OAuths their own WHOOP account through it.

## Migration of existing data

One-time script run via `npm run db:migrate-users` after `prisma db push`:

1. Creates the owner's account. Username and password are read from
   `MIGRATE_USERNAME` / `MIGRATE_PASSWORD` env vars; the script fails with a
   clear message if they are unset.
2. Backfills `userId` on every existing row of the tables listed above.
3. Converts the `WhoopConnection` and `AppSettings` singletons to rows keyed
   by the owner's `userId`, carrying the currently active program into
   `activeProgramId`.
4. Creates `UserExercisePref` rows from current `Exercise.isFavorite` values.

## Testing

- Existing unit tests (pure lib logic) are unaffected.
- New tests cover userId scoping of query helpers and the
  favorite/active-program pref logic.
- Auth flows get a manual smoke test: signup → login → data isolation
  between two accounts → logout.

## Out of scope

- Password reset, email verification, OAuth providers, rate limiting.
- Admin UI for managing users.
- Per-user custom exercises or programs (catalog remains shared and
  owner-seeded).
