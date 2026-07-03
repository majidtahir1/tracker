/**
 * lib/queries/workout.ts — server-only read layer for the Workout module
 * (overview, logging screen, history, session summaries). All derived stats
 * compute here; clients receive plain serialized props.
 */
import { prisma } from "@/lib/db";
import {
  addDays,
  fmtDisplay,
  isoDayOfWeek,
  isoWeekMonday,
  localToday,
  type LocalDate,
} from "@/lib/dates";
import {
  blockPhase,
  isDeloadWeek,
  resolveTargets,
  weekInCycle,
  type ResolvedTargets,
} from "@/lib/schedule";
import {
  deloadWeight,
  recommendProgression,
  type PriorSet,
  type ProgressionResult,
} from "@/lib/progression";
import { getLatestEffectiveRecovery } from "@/lib/queries/effective-recovery";
import { epleyDisplay } from "@/lib/e1rm";
import { PR_TYPE_LABELS } from "@/lib/pr";
import type {
  LoggerExercise,
  LoggerSession,
  PrevSet,
  RecommendationKind,
} from "@/components/workout/types";

// ---------------------------------------------------------------------------
// Shared helpers (also used by lib/actions/workout.ts at session-creation time)
// ---------------------------------------------------------------------------

export async function getLatestBlock() {
  return prisma.trainingBlock.findFirst({ orderBy: { cycleNumber: "desc" } });
}

export async function getDeloadPct(): Promise<number> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return settings?.deloadWeightPct ?? 0.825;
}

export async function getLatestRecoveryScore(): Promise<number | null> {
  // Effective score: WHOOP when synced for the day, else the manual log.
  const latest = await getLatestEffectiveRecovery(localToday());
  return latest.score;
}

interface SlotWithExercise {
  id: string;
  baseSets: number;
  repRangeMin: number;
  repRangeMax: number;
  targetRirMin: number;
  targetRirMax: number;
  restSeconds: number;
  blockOverrides: { blockNumber: number; addSets: number }[];
  exercise: { weightIncrement: number };
}

export interface SlotPlan {
  targets: ResolvedTargets;
  result: ProgressionResult;
  /** Completed sets from the most recent prior non-deload completed session. */
  prevSets: PrevSet[];
  prevWorkingWeight: number | null;
}

/**
 * Resolve block/deload targets and the progression recommendation for one
 * template slot. `beforeDate` bounds the history search (exclusive) so a
 * session's own logs never feed its recommendation.
 */
export async function planSlot(
  slot: SlotWithExercise,
  phase: number,
  isDeload: boolean,
  ctx: { deloadPct: number; latestRecoveryScore: number | null; beforeDate?: LocalDate }
): Promise<SlotPlan> {
  const targets = resolveTargets(slot, slot.blockOverrides, phase, isDeload);

  const prior = await prisma.sessionExercise.findMany({
    where: {
      templateExerciseId: slot.id,
      session: {
        status: "COMPLETED",
        isDeload: false,
        ...(ctx.beforeDate ? { date: { lt: ctx.beforeDate } } : {}),
      },
    },
    orderBy: { session: { date: "desc" } },
    take: 2,
    include: { sets: true },
  });

  const toPrior = (se: (typeof prior)[number]): PriorSet[] =>
    se.sets
      .slice()
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir, completed: s.completed }));

  const priorSets = prior[0] ? toPrior(prior[0]) : null;
  const completedPrior = priorSets?.filter((s) => s.completed) ?? [];
  const prevWorkingWeight =
    completedPrior.length > 0 ? Math.max(...completedPrior.map((s) => s.weight)) : null;

  let result: ProgressionResult;
  if (isDeload) {
    result =
      prevWorkingWeight != null && prevWorkingWeight > 0
        ? deloadWeight(prevWorkingWeight, ctx.deloadPct, slot.exercise.weightIncrement)
        : { rec: "FIRST_TIME", weight: null };
  } else {
    result = recommendProgression({
      priorSets,
      previousSets: prior[1] ? toPrior(prior[1]) : null,
      targets: {
        repRangeMin: slot.repRangeMin,
        repRangeMax: slot.repRangeMax,
        targetRirMin: slot.targetRirMin,
        priorTargetSets: prior[0]?.targetSets ?? targets.sets,
      },
      weightIncrement: slot.exercise.weightIncrement,
      latestRecoveryScore: ctx.latestRecoveryScore,
    });
  }

  return {
    targets,
    result,
    prevSets: completedPrior.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir })),
    prevWorkingWeight: prevWorkingWeight != null && prevWorkingWeight > 0 ? prevWorkingWeight : null,
  };
}

// ---------------------------------------------------------------------------
// Workout overview (app/workout/page.tsx)
// ---------------------------------------------------------------------------

export interface OverviewExercise {
  templateExerciseId: string;
  name: string;
  priority: string;
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  restSeconds: number;
  isPerSide: boolean;
  recommendation: RecommendationKind;
  weight: number | null;
  prevWorkingWeight: number | null;
}

export interface NextWorkoutPreview {
  templateId: string;
  templateName: string;
  date: LocalDate;
  dateLabel: string;
  isToday: boolean;
  week: number;
  phase: number;
  isDeload: boolean;
  estMinutes: number;
  totalSets: number;
  exercises: OverviewExercise[];
}

export interface InProgressPreview {
  id: string;
  name: string;
  date: LocalDate;
  dateLabel: string;
  startedAt: string | null;
  completedSets: number;
  totalTargetSets: number;
}

export interface WorkoutOverview {
  position: { week: number; phase: number; isDeload: boolean; cycleComplete: boolean } | null;
  inProgress: InProgressPreview | null;
  next: NextWorkoutPreview | null;
}

export interface ProgramWorkout {
  id: string;
  name: string;
  dayNumber: number;
  exercises: Array<{
    id: string;
    name: string;
    sets: number;
    repMin: number;
    repMax: number;
    rirMin: number;
    rirMax: number;
    restSeconds: number;
    isPerSide: boolean;
  }>;
}

/** The complete active program with targets resolved for the current block phase. */
export async function getProgramOverview(): Promise<ProgramWorkout[]> {
  const today = localToday();
  const block = await getLatestBlock();
  const rawWeek = block ? weekInCycle(block, today) : 1;
  const week = rawWeek > 13 ? 1 : Math.max(1, rawWeek);
  const phase = blockPhase(week);
  const isDeload = isDeloadWeek(week);

  const templates = await prisma.workoutTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { dayNumber: "asc" }],
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: true, blockOverrides: true },
      },
    },
  });

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    dayNumber: template.dayNumber,
    exercises: template.exercises.map((slot) => {
      const targets = resolveTargets(slot, slot.blockOverrides, phase, isDeload);
      return {
        id: slot.id,
        name: slot.exercise.name,
        sets: targets.sets,
        repMin: targets.repMin,
        repMax: targets.repMax,
        rirMin: targets.rirMin,
        rirMax: targets.rirMax,
        restSeconds: targets.restSeconds,
        isPerSide: slot.isPerSide,
      };
    }),
  }));
}

export async function getWorkoutOverview(): Promise<WorkoutOverview> {
  const today = localToday();
  const block = await getLatestBlock();

  const inProgressRaw = await prisma.workoutSession.findFirst({
    where: { status: "IN_PROGRESS" },
    orderBy: { date: "desc" },
    include: { template: true, exercises: { include: { sets: true } } },
  });

  const inProgress: InProgressPreview | null = inProgressRaw
    ? {
        id: inProgressRaw.id,
        name: inProgressRaw.template.name,
        date: inProgressRaw.date,
        dateLabel: fmtDisplay(inProgressRaw.date),
        startedAt: inProgressRaw.startedAt?.toISOString() ?? null,
        completedSets: inProgressRaw.exercises.reduce(
          (n, ex) => n + ex.sets.filter((s) => s.completed).length,
          0
        ),
        totalTargetSets: inProgressRaw.exercises.reduce(
          (n, ex) => n + Math.max(ex.targetSets, ex.sets.length),
          0
        ),
      }
    : null;

  if (!block) return { position: null, inProgress, next: null };

  const week = weekInCycle(block, today);
  const cycleComplete = week > 13;
  const position = {
    week: cycleComplete ? 1 : Math.max(1, week),
    phase: cycleComplete ? 1 : blockPhase(Math.max(1, week)),
    isDeload: !cycleComplete && isDeloadWeek(week),
    cycleComplete,
  };

  // Rotate through the active program's ordered days. Calendar weekdays do
  // not determine the workout; the user may always override this suggestion.
  let next: NextWorkoutPreview | null = null;
  const activeProgram = await prisma.program.findFirst({ where: { isActive: true } });
  const templates = await prisma.workoutTemplate.findMany({
      where: { programId: activeProgram?.id, isActive: true },
      orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }],
      include: {
        exercises: {
          orderBy: { sortOrder: "asc" },
          include: { exercise: true, blockOverrides: true },
        },
      },
    });
  const lastCompleted = await prisma.workoutSession.findFirst({
    where: { status: "COMPLETED", template: { programId: activeProgram?.id } },
    orderBy: [{ date: "desc" }, { completedAt: "desc" }],
    select: { template: { select: { dayNumber: true } } },
  });
  const template = templates.find((t) => t.dayNumber > (lastCompleted?.template.dayNumber ?? 0)) ?? templates[0];
  if (template) {
    const date = today;

    // Week/phase for the previewed date. Past the cycle, the Start action
    // creates the next block; preview it as week 1.
    const rawWeek = weekInCycle(block, date);
    const w = rawWeek > 13 ? 1 : Math.max(1, rawWeek);
    const phase = blockPhase(w);
    const isDeload = isDeloadWeek(w);

    const deloadPct = await getDeloadPct();
    const latestRecoveryScore = await getLatestRecoveryScore();

    const exercises: OverviewExercise[] = [];
    for (const slot of template.exercises) {
      const plan = await planSlot(slot, phase, isDeload, {
        deloadPct,
        latestRecoveryScore,
        beforeDate: date,
      });
      exercises.push({
        templateExerciseId: slot.id,
        name: slot.exercise.name,
        priority: slot.priority,
        sets: plan.targets.sets,
        repMin: plan.targets.repMin,
        repMax: plan.targets.repMax,
        rirMin: plan.targets.rirMin,
        rirMax: plan.targets.rirMax,
        restSeconds: plan.targets.restSeconds,
        isPerSide: slot.isPerSide,
        recommendation: plan.result.rec,
        weight: plan.result.weight,
        prevWorkingWeight: plan.prevWorkingWeight,
      });
    }

    const totalSets = exercises.reduce((n, e) => n + e.sets, 0);
    const workSeconds = exercises.reduce((n, e) => n + e.sets * (e.restSeconds + 45), 0);
    const estMinutes = Math.round(workSeconds / 60 / 5) * 5;

    next = {
      templateId: template.id,
      templateName: template.name,
      date,
      dateLabel: fmtDisplay(date),
      isToday: true,
      week: w,
      phase,
      isDeload,
      estMinutes,
      totalSets,
      exercises,
    };
  }

  return { position, inProgress, next };
}

// ---------------------------------------------------------------------------
// Session detail (logging screen + completed summary)
// ---------------------------------------------------------------------------

export interface SessionPrChip {
  id: string;
  exerciseName: string;
  label: string;
}

export interface SummaryExercise {
  sessionExerciseId: string;
  name: string;
  targetSets: number;
  completedSets: number;
  /** e.g. "185×8 · 185×8 · 185×7" */
  setSummary: string;
  volume: number;
  bestE1rm: number | null;
  prLabels: string[];
}

export interface SessionSummaryData {
  totalVolume: number;
  completedSets: number;
  targetSets: number;
  totalReps: number;
  avgReps: number | null;
  bestE1rm: number | null;
  durationMinutes: number | null;
  prevVolume: number | null;
  volumeDeltaPct: number | null;
  prs: SessionPrChip[];
  exercises: SummaryExercise[];
}

export interface SessionDetail {
  session: LoggerSession;
  summary: SessionSummaryData;
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const raw = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      template: true,
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: {
          exercise: true,
          templateExercise: true,
          sets: { orderBy: { setNumber: "asc" } },
        },
      },
    },
  });
  if (!raw) return null;

  const exercises: LoggerExercise[] = [];
  for (const se of raw.exercises) {
    // Previous-session ghost line: most recent non-deload completed session
    // for this slot, strictly before this session's date.
    const prev = await prisma.sessionExercise.findFirst({
      where: {
        templateExerciseId: se.templateExerciseId,
        sessionId: { not: raw.id },
        session: { status: "COMPLETED", isDeload: false, date: { lt: raw.date } },
      },
      orderBy: { session: { date: "desc" } },
      include: { sets: { orderBy: { setNumber: "asc" } } },
    });
    const prevCompleted = prev?.sets.filter((s) => s.completed) ?? [];
    const prevWorkingWeight =
      prevCompleted.length > 0 ? Math.max(...prevCompleted.map((s) => s.weight)) : null;

    // Substitution options: curated alternatives in either direction.
    const altRows = await prisma.exerciseAlternative.findMany({
      where: { OR: [{ exerciseId: se.exerciseId }, { alternativeId: se.exerciseId }] },
      include: { exercise: true, alternative: true },
    });
    const alternatives = altRows
      .map((a) => (a.exerciseId === se.exerciseId ? a.alternative : a.exercise))
      .filter((e, i, arr) => e.id !== se.exerciseId && arr.findIndex((x) => x.id === e.id) === i)
      .map((e) => ({ id: e.id, name: e.name }));

    exercises.push({
      sessionExerciseId: se.id,
      templateExerciseId: se.templateExerciseId,
      exerciseId: se.exerciseId,
      name: se.exercise.name,
      isBodyweight: se.exercise.isBodyweight,
      isPerSide: se.templateExercise.isPerSide,
      weightIncrement: se.exercise.weightIncrement,
      priority: se.templateExercise.priority,
      targetSets: se.targetSets,
      targetRepMin: se.targetRepMin,
      targetRepMax: se.targetRepMax,
      targetRirMin: se.targetRirMin,
      targetRirMax: se.targetRirMax,
      restSeconds: se.restSeconds,
      targetWeight: se.targetWeight,
      recommendation: (se.recommendation as RecommendationKind | null) ?? null,
      prevWorkingWeight,
      notes: se.notes,
      prevSets: prevCompleted.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir })),
      alternatives,
      sets: se.sets.map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        weight: s.weight,
        reps: s.reps,
        rir: s.rir,
        completed: s.completed,
      })),
    });
  }

  const session: LoggerSession = {
    id: raw.id,
    name: raw.template.name,
    date: raw.date,
    weekInCycle: raw.weekInCycle,
    blockPhase: raw.blockPhase,
    isDeload: raw.isDeload,
    status: raw.status,
    startedAt: raw.startedAt?.toISOString() ?? null,
    exercises,
  };

  return { session, summary: await buildSummary(raw, exercises) };
}

async function buildSummary(
  raw: {
    id: string;
    date: string;
    templateId: string;
    startedAt: Date | null;
    completedAt: Date | null;
    exercises: {
      id: string;
      exerciseId: string;
      targetSets: number;
      exercise: { name: string };
      sets: { weight: number; reps: number; completed: boolean; id: string }[];
    }[];
  },
  _logger: LoggerExercise[]
): Promise<SessionSummaryData> {
  const allCompleted = raw.exercises.flatMap((ex) => ex.sets.filter((s) => s.completed));
  const totalVolume = allCompleted.reduce((n, s) => n + s.weight * s.reps, 0);
  const totalReps = allCompleted.reduce((n, s) => n + s.reps, 0);
  const completedSets = allCompleted.length;
  const targetSets = raw.exercises.reduce((n, ex) => n + ex.targetSets, 0);

  const setLogIds = raw.exercises.flatMap((ex) => ex.sets.map((s) => s.id));
  const exerciseIds = raw.exercises.map((ex) => ex.exerciseId);
  const prRows = await prisma.personalRecord.findMany({
    where: {
      OR: [
        ...(setLogIds.length > 0 ? [{ setLogId: { in: setLogIds } }] : []),
        { date: raw.date, setLogId: null, exerciseId: { in: exerciseIds } },
      ],
    },
    include: { exercise: true },
  });

  const prs: SessionPrChip[] = prRows.map((p) => ({
    id: p.id,
    exerciseName: p.exercise.name,
    label: PR_TYPE_LABELS[p.type],
  }));

  const exercises: SummaryExercise[] = raw.exercises.map((ex) => {
    const done = ex.sets.filter((s) => s.completed);
    const volume = done.reduce((n, s) => n + s.weight * s.reps, 0);
    const best = done.reduce<number | null>((acc, s) => {
      if (s.weight <= 0 || s.reps <= 0) return acc;
      const v = epleyDisplay(s.weight, s.reps);
      return acc == null || v > acc ? v : acc;
    }, null);
    const exercisePrs = prRows
      .filter((p) => p.exerciseId === ex.exerciseId)
      .map((p) => PR_TYPE_LABELS[p.type]);
    return {
      sessionExerciseId: ex.id,
      name: ex.exercise.name,
      targetSets: ex.targetSets,
      completedSets: done.length,
      setSummary: done.map((s) => `${trimWeight(s.weight)}×${s.reps}`).join(" · "),
      volume,
      bestE1rm: best,
      prLabels: [...new Set(exercisePrs)],
    };
  });

  const bestE1rm = exercises.reduce<number | null>(
    (acc, e) => (e.bestE1rm != null && (acc == null || e.bestE1rm > acc) ? e.bestE1rm : acc),
    null
  );

  const prevSession = await prisma.workoutSession.findFirst({
    where: { templateId: raw.templateId, status: "COMPLETED", date: { lt: raw.date } },
    orderBy: { date: "desc" },
  });
  const prevVolume = prevSession?.totalVolume ?? null;
  const volumeDeltaPct =
    prevVolume != null && prevVolume > 0
      ? ((totalVolume - prevVolume) / prevVolume) * 100
      : null;

  const durationMinutes =
    raw.startedAt && raw.completedAt
      ? Math.max(1, Math.round((raw.completedAt.getTime() - raw.startedAt.getTime()) / 60000))
      : null;

  return {
    totalVolume,
    completedSets,
    targetSets,
    totalReps,
    avgReps: completedSets > 0 ? totalReps / completedSets : null,
    bestE1rm,
    durationMinutes,
    prevVolume,
    volumeDeltaPct,
    prs,
    exercises,
  };
}

function trimWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : String(Math.round(w * 10) / 10);
}

// ---------------------------------------------------------------------------
// History (app/history/page.tsx)
// ---------------------------------------------------------------------------

export interface HistorySessionRow {
  id: string;
  name: string;
  date: LocalDate;
  dateLabel: string;
  status: string;
  isDeload: boolean;
  weekInCycle: number;
  totalVolume: number;
  completedSets: number;
  targetSets: number;
  prCount: number;
}

/** WHOOP-detected activity shown read-only alongside logged sessions. */
export interface HistoryWhoopRow {
  id: string;
  sportName: string;
  date: LocalDate;
  dateLabel: string;
  durationMin: number;
  /** "PENDING_SCORE" rows show without metrics. */
  scoreState: string;
  strain: number | null; // 1dp
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null; // kcal = kilojoule / 4.184, rounded
  distanceKm: number | null; // 1dp
}

export interface HistoryWeekGroup {
  weekStart: LocalDate;
  label: string;
  /** 0 when the week holds only WHOOP activities (no logged sessions). */
  weekInCycle: number;
  sessions: HistorySessionRow[];
  whoopWorkouts: HistoryWhoopRow[];
}

export async function getHistory(): Promise<HistoryWeekGroup[]> {
  const [sessions, whoopRaw] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { status: { in: ["COMPLETED", "IN_PROGRESS", "SKIPPED"] } },
      orderBy: { date: "desc" },
      include: {
        template: true,
        exercises: {
          include: { sets: { select: { id: true, completed: true, weight: true, reps: true } } },
        },
      },
    }),
    prisma.whoopWorkout.findMany({ orderBy: { start: "desc" } }),
  ]);
  if (sessions.length === 0 && whoopRaw.length === 0) return [];

  const allSetIds = sessions.flatMap((s) =>
    s.exercises.flatMap((ex) => ex.sets.map((x) => x.id))
  );
  const prRows =
    allSetIds.length > 0
      ? await prisma.personalRecord.findMany({
          where: { setLogId: { in: allSetIds } },
          select: { setLogId: true },
        })
      : [];
  const prSetIds = new Set(prRows.map((p) => p.setLogId));
  // Session-volume PRs (setLogId null) matched by date+exercise.
  const volumePrs = await prisma.personalRecord.findMany({
    where: { setLogId: null, type: "MOST_SESSION_VOLUME" },
    select: { date: true, exerciseId: true },
  });

  const groups = new Map<LocalDate, HistoryWeekGroup>();
  const groupFor = (date: LocalDate, weekInCycle: number): HistoryWeekGroup => {
    const weekStart = isoWeekMonday(date);
    let group = groups.get(weekStart);
    if (!group) {
      group = {
        weekStart,
        label: `Week of ${fmtDisplay(weekStart)}`,
        weekInCycle,
        sessions: [],
        whoopWorkouts: [],
      };
      groups.set(weekStart, group);
    }
    if (group.weekInCycle === 0 && weekInCycle > 0) group.weekInCycle = weekInCycle;
    return group;
  };

  for (const s of sessions) {
    const group = groupFor(s.date, s.weekInCycle);
    const setIds = s.exercises.flatMap((ex) => ex.sets.map((x) => x.id));
    const exerciseIds = new Set(s.exercises.map((ex) => ex.exerciseId));
    const prCount =
      setIds.filter((id) => prSetIds.has(id)).length +
      volumePrs.filter((p) => p.date === s.date && exerciseIds.has(p.exerciseId)).length;

    group.sessions.push({
      id: s.id,
      name: s.template.name,
      date: s.date,
      dateLabel: fmtDisplay(s.date),
      status: s.status,
      isDeload: s.isDeload,
      weekInCycle: s.weekInCycle,
      totalVolume:
        s.status === "COMPLETED"
          ? s.totalVolume
          : s.exercises.reduce(
              (n, ex) =>
                n +
                ex.sets.reduce((m, x) => (x.completed ? m + x.weight * x.reps : m), 0),
              0
            ),
      completedSets: s.exercises.reduce(
        (n, ex) => n + ex.sets.filter((x) => x.completed).length,
        0
      ),
      targetSets: s.exercises.reduce((n, ex) => n + ex.targetSets, 0),
      prCount,
    });
  }

  for (const w of whoopRaw) {
    const hasMetrics =
      w.strain != null ||
      w.avgHeartRate != null ||
      w.maxHeartRate != null ||
      w.kilojoule != null ||
      w.distanceMeter != null;
    // Unscorable records with nothing to show are noise; pending ones still list.
    if (w.scoreState === "UNSCORABLE" && !hasMetrics) continue;

    groupFor(w.date, 0).whoopWorkouts.push({
      id: w.id,
      sportName: w.sportName,
      date: w.date,
      dateLabel: fmtDisplay(w.date),
      durationMin: Math.max(1, Math.round((w.end.getTime() - w.start.getTime()) / 60000)),
      scoreState: w.scoreState,
      strain: w.strain != null ? Math.round(w.strain * 10) / 10 : null,
      avgHeartRate: w.avgHeartRate,
      maxHeartRate: w.maxHeartRate,
      calories: w.kilojoule != null ? Math.round(w.kilojoule / 4.184) : null,
      distanceKm: w.distanceMeter != null ? Math.round(w.distanceMeter / 100) / 10 : null,
    });
  }

  return [...groups.values()].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}
