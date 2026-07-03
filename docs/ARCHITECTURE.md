# Hypertrophy Training Tracker — Architecture Spec (v1)

Status: **APPROVED baseline**. Implements docs/PRD.md against docs/PROGRAM.md (Program v1.0).
Single local user, no auth, no exports, no AI coach.

---

## 1. Tech Stack (fixed)

| Concern | Choice |
|---|---|
| Framework | Next.js 15, App Router, React Server Components |
| Language | TypeScript (strict mode) |
| ORM / DB | Prisma + SQLite (`prisma/dev.db`) |
| Styling | Tailwind CSS v4 (CSS-first config in `app/globals.css`) |
| Charts | Recharts (client components only) |
| Mutations | **Server actions only** (`"use server"` in `lib/actions/*`). No REST/tRPC API layer. The single exception: `app/api/photos/upload/route.ts` for multipart photo upload (server actions handle the DB row; the route handler streams the file to disk). |
| Auth | None |
| IDs | `cuid()` everywhere |
| Runtime | `npm run dev` locally; Node runtime for all routes (SQLite requires it — no edge) |

---

## 2. Prisma Schema (complete, paste-ready)

### Key modeling decisions (read first)

1. **Progression slot = `TemplateExercise`.** Progression history follows the *slot in the template*, not the exercise. Substituting an exercise updates `TemplateExercise.exerciseId` in place (the row id is stable), and a `SubstitutionEvent` records the swap for audit/display. All session logs hang off `SessionExercise.templateExerciseId`, so the recommendation engine and charts read one continuous history across substitutions. This satisfies "substituting keeps progression history" with zero migration of old logs.
2. **Block/week set targets are computed, not duplicated.** `TemplateExercise.baseSets` holds Block 1 sets. `BlockOverride` rows add `+N sets` for specific template exercises in Block 2/3. Week 13 deload is a *transform* applied at session generation time: `sets = ceil(effectiveSets / 2)`, `targetWeightPct = 0.825` (midpoint of 80–85%). Nothing about deload is stored in templates.
3. **PRs are STORED (`PersonalRecord` table), detected at set-save time.** Justification: (a) the dashboard needs "PR count" and "new PR" badges cheaply and repeatedly — deriving would scan every set log on every render; (b) a PR is an *event* with a date the user was notified about, and badges/notifications must not retroactively disappear if a later edit changes derivation; (c) storage is tiny (4 record types × ~30 exercises). Derivation logic still lives in `lib/pr.ts` and a `recomputePRs()` action exists for repair after log edits — stored is the source of truth, derived is the reconciler.
4. **Sessions snapshot their targets.** When a session is generated, each `SessionExercise` copies resolved `targetSets/targetRepMin/targetRepMax/targetRir/restSeconds` so historical sessions render exactly as prescribed at the time, even if templates change later.
5. **Weights in lb (Float), dates as described in §7.**

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// ---------- Enums (SQLite: emulated as String with app-level unions is NOT
// needed — Prisma supports enums on SQLite as of Prisma 5+ via check-less
// string columns; we declare them for type safety.) ----------

enum MuscleGroup {
  CHEST
  UPPER_CHEST
  BACK
  LATS
  FRONT_DELTS
  LATERAL_DELTS
  REAR_DELTS
  TRICEPS
  BICEPS
  FOREARMS
  QUADS
  HAMSTRINGS
  GLUTES
  CALVES
  CORE
}

enum Equipment {
  BARBELL
  DUMBBELL
  MACHINE
  CABLE
  BODYWEIGHT
}

enum ExerciseType {
  HEAVY_COMPOUND     // rest 150-180s
  COMPOUND           // rest 120-180s
  MACHINE_COMPOUND   // rest 90-120s
  ISOLATION          // rest 60-90s
  CORE               // rest 45-60s
}

enum Priority {
  HIGHEST
  HIGH
  MEDIUM
  NORMAL   // "—" in the program tables
}

enum Difficulty {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}

enum SessionStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  SKIPPED
}

enum PrType {
  HEAVIEST_WEIGHT
  BEST_E1RM
  MOST_REPS        // at any weight >= previous rep PR weight, see lib/pr.ts
  MOST_SESSION_VOLUME
}

enum PhotoAngle {
  FRONT
  SIDE
  BACK
}

enum NotificationType {
  PROGRESSION      // "Increase Bench Press next workout"
  DELOAD_UPCOMING  // "Deload starts next week"
  DELOAD_ACTIVE
  PHOTO_REMINDER   // monthly
  MEASUREMENT_REMINDER
  NUTRITION_REMINDER // "Protein not logged today"
  PR_ACHIEVED
  FATIGUE_WARNING  // recovery score low -> suggest reducing load
}

enum GoalType {
  BODY_WEIGHT
  BODY_FAT
  BENCH_1RM
  SQUAT_1RM
  DEADLIFT_1RM
  SHOULDER_PRESS_1RM
  MEASUREMENT      // uses measurementField
}

// ---------- Exercise library ----------

model Exercise {
  id               String        @id @default(cuid())
  name             String        @unique
  primaryMuscle    MuscleGroup
  // JSON array of MuscleGroup strings, e.g. ["FRONT_DELTS","TRICEPS"]
  secondaryMuscles String        @default("[]")
  equipment        Equipment
  type             ExerciseType
  difficulty       Difficulty    @default(INTERMEDIATE)
  videoUrl         String?
  notes            String?
  isFavorite       Boolean       @default(false)
  injuryFriendly   Boolean       @default(false)
  // lb added when double progression triggers (5 barbell/machine stack pairs, 2.5 small isolation)
  weightIncrement  Float         @default(5)
  isBodyweight     Boolean       @default(false) // pull-ups, hanging knee raise
  createdAt        DateTime      @default(now())

  templateSlots    TemplateExercise[]
  sessionExercises SessionExercise[]
  substitutionsA   ExerciseAlternative[] @relation("altFor")
  substitutionsB   ExerciseAlternative[] @relation("altIs")
  personalRecords  PersonalRecord[]
  subEventsOld     SubstitutionEvent[]   @relation("subOld")
  subEventsNew     SubstitutionEvent[]   @relation("subNew")
}

// Curated "replacement exercises" list shown in the substitution picker.
model ExerciseAlternative {
  id            String   @id @default(cuid())
  exerciseId    String
  alternativeId String
  exercise      Exercise @relation("altFor", fields: [exerciseId], references: [id], onDelete: Cascade)
  alternative   Exercise @relation("altIs", fields: [alternativeId], references: [id], onDelete: Cascade)

  @@unique([exerciseId, alternativeId])
}

// ---------- Program templates ----------

model WorkoutTemplate {
  id        String   @id @default(cuid())
  name      String                     // "Push Dominant Upper"
  dayOfWeek Int                        // 1=Mon .. 7=Sun (ISO)
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  exercises TemplateExercise[]
  sessions  WorkoutSession[]

  @@unique([dayOfWeek, isActive])
}

// THE progression slot. Stable id across substitutions.
model TemplateExercise {
  id            String   @id @default(cuid())
  templateId    String
  exerciseId    String
  sortOrder     Int
  baseSets      Int                    // Block 1 sets
  repRangeMin   Int
  repRangeMax   Int
  targetRirMin  Int                    // compounds 1, isolation 0
  targetRirMax  Int                    // compounds 2, isolation 1
  priority      Priority @default(NORMAL) // program-context: same exercise can differ by day
  restSeconds   Int
  isPerSide     Boolean  @default(false) // "10 each leg"
  notes         String?

  template      WorkoutTemplate  @relation(fields: [templateId], references: [id], onDelete: Cascade)
  exercise      Exercise         @relation(fields: [exerciseId], references: [id])
  blockOverrides BlockOverride[]
  sessionExercises SessionExercise[]
  substitutions SubstitutionEvent[]

  @@unique([templateId, sortOrder])
}

// "+1 set to X in Block 2/3"
model BlockOverride {
  id                 String @id @default(cuid())
  templateExerciseId String
  blockNumber        Int              // 2 or 3 (block-cycle-relative)
  addSets            Int    @default(1)
  templateExercise   TemplateExercise @relation(fields: [templateExerciseId], references: [id], onDelete: Cascade)

  @@unique([templateExerciseId, blockNumber])
}

// Audit trail of substitutions on a slot (history itself lives on the slot id).
model SubstitutionEvent {
  id                 String   @id @default(cuid())
  templateExerciseId String
  oldExerciseId      String
  newExerciseId      String
  reason             String?
  date               String                 // YYYY-MM-DD local
  templateExercise   TemplateExercise @relation(fields: [templateExerciseId], references: [id], onDelete: Cascade)
  oldExercise        Exercise @relation("subOld", fields: [oldExerciseId], references: [id])
  newExercise        Exercise @relation("subNew", fields: [newExerciseId], references: [id])
}

// ---------- Blocks & weeks ----------

// A 13-week cycle: weeks 1-4 (block phase 1), 5-8 (2), 9-12 (3), 13 deload.
model TrainingBlock {
  id          String   @id @default(cuid())
  cycleNumber Int      @unique          // 1st 13-week cycle, 2nd, ...
  startDate   String                    // YYYY-MM-DD, always a Monday
  notes       String?
  sessions    WorkoutSession[]
}
// week number & phase are DERIVED from (today - startDate) in lib/schedule.ts,
// never stored — eliminates drift.

// ---------- Sessions & logging ----------

model WorkoutSession {
  id           String        @id @default(cuid())
  templateId   String
  blockId      String
  date         String                    // YYYY-MM-DD local
  weekInCycle  Int                       // 1..13, snapshot at generation
  blockPhase   Int                       // 1,2,3; 0 = deload week
  isDeload     Boolean       @default(false)
  status       SessionStatus @default(PLANNED)
  startedAt    DateTime?
  completedAt  DateTime?
  notes        String?
  totalVolume  Float         @default(0) // lb, denormalized on completion
  template     WorkoutTemplate  @relation(fields: [templateId], references: [id])
  block        TrainingBlock    @relation(fields: [blockId], references: [id])
  exercises    SessionExercise[]

  @@unique([templateId, date])
  @@index([date])
}

model SessionExercise {
  id                 String  @id @default(cuid())
  sessionId          String
  templateExerciseId String            // progression lineage key
  exerciseId         String            // resolved exercise at session time
  sortOrder          Int
  // --- snapshot of resolved targets (block + deload applied) ---
  targetSets         Int
  targetRepMin       Int
  targetRepMax       Int
  targetRirMin       Int
  targetRirMax       Int
  restSeconds        Int
  targetWeight       Float?            // recommendation engine output, lb
  recommendation     String?           // "INCREASE" | "REPEAT" | "REDUCE" | null (first time)
  notes              String?

  session          WorkoutSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  templateExercise TemplateExercise @relation(fields: [templateExerciseId], references: [id])
  exercise         Exercise         @relation(fields: [exerciseId], references: [id])
  sets             SetLog[]

  @@unique([sessionId, sortOrder])
}

model SetLog {
  id                String  @id @default(cuid())
  sessionExerciseId String
  setNumber         Int
  weight            Float             // lb; bodyweight exercises log added weight (0 ok)
  reps              Int
  rir               Int?
  completed         Boolean @default(true)
  notes             String?
  loggedAt          DateTime @default(now())
  sessionExercise   SessionExercise @relation(fields: [sessionExerciseId], references: [id], onDelete: Cascade)

  @@unique([sessionExerciseId, setNumber])
}

// ---------- Personal records (STORED — see decision #3) ----------

model PersonalRecord {
  id                 String  @id @default(cuid())
  exerciseId         String
  templateExerciseId String?           // lineage, when achieved in a program slot
  type               PrType
  value              Float             // lb, e1rm lb, reps, or session volume lb
  weight             Float?            // context for MOST_REPS
  reps               Int?
  date               String            // YYYY-MM-DD
  setLogId           String?           // provenance
  seenByUser         Boolean @default(false) // drives "new PR" badge
  exercise           Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@index([exerciseId, type, value])
}

// ---------- Body / lifestyle tracking ----------

model BodyMeasurement {
  id        String  @id @default(cuid())
  date      String  @unique            // YYYY-MM-DD
  weight    Float?                     // lb
  bodyFat   Float?                     // %
  waist     Float?                     // inches (all girths in inches)
  chest     Float?
  shoulders Float?
  leftArm   Float?
  rightArm  Float?
  leftForearm  Float?
  rightForearm Float?
  leftThigh    Float?
  rightThigh   Float?
  leftCalf     Float?
  rightCalf    Float?
  neck      Float?
  notes     String?
}

model ProgressPhoto {
  id       String     @id @default(cuid())
  date     String                       // YYYY-MM-DD
  angle    PhotoAngle
  filePath String                       // relative to /public, e.g. "/photos/2026-07-06-front.jpg"
  weight   Float?
  bodyFat  Float?
  notes    String?

  @@unique([date, angle])
}

model NutritionLog {
  id       String @id @default(cuid())
  date     String @unique               // YYYY-MM-DD
  calories Int?
  protein  Int?                         // g
  carbs    Int?
  fat      Int?
  fiber    Int?
  waterOz  Int?
  notes    String?
}

model RecoveryLog {
  id                String @id @default(cuid())
  date              String @unique      // YYYY-MM-DD
  sleepHours        Float?
  sleepQuality      Int?                // 1-5
  stress            Int?                // 1-5 (5 = worst)
  energy            Int?                // 1-5
  motivation        Int?                // 1-5
  workoutDifficulty Int?                // 1-5 (5 = brutal), yesterday's session
  soreness          Int?                // 1-5 (5 = wrecked)
  score             Int?                // 0-100, computed & stored on save
  notes             String?
}

// ---------- Goals & notifications ----------

model Goal {
  id               String   @id @default(cuid())
  type             GoalType
  measurementField String?             // "waist", "chest", ... when type=MEASUREMENT
  label            String              // "Bench 1RM", "Waist"
  startValue       Float
  targetValue      Float
  unit             String              // "lb", "%", "in"
  targetDate       String?             // YYYY-MM-DD
  achievedAt       String?
  createdAt        DateTime @default(now())

  @@unique([type, measurementField])
}
// currentValue is DERIVED server-side (latest measurement / best e1rm), never stored.

model Notification {
  id        String           @id @default(cuid())
  type      NotificationType
  title     String
  body      String?
  href      String?                    // deep link, e.g. "/workout/today"
  // idempotency key so generators never duplicate: e.g. "PROGRESSION:tmplExId:2026-07-06"
  dedupeKey String           @unique
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())

  @@index([read, createdAt])
}

// ---------- App settings (single row, id="singleton") ----------

model AppSettings {
  id                    String @id @default("singleton")
  proteinTargetG        Int    @default(180)
  calorieTarget         Int    @default(2800)
  deloadWeightPct       Float  @default(0.825)   // 80-85% -> midpoint
  photoReminderDay      Int    @default(1)        // day of month
  measurementReminderDay Int   @default(1)
}
```

---

## 3. Seed Plan (`prisma/seed.ts`)

Idempotent (`upsert` by natural keys). Run via `prisma db seed`. Steps:

1. **AppSettings** singleton with defaults.
2. **Exercises** — all 26 distinct exercises from Program v1.0 with `primaryMuscle`, `secondaryMuscles`, `equipment`, `type`, `weightIncrement` (5 default; 2.5 for Cable Lateral Raise, Rear Delt Fly, Face Pull, curls/extensions with small increments; `isBodyweight` for Pull-ups and Hanging Knee Raise). Also seed the named alternates — Neutral Grip Pulldown (alt for Pull-ups) and Pendulum Squat (alt for Hack Squat) — plus `ExerciseAlternative` rows linking them.
3. **Rest times by type** (used as `restSeconds` per slot): HEAVY_COMPOUND 180, COMPOUND 150, MACHINE_COMPOUND 105, ISOLATION 75, CORE 60.
4. **RIR by type**: compounds (`HEAVY_COMPOUND`/`COMPOUND`/`MACHINE_COMPOUND`) `targetRirMin=1, max=2`; `ISOLATION`/`CORE` `min=0, max=1`.
5. **4 WorkoutTemplates** with `TemplateExercise` slots exactly per PROGRAM.md tables:
   - Mon "Push Dominant Upper" (dayOfWeek 1): Bench 3×6–8 HIGH; Incline DB Press 3×8–10 HIGH; Chest Supported Row 4×8–10 HIGH; Neutral Grip Lat Pulldown 3×10–12 HIGH; Seated DB Shoulder Press 3×8–10 MEDIUM; Cable Lateral Raise 4×12–15 HIGHEST; Rope Pushdown 3×10–12; Incline DB Curl 3×10–12.
   - Tue "Quad Dominant Lower" (2): Box Squat 3×6–8 HIGH; Leg Press 3×10–12; Bulgarian Split Squat 3×10 (`isPerSide`, repRange 10–10); Leg Extension 3×12–15; Standing Calf Raise 4×12–15; Cable Crunch 3×12–15.
   - Thu "Pull Dominant Upper" (4): Pull-ups 4×8–10 HIGH; Chest Supported Row (grip note) 3×10–12; Machine Chest Press 3×10–12; Rear Delt Fly 4×12–15; Cable Lateral Raise 4×12–15 HIGHEST; Face Pull 3×12–15; Preacher Curl 3×10–12; Overhead Rope Extension 3×10–12.
   - Fri "Posterior Chain Lower" (5): RDL 3×8–10 HIGH; Hack Squat 3×10–12; Lying Hamstring Curl 4×10–12; Walking Lunges 2×12 (`isPerSide`); Seated Calf Raise 4×12–15; Hanging Knee Raise 3×10–15.
   - Priority is set on `TemplateExercise.priority` (program-context, not the exercise): same exercise can be HIGH on Monday and NORMAL on Thursday (Chest Supported Row).
6. **BlockOverrides**:
   - Block 2 (+1 set): Mon Bench Press, Mon Incline DB Press, Mon Chest Supported Row, Tue Box Squat, Tue Leg Press, Thu Pull-ups, Fri RDL.
   - Block 3 (+1 set): Mon Incline DB Press, Mon Cable Lateral Raise, Mon Chest Supported Row, Mon Neutral Grip Lat Pulldown, Mon Rope Pushdown, Mon Incline DB Curl, Thu Rear Delt Fly, Thu Cable Lateral Raise, Thu Pull-ups. (Program lists exercises; overrides attach to every matching slot the program names.)
7. **TrainingBlock** `cycleNumber: 1`, `startDate` = **Monday of the current week** (computed locally: `startOfISOWeek(today)` formatted YYYY-MM-DD).
8. No sessions are seeded — sessions are generated lazily (see §5, `schedule.ts`).

---

## 4. Route Map (`app/`)

| Route | File | Type | Purpose |
|---|---|---|---|
| `/` | `app/page.tsx` | **Server** (chart widgets are client children) | Dashboard: block/week banner, deload countdown, next workout card, stats grid, 6 charts, recent PRs, notifications bell |
| `/workout/today` | `app/workout/today/page.tsx` | **Server** | Finds/creates today's session via `schedule.ts`, redirects to `/workout/[sessionId]`; shows rest-day card if none |
| `/workout/[sessionId]` | `app/workout/[sessionId]/page.tsx` | Server shell + **client** `WorkoutLogger` | Fast set logging: per-exercise cards, prefilled weight/reps from recommendation, tap-to-complete sets, RIR stepper, live volume/e1RM, PR toasts |
| `/history` | `app/history/page.tsx` | **Server** | Paginated session list w/ volume, PRs, vs-previous deltas |
| `/history/[sessionId]` | `app/history/[sessionId]/page.tsx` | **Server** | Read-only session detail + edit affordance |
| `/exercises` | `app/exercises/page.tsx` | **Server** (client filter bar) | Library: search/filter by muscle/equipment, favorites |
| `/exercises/[id]` | `app/exercises/[id]/page.tsx` | **Server** + client chart | Detail: e1RM & top-set charts (lineage-aware), PRs, alternatives, **Substitute** action |
| `/records` | `app/records/page.tsx` | **Server** | PR board grouped by exercise, new-PR badges (`seenByUser`) |
| `/measurements` | `app/measurements/page.tsx` | Server + client charts/form | Monthly entry form + per-measurement chart |
| `/photos` | `app/photos/page.tsx` | Server + client uploader | Timeline grouped by date, front/side/back columns |
| `/nutrition` | `app/nutrition/page.tsx` | Server + client form | Daily log, weekly averages table, protein/calorie target bars |
| `/recovery` | `app/recovery/page.tsx` | Server + client form | Daily inputs, live-computed score, 30-day score chart |
| `/analytics` | `app/analytics/page.tsx` | **Server** (all charts client) | Big-4 lift progress, muscle-group volume, frequency, consistency, avg RIR, recovery-vs-performance scatter, body-weight trend |
| `/calendar` | `app/calendar/page.tsx` | Server + client month grid | Completed/missed/rest/deload day coloring, reminder dots |
| `/goals` | `app/goals/page.tsx` | Server + client form | Progress bars: current (derived) vs target |
| `/api/photos/upload` | `route.ts` | Route handler | Multipart image upload → `public/photos/`, creates `ProgressPhoto` |

Layout: `app/layout.tsx` (server) — sidebar nav + `<NotificationsBell/>` (client) fed by server data. Everything defaults to server components; client components exist only for: forms, the workout logger, Recharts wrappers, calendar grid, photo uploader, notification bell.

---

## 5. Core Domain Logic (`lib/`)

All pure functions; unit-testable; no Prisma imports except in `lib/queries/*` and `lib/actions/*`.

### `lib/e1rm.ts`
`epley(weight, reps): number` → `reps === 1 ? weight : weight * (1 + reps / 30)`. Round display to 1 lb. Bodyweight exercises: skip e1RM unless a bodyweight value exists in the latest `BodyMeasurement` (then `weight = bw + added`).

### `lib/volume.ts`
- `setVolume = weight * reps` (bodyweight sets with weight 0 contribute 0 to load volume but count toward set counts).
- `sessionVolume = Σ completed sets`.
- `weeklySetsByMuscle(sessions)`: each completed set credits 1.0 to `primaryMuscle`, 0.5 to each secondary — matches the program's "direct + stimulus" framing.

### `lib/progression.ts` — Double Progression (exact algorithm)
Input: the most recent **non-deload COMPLETED** session's sets for a `templateExerciseId` (lineage — so substitutions and block set-count changes don't reset it), plus slot targets and `Exercise.weightIncrement`.

```
if no prior session            -> { rec: FIRST_TIME, weight: null }
let W = max weight used across prior working sets
let priorSets = completed sets at weight >= W (the working weight)
INCREASE if:
    every prior completed working set has reps >= repRangeMax
AND every logged RIR on those sets >= targetRirMin      // not ground out past target
AND count(priorSets) >= priorTargetSets                 // no skipped sets
    -> { rec: INCREASE, weight: W + weightIncrement, targetReps: repRangeMin }
REDUCE if:
    (latest RecoveryLog.score < 40)
 OR (last 2 sessions both failed to add a single total rep at weight W and avg RIR == 0)
    -> { rec: REDUCE, weight: round5(W * 0.9) }
else REPEAT -> { rec: REPEAT, weight: W }
Deload sessions: weight = round5(W * settings.deloadWeightPct), rec = DELOAD; deload results never feed progression.
```
Rounding: `round5` = nearest 5 lb (nearest 2.5 when `weightIncrement === 2.5`).

### `lib/recovery.ts` — Recovery Score (0–100, defined)
Weighted sum of normalized components (missing component → redistribute its weight proportionally):
```
sleepHrs   min(sleepHours/8, 1)        × 25
sleepQual  (sleepQuality-1)/4           × 15
stress     (5-stress)/4                 × 15
energy     (energy-1)/4                 × 15
motivation (motivation-1)/4             × 10
soreness   (5-soreness)/4               × 15
difficulty (5-workoutDifficulty)/4      × 5
score = round(Σ)   // stored on RecoveryLog.score at save time
```
Bands: 70+ green "recovered", 40–69 amber "manage load", <40 red → emit `FATIGUE_WARNING` notification and flip progression to REDUCE.

### `lib/pr.ts`
`detectPRs(setLog, exercise, history)` runs inside the `logSet` server action, comparing against stored `PersonalRecord` rows (lineage-scoped via `templateExerciseId` when present, else `exerciseId`): HEAVIEST_WEIGHT (weight > best); BEST_E1RM (epley > best); MOST_REPS (reps > best reps achieved at ≥ that PR's weight); MOST_SESSION_VOLUME (checked on session completion). Deload sessions are excluded. Creates `PersonalRecord` + `PR_ACHIEVED` notification. `recomputePRs()` repair action re-derives all rows after log edits.

### `lib/schedule.ts` — blocks, weeks, deload, session generation
- `weekInCycle(block, date) = floor(days(date - block.startDate)/7) + 1` (1..13).
- `blockPhase(week)`: 1–4→1, 5–8→2, 9–12→3, 13→0 (deload). `isDeload = week === 13`.
- After week 13 ends, `ensureCurrentBlock()` auto-creates the next `TrainingBlock` (cycleNumber+1, startDate = next Monday).
- `resolveTargets(slot, phase, isDeload)`: `sets = slot.baseSets + Σ overrides where blockNumber === phase`; deload: `sets = ceil(sets/2)`, weight handled by progression engine.
- `getOrCreateSession(date)`: finds active template for `isoDayOfWeek(date)`; upserts `WorkoutSession` + snapshot `SessionExercise` rows with resolved targets + progression recommendations.
- `deloadCountdownDays(block, today)` for the dashboard.

### `lib/notifications.ts` — generation rules (idempotent via `dedupeKey`)
Run by `generateNotifications()` called from the dashboard/layout server render (cheap, no cron needed for a local app):
1. `PROGRESSION` — for each slot whose next recommendation is INCREASE, key `PROGRESSION:{slotId}:{nextSessionDate}`.
2. `DELOAD_UPCOMING` — week 12; `DELOAD_ACTIVE` — week 13. Keyed by block+week.
3. `PHOTO_REMINDER` / `MEASUREMENT_REMINDER` — monthly on `AppSettings` day if no entry exists this month; key `{TYPE}:{yyyy-MM}`.
4. `NUTRITION_REMINDER` — after 8 PM local if today's `NutritionLog.protein` is null; key `NUTRITION:{date}`.
5. `PR_ACHIEVED` / `FATIGUE_WARNING` — emitted inline by `pr.ts` / recovery save.

### `lib/streaks.ts` — consistency
- `weekComplete(week)` = all 4 scheduled sessions COMPLETED (deload weeks count with their halved prescriptions).
- `consecutiveWeeks` = streak of complete weeks ending at the last fully elapsed week.
- `consistencyPct(rangeWeeks)` = completed sessions / scheduled sessions ×100 (drives the >90% success metric chart).

### `lib/actions/` (server actions — the write layer)
`workout.ts` (start/complete session, logSet, updateSet, skipSession), `exercises.ts` (CRUD, `substituteExercise(slotId, newExerciseId, reason)`), `measurements.ts`, `photos.ts`, `nutrition.ts`, `recovery.ts`, `goals.ts`, `notifications.ts` (markRead), `settings.ts`. All call `revalidatePath`.

### `lib/queries/` (read layer, server-only)
`dashboard.ts`, `analytics.ts`, `history.ts`, `calendar.ts` — every derived stat (weekly averages, chart series, current-vs-goal values) computes here on the **server**; clients receive plain serialized props.

---

## 6. Directory Structure

```
tracker/
├── docs/                      # PRD.md, PROGRAM.md, ARCHITECTURE.md
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── dev.db
├── public/
│   └── photos/                # uploaded progress photos (gitignored), named {date}-{angle}-{cuid}.jpg
├── app/
│   ├── layout.tsx             # sidebar shell + notifications bell
│   ├── globals.css            # Tailwind v4 @theme tokens
│   ├── page.tsx               # dashboard
│   ├── workout/
│   │   ├── today/page.tsx
│   │   └── [sessionId]/page.tsx
│   ├── history/
│   │   ├── page.tsx
│   │   └── [sessionId]/page.tsx
│   ├── exercises/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── records/page.tsx
│   ├── measurements/page.tsx
│   ├── photos/page.tsx
│   ├── nutrition/page.tsx
│   ├── recovery/page.tsx
│   ├── analytics/page.tsx
│   ├── calendar/page.tsx
│   ├── goals/page.tsx
│   └── api/photos/upload/route.ts
├── components/
│   ├── ui/                    # Card, Stat, Badge, Button, Input, Stepper, ProgressBar, EmptyState
│   ├── charts/                # "use client" Recharts wrappers: LineChart, BarChart, AreaChart, ScatterChart, Sparkline
│   ├── dashboard/             # StatGrid, NextWorkoutCard, BlockBanner, DeloadCountdown
│   ├── workout/               # WorkoutLogger, ExerciseCard, SetRow, RirStepper, PrToast, RecommendationChip
│   ├── calendar/MonthGrid.tsx
│   ├── photos/PhotoUploader.tsx, PhotoTimeline.tsx
│   ├── notifications/NotificationsBell.tsx
│   └── layout/Sidebar.tsx
├── lib/
│   ├── db.ts                  # Prisma singleton
│   ├── dates.ts               # localToday(), isoWeekMonday(), fmt — see §7
│   ├── e1rm.ts  volume.ts  progression.ts  recovery.ts  pr.ts
│   ├── schedule.ts  notifications.ts  streaks.ts
│   ├── actions/               # server actions (write)
│   └── queries/               # server-only reads / derived stats
└── package.json
```

---

## 7. Shared Conventions

- **Units**: pounds (lb) for all loads and body weight; inches for girths; % body fat; grams for macros; oz for water. No unit toggling in v1. Displayed as `185 lb`, computed as Float.
- **Dates**: calendar dates (workout day, measurement day, nutrition day) are stored as **`String` `"YYYY-MM-DD"` in local time** — never `DateTime` — so a Monday workout is Monday regardless of TZ/DST. `lib/dates.ts` is the only module that touches `Date`: `localToday()`, `isoDayOfWeek()`, `isoWeekMonday()`, `addDays()`, `diffDays()`. `DateTime` fields (`createdAt`, `startedAt`, `loggedAt`) are true instants and stay UTC. String dates sort lexicographically — safe for `orderBy`/range queries. Week starts **Monday (ISO)** everywhere.
- **Derived stats compute on the server**, in `lib/queries/*`, during RSC render. Client components only render pre-shaped props. Only three denormalized/stored derivations exist, each justified: `WorkoutSession.totalVolume` (set on completion), `RecoveryLog.score` (set on save), `PersonalRecord` rows (event log). Everything else (week number, block phase, goal progress, streaks, chart series) is computed fresh per request — SQLite locally is fast enough.
- **Naming**: DB models singular PascalCase; enums SCREAMING_SNAKE values; files kebab-free lowercase (`progression.ts`); components PascalCase; server actions verb-first (`logSet`, `completeSession`, `substituteExercise`); queries `get*` (`getDashboardData`). Route segments kebab-case.
- **Progression lineage rule** (repeat because it's load-bearing): any code reading exercise history for progression/charts/PRs keys on `templateExerciseId`, falling back to `exerciseId` only for ad-hoc/non-program contexts.
- **Errors/validation**: server actions validate with zod schemas colocated in `lib/actions/*`; throw typed errors; forms use `useActionState`.
```

---

## 8. Foundation notes for feature teams (added by foundation build)

### Deviations from the spec above (all forced by installed versions)

- **Next.js 16.2.10** (spec says 15) — no code impact for the foundation; build uses Turbopack.
- **Prisma 7.8.0** (spec's schema assumed ≤6):
  - Generator is `provider = "prisma-client"` with `output = "../lib/generated/prisma"` (`prisma-client-js` is gone). Import types/enums from `@/lib/generated/prisma/client` and `@/lib/generated/prisma/enums` — **not** `@prisma/client`.
  - `datasource.url` is no longer allowed in `schema.prisma`; it lives in `prisma.config.ts` (used by CLI only). Seed command is also configured there (`migrations.seed`), not in `package.json#prisma`.
  - The runtime client requires a **driver adapter**: `@prisma/adapter-better-sqlite3` + `better-sqlite3` were added as dependencies. `lib/db.ts` wires it up; always use the `prisma` singleton from there.
- **lucide-react ≥1.x renamed `LineChart` → `ChartLine`** (Analytics icon). All other DESIGN.md icon names are valid.
- **Font CSS variables** are `--font-inter`, `--font-space-grotesk`, `--font-jetbrains-mono` (not `--font-sans` etc. as in DESIGN.md's sample) to avoid a circular `var()` reference in the `@theme` block. `font-sans` / `font-display` / `font-mono` utilities work exactly as designed.
- The Workout nav route is `/workout` (placeholder page). `/workout/today` and `/workout/[sessionId]` from §4 are still owned by the workout team; keep `/workout` as the entry that redirects/embeds.

### npm scripts

- `npm run db:push` — sync schema to `prisma/dev.db`
- `npm run db:seed` — idempotent Program v1.0 seed (also wired to `prisma db seed`)
- `postinstall` runs `prisma generate` (client output is `lib/generated/prisma/`, regenerate after schema edits)

### Shared import paths

**lib/ (pure domain logic — no Prisma except db.ts):**
- `@/lib/db` → `prisma` singleton (Prisma 7 + better-sqlite3 adapter)
- `@/lib/dates` → `localToday()`, `fmtLocalDate()`, `parseLocalDate()`, `isoDayOfWeek()`, `isoWeekMonday()`, `addDays()`, `diffDays()`, `monthKey()`, `fmtDisplay()`, type `LocalDate`
- `@/lib/e1rm` → `epley()`, `epleyDisplay()`, `epleyBodyweight()`
- `@/lib/volume` → `setVolume()`, `sessionVolume()`, `weeklySetsByMuscle()`, `parseSecondaryMuscles()`, `WEEKLY_SET_TARGETS`
- `@/lib/progression` → `recommendProgression()`, `deloadWeight()`, `roundIncrement()`, types `ProgressionInput/Result`, `Recommendation`
- `@/lib/recovery` → `recoveryScore()`, `recoveryBand()`, `isFatigued()`
- `@/lib/pr` → `detectSetPRs()`, `detectSessionVolumePR()`, `PR_TYPE_LABELS`, types `CurrentBests`, `DetectedPr`
- `@/lib/schedule` → `weekInCycle()`, `blockPhase()`, `isDeloadWeek()`, `isCycleComplete()`, `resolveTargets()`, `deloadCountdownDays()`, `blockPosition()` (pure only — `getOrCreateSession`/`ensureCurrentBlock` server actions are the workout team's, built on these)
- `@/lib/notifications` → pure candidate builders (`progressionNotification()`, `scheduleNotifications()`, …); persist with `notification.upsert({ where: { dedupeKey } })`
- `@/lib/streaks` → `weekComplete()`, `consecutiveWeeks()`, `consistencyPct()`, `SESSIONS_PER_WEEK`

**components/ui/ (server-safe unless noted):**
- `@/components/ui/PageHeader` (default) — title/subtitle/actions block; start every page with it
- `@/components/ui/Card` — `Card`, `SectionCard` (`flush` for p-0 bodies), `CardAction`
- `@/components/ui/StatCard` (default) — hero stat w/ trend row
- `@/components/ui/ChartCard` (default) — chart card shell (legend, height h-64/h-80/h-40)
- `@/components/ui/RangeToggle` (default, **client**) — 4W/12W/6M/All toggle
- `@/components/ui/Badge` — `Badge` (variants neutral/success/warning/danger/info/accent), `PRBadge`, `PriorityBadge`, `DeloadBadge`
- `@/components/ui/ProgressBar` (default) — `pct`, `thick`, `behindPace`
- `@/components/ui/Button` — default `Button` (primary/ghost/danger/subtle × sm/md/lg), `ButtonLink`, `IconButton`, `buttonClasses()`
- `@/components/ui/Input` — `Input` (`numeric` prop), `Select`, `Textarea`, `Label`, `FieldError`
- `@/components/ui/EmptyState` (default) — dashed empty state; `chart` prop for in-chart variant

**components/charts/ & layout:**
- `@/components/charts/ChartTheme` (**client**) — `CHART_COLORS`, `CHART_MARGIN`, `GRID_PROPS`, `AXIS_PROPS`, `Y_AXIS_PROPS`, `lineProps()`, `barProps()`, `BAR_CATEGORY_GAP`, `TOOLTIP_CURSOR`, `PR_DOT_PROPS`, `TARGET_LINE_PROPS`, `ChartTooltip`. Use these in every Recharts wrapper.
- `@/components/layout/nav-items` — `NAV_ITEMS` (all 12 routes + icons), `MOBILE_NAV_HREFS`
- `@/components/layout/Sidebar`, `@/components/layout/MobileNav` (**client**) — already mounted in `app/layout.tsx`. The sidebar footer's Block/Week chip is a static placeholder ("Block 1 · Week 1"); the dashboard team should feed it real `blockPosition()` data.

Animations `animate-pr-pop` and `animate-toast-in` are defined in `app/globals.css` (with `prefers-reduced-motion` fallbacks), alongside the full DESIGN.md `@theme` token block.
