# Hypertrophy Training Tracker — PRD (v1, scoped)

## Vision
A modern, local-first, single-user web app that is a personal training dashboard for tracking workouts, driving progressive overload, and visualizing long-term hypertrophy progress. It must look beautiful — a premium training dashboard, not a plain log.

## Explicitly OUT of scope (per owner)
- No authentication (single local user)
- No automatic backups, no exports (CSV/Excel/JSON/PDF)
- No nice-to-haves (plate calculator, warm-up generator, rest timer, QR codes, Apple Health, smartwatch, keyboard shortcuts, workout timer)
- General AI Coach remains future-only. The narrowly scoped, on-demand AI Set Coach is specified in `docs/AI_SET_COACH.md`; implementation requires explicit approval.

## Tech requirements
- Next.js (App Router) + React + TypeScript
- SQLite via Prisma
- Desktop-first responsive; mobile-friendly for gym logging
- Runs locally (npm run dev / docker later — docker not required now)

## Core modules

### Dashboard (at a glance)
Current training block & week, next workout, current body weight, weekly avg weight, estimated body fat, current calories & protein target, total workouts completed, consecutive weeks completed, total volume this week, recovery score, last workout summary, PR count, deload countdown.
Charts: body weight, estimated 1RM, weekly volume, muscle-group volume, workout frequency, training consistency.

### Workout module
Workouts contain exercises with: name, target sets, target rep range, target RIR, rest time, notes, muscle group, priority level.
Per set logged: weight, reps, RIR, completed, notes.
Auto-calculated: total volume, average reps, estimated 1RM (Epley), PR detection, progress vs previous session.
Logging a workout must be FAST (<1 min).

### Progressive Overload Engine
Per exercise: current working weight, rep range, progression rule.
Double progression: if all prescribed sets hit the top of the rep range within target RIR → recommend weight increase next session (e.g. +5 lb); otherwise repeat weight. Also surface: deload / reduce weight on excessive fatigue.

### Training Blocks
12-week blocks + week 13 deload, repeating indefinitely. Block structure per docs/PROGRAM.md (Block 1 base, Block 2 adds sets to key compounds, Block 3 upper-body specialization adds sets, Week 13 deload = ~80–85% weight, half the sets).

### Exercise Library
Name, primary muscle, secondary muscles, equipment, difficulty, video link, notes, replacement exercises, favorite, injury-friendly. Substituting an exercise keeps progression history.

### Personal Records
Heaviest weight, highest estimated 1RM, most reps, most volume. New-PR badges.

### Body Measurements (monthly)
Weight, body fat %, waist, chest, shoulders, arms, forearms, thighs, calves, neck. Chart per measurement.

### Progress Photos
Front/side/back, date, weight, body fat, notes. Timeline view.

### Nutrition (daily)
Calories, protein, carbs, fat, fiber, water. Weekly averages.

### Recovery (daily)
Sleep hours, sleep quality, stress, energy, motivation, workout difficulty, soreness → computed Recovery Score.

### Analytics
Bench/squat/RDL/shoulder-press progress, volume by muscle group, frequency, consistency, average RIR, recovery vs performance, body-weight trend.

### Calendar
Monthly view: completed workouts, missed workouts, rest days, deload weeks, measurement/photo reminders.

### Goals
Current vs goal: weight, body fat, bench, squat, deadlift, shoulder press, target measurements. Progress bars.

### Notifications (in-app only)
E.g. "Increase Bench Press next workout", "Deload starts next week", "Take progress photos", "Protein not logged today".

## Success criteria
Single source of truth for training data; logging a workout takes < 1 minute; historical data drives programming decisions.
