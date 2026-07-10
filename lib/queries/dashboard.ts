/**
 * lib/queries/dashboard.ts — read layer for the dashboard (ARCHITECTURE.md §5).
 * Every derived stat computes here on the server; the page and its client
 * chart children receive plain serialized props.
 *
 * Also runs the idempotent notification generators (rules 1–4 of
 * lib/notifications.ts) on load, per ARCHITECTURE.md — upserts keyed by
 * dedupeKey, so repeated renders never duplicate.
 */
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import {
  localToday,
  addDays,
  isoWeekMonday,
  isoDayOfWeek,
  monthKey,
  fmtDisplay,
  type LocalDate,
} from "@/lib/dates";
import { blockPosition, nextTemplateIndex } from "@/lib/schedule";
import { epleyDisplay } from "@/lib/e1rm";
import {
  weeklySetsByMuscle,
  parseSecondaryMuscles,
  WEEKLY_SET_TARGETS,
  type MuscleCreditedSet,
} from "@/lib/volume";
import { getLatestEffectiveRecovery } from "@/lib/queries/effective-recovery";
import { recommendProgression, type PriorSet } from "@/lib/progression";
import { consecutiveWeeks, SESSIONS_PER_WEEK, type WeekSessions } from "@/lib/streaks";
import {
  scheduleNotifications,
  progressionNotification,
  type NotificationCandidate,
} from "@/lib/notifications";
import type { MuscleGroup, NotificationType } from "@/lib/generated/prisma/enums";

// ---------- Shapes handed to the page / client charts ----------

export interface TrendInfo {
  direction: "up" | "down" | "neutral";
  label: string;
  good?: boolean;
}

export interface DashboardStats {
  bodyWeight: { value: string; trend: TrendInfo | null } | null;
  weeklyAvgWeight: string | null;
  bodyFat: string | null;
  caloriesToday: number | null;
  proteinToday: number | null;
  proteinTargetG: number;
  calorieTarget: number;
  totalWorkouts: number;
  streakWeeks: number;
  volumeThisWeek: { value: number; trend: TrendInfo | null };
  recoveryScore: number | null;
  /** Where the effective recovery score came from, for the tile badge. */
  recoverySource: "whoop" | "manual" | null;
  prCountBlock: number;
  deloadInDays: number;
  isDeload: boolean;
}

export interface ProgressionBadge {
  exerciseName: string;
  deltaLb: number;
}

export interface NextWorkoutInfo {
  templateName: string;
  date: LocalDate;
  dateLabel: string; // "Mon, Jul 6" / "Today"
  exerciseCount: number;
  estMinutes: number;
  isDeload: boolean;
  progressionBadges: ProgressionBadge[];
}

export interface LastWorkoutExerciseRow {
  name: string;
  topSet: string; // "185 × 8"
  sets: number;
  volume: number;
}

export interface LastWorkoutInfo {
  templateName: string;
  date: LocalDate;
  dateLabel: string;
  totalVolume: number;
  isDeload: boolean;
  prLabels: string[]; // e.g. ["WEIGHT", "e1RM"]
  exercises: LastWorkoutExerciseRow[];
}

export interface BodyWeightPoint {
  label: string;
  weight: number;
}

export interface E1rmPoint {
  label: string;
  bench?: number;
  squat?: number;
  rdl?: number;
  ohp?: number;
}

export interface WeeklyVolumePoint {
  label: string;
  volume: number;
}

export interface MuscleVolumePoint {
  label: string;
  actual: number;
  target: number;
}

export interface FrequencyPoint {
  label: string;
  sessions: number;
}

export interface ConsistencyPoint {
  label: string;
  pct: number;
}

export interface DashboardNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  timeLabel: string;
}

export interface DashboardData {
  position: { cycleNumber: number; week: number; phase: number; isDeload: boolean; deloadInDays: number } | null;
  nextWorkout: NextWorkoutInfo | null;
  stats: DashboardStats;
  lastWorkout: LastWorkoutInfo | null;
  charts: {
    bodyWeight: BodyWeightPoint[];
    e1rm: E1rmPoint[];
    weeklyVolume: WeeklyVolumePoint[];
    muscleVolume: MuscleVolumePoint[];
    frequency: FrequencyPoint[];
    consistency: ConsistencyPoint[];
  };
  notifications: DashboardNotification[];
  unreadCount: number;
}

// ---------- Small helpers ----------

const BIG4 = {
  "Bench Press": "bench",
  "Box Squat": "squat",
  "Romanian Deadlift": "rdl",
  "Seated Dumbbell Shoulder Press": "ohp",
} as const;

const MUSCLE_LABELS: Partial<Record<MuscleGroup, string>> = {
  CHEST: "Chest",
  UPPER_CHEST: "U.Chest",
  BACK: "Back",
  LATS: "Lats",
  FRONT_DELTS: "F.Delt",
  LATERAL_DELTS: "S.Delt",
  REAR_DELTS: "R.Delt",
  TRICEPS: "Tri",
  BICEPS: "Bi",
  QUADS: "Quads",
  HAMSTRINGS: "Hams",
  CALVES: "Calves",
  CORE: "Core",
};

/** "07-03" → "7/3" chart tick label. */
function shortLabel(date: LocalDate): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function fmtWeight(lb: number): string {
  const rounded = Math.round(lb * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function pctTrend(current: number, previous: number | null, goodWhenUp: boolean, suffix: string): TrendInfo | null {
  if (previous == null || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) return { direction: "neutral", label: `flat ${suffix}` };
  const up = pct > 0;
  const sign = up ? "+" : "−";
  return {
    direction: up ? "up" : "down",
    label: `${sign}${Math.abs(pct).toFixed(1)}% ${suffix}`,
    good: up === goodWhenUp,
  };
}

// ---------- Main entry ----------

export async function getDashboardData(): Promise<DashboardData> {
  const userId = await requireUserId();
  const today = localToday();
  const weekStart = isoWeekMonday(today);
  const prevWeekStart = addDays(weekStart, -7);

  const [block, settings] = await Promise.all([
    prisma.trainingBlock.findFirst({ where: { userId }, orderBy: { cycleNumber: "desc" } }),
    prisma.appSettings.findUnique({ where: { userId } }),
  ]);

  const activeProgram = settings?.activeProgramId
    ? await prisma.program.findUnique({ where: { id: settings.activeProgramId } })
    : null;
  const templates = activeProgram
    ? await prisma.workoutTemplate.findMany({
        where: { isActive: true, programId: activeProgram.id },
        orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }],
        include: { exercises: { include: { exercise: true, blockOverrides: true }, orderBy: { sortOrder: "asc" } } },
      })
    : [];

  const position = block
    ? { cycleNumber: block.cycleNumber, ...blockPosition(block, today) }
    : null;

  const [
    measurements,
    nutritionToday,
    latestRecovery,
    completedSessions,
    prsThisBlock,
  ] = await Promise.all([
    prisma.bodyMeasurement.findMany({
      where: { userId, weight: { not: null }, date: { gte: addDays(today, -90) } },
      orderBy: { date: "asc" },
    }),
    prisma.nutritionLog.findFirst({ where: { userId, date: today } }),
    getLatestEffectiveRecovery(userId, today),
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { date: "asc" },
      select: { id: true, date: true, totalVolume: true, isDeload: true },
    }),
    block
      ? prisma.personalRecord.count({ where: { userId, date: { gte: block.startDate } } })
      : Promise.resolve(0),
  ]);

  // ----- Next workout + progression recommendations -----
  let nextWorkout: NextWorkoutInfo | null = null;
  const increaseSlots: Array<{ templateExerciseId: string; exerciseName: string; newWeight: number; date: LocalDate }> = [];

  if (templates.length > 0 && block) {
    // Same rotation rule as the workout page and morning brief: the next
    // template after the most recently completed session, shown for today.
    const lastCompleted = await prisma.workoutSession.findFirst({
      where: { userId, status: "COMPLETED", template: { programId: activeProgram?.id } },
      orderBy: [{ date: "desc" }, { completedAt: "desc" }],
      select: { templateId: true },
    });
    const template = templates[nextTemplateIndex(templates, lastCompleted?.templateId)];
    if (template) {
      const date = today;
      const pos = blockPosition(block, date);
      const phase = pos.phase;
      const isDeload = pos.isDeload;

      // Resolved set counts → rough duration estimate (sets × (rest + ~40s work)).
      let totalSeconds = 0;
      for (const slot of template.exercises) {
        let sets =
          slot.baseSets +
          slot.blockOverrides
            .filter((o) => o.blockNumber === phase)
            .reduce((sum, o) => sum + o.addSets, 0);
        if (isDeload) sets = Math.ceil(sets / 2);
        totalSeconds += sets * (slot.restSeconds + 40);
      }
      const estMinutes = Math.max(30, Math.round(totalSeconds / 60 / 5) * 5);

      // Progression recommendations for this template's slots (lineage-keyed).
      const slotIds = template.exercises.map((s) => s.id);
      const history = await prisma.sessionExercise.findMany({
        where: {
          templateExerciseId: { in: slotIds },
          session: { userId, status: "COMPLETED", isDeload: false },
        },
        orderBy: [{ session: { date: "desc" } }],
        include: { sets: true, session: { select: { date: true } } },
      });

      const badges: ProgressionBadge[] = [];
      if (!isDeload) {
        for (const slot of template.exercises) {
          const slotHistory = history.filter((h) => h.templateExerciseId === slot.id);
          const [prior, previous] = slotHistory;
          if (!prior) continue;
          const toPriorSets = (sets: typeof prior.sets): PriorSet[] =>
            sets.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir, completed: s.completed }));
          const result = recommendProgression({
            priorSets: toPriorSets(prior.sets),
            previousSets: previous ? toPriorSets(previous.sets) : null,
            targets: {
              repRangeMin: slot.repRangeMin,
              repRangeMax: slot.repRangeMax,
              targetRirMin: slot.targetRirMin,
              priorTargetSets: prior.targetSets,
            },
            weightIncrement: slot.exercise.weightIncrement,
          });
          if (result.rec === "INCREASE" && result.weight != null) {
            badges.push({ exerciseName: slot.exercise.name, deltaLb: slot.exercise.weightIncrement });
            increaseSlots.push({
              templateExerciseId: slot.id,
              exerciseName: slot.exercise.name,
              newWeight: result.weight,
              date,
            });
          }
        }
      }

      nextWorkout = {
        templateName: template.name,
        date,
        dateLabel: "Today",
        exerciseCount: template.exercises.length,
        estMinutes,
        isDeload,
        progressionBadges: badges.slice(0, 3),
      };
    }
  }

  // ----- Notification generation (idempotent) -----
  if (block && position && settings) {
    const [photoCount, measurementCount] = await Promise.all([
      prisma.progressPhoto.count({ where: { userId, date: { startsWith: monthKey(today) } } }),
      prisma.bodyMeasurement.count({ where: { userId, date: { startsWith: monthKey(today) } } }),
    ]);
    const candidates: NotificationCandidate[] = scheduleNotifications(userId, {
      today,
      blockId: block.id,
      weekInCycle: position.week,
      isAfter8pm: new Date().getHours() >= 20,
      proteinLoggedToday: nutritionToday?.protein != null,
      photoLoggedThisMonth: photoCount > 0,
      measurementLoggedThisMonth: measurementCount > 0,
      photoReminderDay: settings.photoReminderDay,
      measurementReminderDay: settings.measurementReminderDay,
    });
    for (const slot of increaseSlots) {
      candidates.push(
        progressionNotification(userId, {
          templateExerciseId: slot.templateExerciseId,
          exerciseName: slot.exerciseName,
          newWeight: slot.newWeight,
          nextSessionDate: slot.date,
        })
      );
    }
    for (const c of candidates) {
      const existingNotification = await prisma.notification.findUnique({
        where: { userId_dedupeKey: { userId, dedupeKey: c.dedupeKey } },
      });
      if (!existingNotification) {
        await prisma.notification.create({
          data: {
            userId,
            type: c.type,
            title: c.title,
            body: c.body ?? null,
            href: c.href ?? null,
            dedupeKey: c.dedupeKey,
          },
        });
      }
    }
  }

  // ----- Stats -----
  const weighIns = measurements.filter((m) => m.weight != null);
  const latestWeighIn = weighIns[weighIns.length - 1];
  const thisWeekWeights = weighIns.filter((m) => m.date >= weekStart).map((m) => m.weight as number);
  const prevWeekWeights = weighIns
    .filter((m) => m.date >= prevWeekStart && m.date < weekStart)
    .map((m) => m.weight as number);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const thisWeekAvg = avg(thisWeekWeights);
  const prevWeekAvg = avg(prevWeekWeights);

  const latestBodyFat = [...measurements].reverse().find((m) => m.bodyFat != null)?.bodyFat ?? null;

  const volumeThisWeek = completedSessions
    .filter((s) => s.date >= weekStart)
    .reduce((sum, s) => sum + s.totalVolume, 0);
  const volumePrevWeek = completedSessions
    .filter((s) => s.date >= prevWeekStart && s.date < weekStart)
    .reduce((sum, s) => sum + s.totalVolume, 0);

  // Streak over fully elapsed weeks since the block started.
  const weeks: WeekSessions[] = [];
  if (block) {
    for (let ws = block.startDate; addDays(ws, 6) < today && ws < weekStart; ws = addDays(ws, 7)) {
      const weekEnd = addDays(ws, 6);
      weeks.push({
        weekStart: ws,
        sessions: completedSessions
          .filter((s) => s.date >= ws && s.date <= weekEnd)
          .map(() => ({ status: "COMPLETED" as const })),
      });
    }
  }
  const streakWeeks = consecutiveWeeks(weeks);

  const stats: DashboardStats = {
    bodyWeight: latestWeighIn
      ? {
          value: fmtWeight(latestWeighIn.weight as number),
          trend:
            thisWeekAvg != null && prevWeekAvg != null
              ? pctTrend(thisWeekAvg, prevWeekAvg, true, "vs last wk")
              : null,
        }
      : null,
    weeklyAvgWeight: thisWeekAvg != null ? fmtWeight(thisWeekAvg) : null,
    bodyFat: latestBodyFat != null ? latestBodyFat.toFixed(1) : null,
    caloriesToday: nutritionToday?.calories ?? null,
    proteinToday: nutritionToday?.protein ?? null,
    proteinTargetG: settings?.proteinTargetG ?? 180,
    calorieTarget: settings?.calorieTarget ?? 2800,
    totalWorkouts: completedSessions.length,
    streakWeeks,
    volumeThisWeek: {
      value: Math.round(volumeThisWeek),
      trend: pctTrend(volumeThisWeek, volumePrevWeek > 0 ? volumePrevWeek : null, true, "vs last wk"),
    },
    recoveryScore: latestRecovery.score,
    recoverySource: latestRecovery.source,
    prCountBlock: prsThisBlock,
    deloadInDays: position?.deloadInDays ?? 0,
    isDeload: position?.isDeload ?? false,
  };

  // ----- Last workout summary -----
  let lastWorkout: LastWorkoutInfo | null = null;
  const lastSession = await prisma.workoutSession.findFirst({
    where: { userId, status: "COMPLETED" },
    orderBy: { date: "desc" },
    include: {
      template: { select: { name: true } },
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: { select: { name: true } }, sets: true },
      },
    },
  });
  if (lastSession) {
    const sessionPrs = await prisma.personalRecord.findMany({
      where: { userId, date: lastSession.date },
      select: { type: true },
    });
    const PR_SHORT: Record<string, string> = {
      HEAVIEST_WEIGHT: "WEIGHT",
      BEST_E1RM: "e1RM",
      MOST_REPS: "REPS",
      MOST_SESSION_VOLUME: "VOLUME",
    };
    lastWorkout = {
      templateName: lastSession.template.name,
      date: lastSession.date,
      dateLabel: fmtDisplay(lastSession.date),
      totalVolume: Math.round(lastSession.totalVolume),
      isDeload: lastSession.isDeload,
      prLabels: [...new Set(sessionPrs.map((p) => PR_SHORT[p.type] ?? p.type))],
      exercises: lastSession.exercises.map((ex) => {
        const done = ex.sets.filter((s) => s.completed);
        const top = done.reduce<(typeof done)[number] | null>(
          (best, s) => (best == null || s.weight > best.weight ? s : best),
          null
        );
        return {
          name: ex.exercise.name,
          topSet: top ? `${fmtWeight(top.weight)} × ${top.reps}` : "—",
          sets: done.length,
          volume: Math.round(done.reduce((sum, s) => sum + s.weight * s.reps, 0)),
        };
      }),
    };
  }

  // ----- Charts -----

  // Body weight trend (last ~13 weeks).
  const bodyWeight: BodyWeightPoint[] = weighIns.map((m) => ({
    label: shortLabel(m.date),
    weight: Math.round((m.weight as number) * 10) / 10,
  }));

  // Big-4 e1RM: best Epley per exercise per session date.
  const big4Sets = await prisma.setLog.findMany({
    where: {
      completed: true,
      weight: { gt: 0 },
      sessionExercise: {
        session: { userId, status: "COMPLETED" },
        exercise: { name: { in: Object.keys(BIG4) } },
      },
    },
    include: {
      sessionExercise: {
        select: { exercise: { select: { name: true } }, session: { select: { date: true } } },
      },
    },
  });
  const e1rmByDate = new Map<LocalDate, E1rmPoint & { date: LocalDate }>();
  for (const set of big4Sets) {
    const date = set.sessionExercise.session.date;
    const key = BIG4[set.sessionExercise.exercise.name as keyof typeof BIG4];
    if (!key) continue;
    const value = epleyDisplay(set.weight, set.reps);
    let point = e1rmByDate.get(date);
    if (!point) {
      point = { date, label: shortLabel(date) };
      e1rmByDate.set(date, point);
    }
    if (point[key] == null || value > (point[key] as number)) point[key] = value;
  }
  const e1rm = [...e1rmByDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(({ date: _date, ...rest }) => rest);

  // Weekly volume + frequency + consistency, one row per week since block start.
  const weeklyVolume: WeeklyVolumePoint[] = [];
  const frequency: FrequencyPoint[] = [];
  const consistency: ConsistencyPoint[] = [];
  if (block) {
    for (let ws = block.startDate; ws <= weekStart; ws = addDays(ws, 7)) {
      const weekEnd = addDays(ws, 6);
      const inWeek = completedSessions.filter((s) => s.date >= ws && s.date <= weekEnd);
      const label = shortLabel(ws);
      weeklyVolume.push({
        label,
        volume: Math.round(inWeek.reduce((sum, s) => sum + s.totalVolume, 0)),
      });
      frequency.push({ label, sessions: inWeek.length });
      consistency.push({
        label,
        pct: Math.round(Math.min((inWeek.length / SESSIONS_PER_WEEK) * 100, 100)),
      });
    }
  }
  const hasAnyVolume = weeklyVolume.some((w) => w.volume > 0);
  const hasAnySessions = frequency.some((w) => w.sessions > 0);

  // Muscle-group sets this week vs targets.
  const weekSetLogs = await prisma.setLog.findMany({
    where: {
      completed: true,
      sessionExercise: { session: { userId, status: "COMPLETED", date: { gte: weekStart, lte: today } } },
    },
    include: {
      sessionExercise: {
        select: {
          exercise: { select: { primaryMuscle: true, secondaryMuscles: true } },
        },
      },
    },
  });
  const credited: MuscleCreditedSet[] = weekSetLogs.map((s) => ({
    completed: true,
    primaryMuscle: s.sessionExercise.exercise.primaryMuscle,
    secondaryMuscles: parseSecondaryMuscles(s.sessionExercise.exercise.secondaryMuscles),
  }));
  const actualByMuscle = weeklySetsByMuscle(credited);
  const muscleVolume: MuscleVolumePoint[] = (
    Object.keys(WEEKLY_SET_TARGETS) as MuscleGroup[]
  ).map((muscle) => ({
    label: MUSCLE_LABELS[muscle] ?? muscle,
    actual: Math.round((actualByMuscle[muscle] ?? 0) * 10) / 10,
    target: WEEKLY_SET_TARGETS[muscle] ?? 0,
  }));
  const hasMuscleVolume = muscleVolume.some((m) => m.actual > 0);

  // ----- Notifications (top 5, unread first) -----
  const [notificationRows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: [{ read: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  const notifications: DashboardNotification[] = notificationRows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.read,
    timeLabel: n.createdAt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  }));

  return {
    position,
    nextWorkout,
    stats,
    lastWorkout,
    charts: {
      bodyWeight,
      e1rm,
      weeklyVolume: hasAnyVolume ? weeklyVolume : [],
      muscleVolume: hasMuscleVolume ? muscleVolume : [],
      frequency: hasAnySessions ? frequency : [],
      consistency: hasAnySessions ? consistency : [],
    },
    notifications,
    unreadCount,
  };
}
