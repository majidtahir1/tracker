/**
 * lib/queries/exercises.ts — read layer for the exercise library + detail
 * pages. Server-only: computes derived history/recommendation shapes and
 * returns plain serializable props for client components.
 */
import { prisma } from "@/lib/db";
import { localToday } from "@/lib/dates";
import { getLatestEffectiveRecovery } from "@/lib/queries/effective-recovery";
import { epley } from "@/lib/e1rm";
import { parseSecondaryMuscles } from "@/lib/volume";
import {
  recommendProgression,
  type PriorSet,
  type ProgressionResult,
} from "@/lib/progression";
import type {
  Difficulty,
  Equipment,
  ExerciseType,
  MuscleGroup,
  Priority,
  PrType,
} from "@/lib/generated/prisma/enums";

// ---------- Library ----------

export interface ExerciseListItem {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  difficulty: Difficulty;
  isFavorite: boolean;
  injuryFriendly: boolean;
  isBodyweight: boolean;
  /** Highest program priority across template slots ("HIGHEST" > "HIGH" > "MEDIUM"), null if unprogrammed/NORMAL. */
  topPriority: Priority | null;
  /** Number of program slots this exercise currently fills. */
  slotCount: number;
}

const PRIORITY_RANK: Record<Priority, number> = {
  HIGHEST: 3,
  HIGH: 2,
  MEDIUM: 1,
  NORMAL: 0,
};

export async function getExerciseLibrary(): Promise<ExerciseListItem[]> {
  const exercises = await prisma.exercise.findMany({
    orderBy: { name: "asc" },
    include: { templateSlots: { select: { priority: true } } },
  });

  return exercises.map((e) => {
    const top = e.templateSlots.reduce<Priority | null>((best, s) => {
      if (s.priority === "NORMAL") return best;
      if (!best || PRIORITY_RANK[s.priority] > PRIORITY_RANK[best]) return s.priority;
      return best;
    }, null);
    return {
      id: e.id,
      name: e.name,
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: parseSecondaryMuscles(e.secondaryMuscles),
      equipment: e.equipment,
      type: e.type,
      difficulty: e.difficulty,
      isFavorite: e.isFavorite,
      injuryFriendly: e.injuryFriendly,
      isBodyweight: e.isBodyweight,
      topPriority: top,
      slotCount: e.templateSlots.length,
    };
  });
}

// ---------- Detail ----------

export interface AlternativeInfo {
  id: string;
  name: string;
  equipment: Equipment;
  primaryMuscle: MuscleGroup;
}

export interface SlotRecommendation {
  slotId: string;
  /** "Push Dominant Upper · Mon" */
  slotLabel: string;
  priority: Priority;
  repRangeMin: number;
  repRangeMax: number;
  baseSets: number;
  result: ProgressionResult;
  /** Working weight the recommendation is based on, if any. */
  lastWeight: number | null;
}

export interface HistoryPoint {
  date: string; // YYYY-MM-DD
  /** Top completed-set weight (added load for bodyweight moves). */
  topWeight: number;
  /** Best Epley e1RM across completed sets; null for bodyweight exercises. */
  e1rm: number | null;
  isDeload: boolean;
}

export interface SessionLogRow {
  sessionId: string;
  date: string;
  workoutName: string;
  /** "185×8 · 185×7 · 185×7" (completed sets, in order). */
  setsSummary: string;
  volume: number;
  bestE1rm: number | null;
  isDeload: boolean;
}

export interface ExercisePrInfo {
  type: PrType;
  value: number;
  weight: number | null;
  reps: number | null;
  date: string;
}

export interface ExerciseDetail {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  difficulty: Difficulty;
  videoUrl: string | null;
  notes: string | null;
  isFavorite: boolean;
  injuryFriendly: boolean;
  isBodyweight: boolean;
  weightIncrement: number;
  topPriority: Priority | null;
  alternatives: AlternativeInfo[];
  recommendations: SlotRecommendation[];
  history: HistoryPoint[]; // ascending by date
  sessionLog: SessionLogRow[]; // descending by date
  personalRecords: ExercisePrInfo[];
}

function fmtSet(weight: number, reps: number): string {
  const w = Number.isInteger(weight) ? String(weight) : weight.toFixed(1).replace(/\.0$/, "");
  return `${w}×${reps}`;
}

export async function getExerciseDetail(id: string): Promise<ExerciseDetail | null> {
  const exercise = await prisma.exercise.findUnique({
    where: { id },
    include: {
      substitutionsA: { include: { alternative: true } },
      substitutionsB: { include: { exercise: true } },
      personalRecords: { orderBy: { date: "desc" } },
      templateSlots: { include: { template: true } },
    },
  });
  if (!exercise) return null;

  // Alternatives: curated links in either direction, deduped.
  const altMap = new Map<string, AlternativeInfo>();
  for (const link of exercise.substitutionsA) {
    const a = link.alternative;
    altMap.set(a.id, { id: a.id, name: a.name, equipment: a.equipment, primaryMuscle: a.primaryMuscle });
  }
  for (const link of exercise.substitutionsB) {
    const a = link.exercise;
    altMap.set(a.id, { id: a.id, name: a.name, equipment: a.equipment, primaryMuscle: a.primaryMuscle });
  }
  altMap.delete(exercise.id);

  // Progression lineage: history keys on templateExerciseId for programmed
  // slots; fall back to exerciseId for ad-hoc history (ARCHITECTURE.md §7).
  const slotIds = exercise.templateSlots.map((s) => s.id);
  const sessionExercises = await prisma.sessionExercise.findMany({
    where: {
      OR: [
        ...(slotIds.length > 0 ? [{ templateExerciseId: { in: slotIds } }] : []),
        { exerciseId: exercise.id },
      ],
      session: { status: "COMPLETED" },
    },
    include: {
      sets: { orderBy: { setNumber: "asc" } },
      session: { include: { template: { select: { name: true } } } },
    },
    orderBy: { session: { date: "asc" } },
  });

  const history: HistoryPoint[] = [];
  const sessionLog: SessionLogRow[] = [];
  for (const se of sessionExercises) {
    const done = se.sets.filter((s) => s.completed);
    if (done.length === 0) continue;
    const topWeight = Math.max(...done.map((s) => s.weight));
    const bestE1rm = exercise.isBodyweight
      ? null
      : Math.round(Math.max(...done.map((s) => epley(s.weight, s.reps))));
    const volume = done.reduce((sum, s) => sum + s.weight * s.reps, 0);
    history.push({
      date: se.session.date,
      topWeight,
      e1rm: bestE1rm && bestE1rm > 0 ? bestE1rm : null,
      isDeload: se.session.isDeload,
    });
    sessionLog.push({
      sessionId: se.sessionId,
      date: se.session.date,
      workoutName: se.session.template.name,
      setsSummary: done.map((s) => fmtSet(s.weight, s.reps)).join(" · "),
      volume: Math.round(volume),
      bestE1rm: bestE1rm && bestE1rm > 0 ? bestE1rm : null,
      isDeload: se.session.isDeload,
    });
  }
  sessionLog.reverse(); // newest first for the table

  // Per-slot recommendation from lib/progression (effective recovery score).
  const latestRecovery = await getLatestEffectiveRecovery(localToday());

  const recommendations: SlotRecommendation[] = exercise.templateSlots.map((slot) => {
    const slotHistory = sessionExercises
      .filter((se) => se.templateExerciseId === slot.id && !se.session.isDeload)
      .slice(-2); // ascending → last two
    const toPriorSets = (sets: { weight: number; reps: number; rir: number | null; completed: boolean }[]): PriorSet[] =>
      sets.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir, completed: s.completed }));

    const prior = slotHistory[slotHistory.length - 1] ?? null;
    const previous = slotHistory.length > 1 ? slotHistory[0] : null;

    const result = recommendProgression({
      priorSets: prior ? toPriorSets(prior.sets) : null,
      previousSets: previous ? toPriorSets(previous.sets) : null,
      targets: {
        repRangeMin: prior?.targetRepMin ?? slot.repRangeMin,
        repRangeMax: prior?.targetRepMax ?? slot.repRangeMax,
        targetRirMin: prior?.targetRirMin ?? slot.targetRirMin,
        priorTargetSets: prior?.targetSets ?? slot.baseSets,
      },
      weightIncrement: exercise.weightIncrement,
      latestRecoveryScore: latestRecovery.score,
    });

    const lastWeight = prior
      ? Math.max(0, ...prior.sets.filter((s) => s.completed).map((s) => s.weight)) || null
      : null;

    return {
      slotId: slot.id,
      slotLabel: slot.template.name,
      priority: slot.priority,
      repRangeMin: slot.repRangeMin,
      repRangeMax: slot.repRangeMax,
      baseSets: slot.baseSets,
      result,
      lastWeight,
    };
  });

  const topPriority = exercise.templateSlots.reduce<Priority | null>((best, s) => {
    if (s.priority === "NORMAL") return best;
    if (!best || PRIORITY_RANK[s.priority] > PRIORITY_RANK[best]) return s.priority;
    return best;
  }, null);

  return {
    id: exercise.id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: parseSecondaryMuscles(exercise.secondaryMuscles),
    equipment: exercise.equipment,
    type: exercise.type,
    difficulty: exercise.difficulty,
    videoUrl: exercise.videoUrl,
    notes: exercise.notes,
    isFavorite: exercise.isFavorite,
    injuryFriendly: exercise.injuryFriendly,
    isBodyweight: exercise.isBodyweight,
    weightIncrement: exercise.weightIncrement,
    topPriority,
    alternatives: [...altMap.values()],
    recommendations,
    history,
    sessionLog,
    personalRecords: exercise.personalRecords.map((pr) => ({
      type: pr.type,
      value: Math.round(pr.value * 10) / 10,
      weight: pr.weight,
      reps: pr.reps,
      date: pr.date,
    })),
  };
}
