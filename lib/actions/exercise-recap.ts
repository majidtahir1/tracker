"use server";

/**
 * lib/actions/exercise-recap.ts — automatic coach feedback fired when the last
 * set of an exercise is checked off (docs/superpowers/specs/2026-07-10).
 * Auto-triggered from the logger, so validation failures return ok:false and
 * the client discards them silently; past validation it never fails — MiniMax
 * falls back to the deterministic recap.
 */
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { localToday } from "@/lib/dates";
import {
  getLatestEffectiveRecovery,
  getWhoopDayContext,
  toCoachWhoopContext,
} from "@/lib/queries/effective-recovery";
import { deterministicRecap } from "@/lib/ai/exercise-recap-fallback";
import { requestMiniMaxRecap } from "@/lib/ai/exercise-recap-provider";
import type { ExerciseRecapResponse } from "@/lib/ai/exercise-recap-types";

export type ExerciseRecapResult =
  | { ok: true; recap: ExerciseRecapResponse }
  | { ok: false; error: string };

export async function getExerciseRecap(sessionExerciseId: string): Promise<ExerciseRecapResult> {
  if (!sessionExerciseId) return { ok: false, error: "Exercise is required." };
  const userId = await requireUserId();
  const se = await prisma.sessionExercise.findUnique({
    where: { id: sessionExerciseId },
    include: {
      exercise: true,
      templateExercise: true,
      session: {
        include: {
          exercises: {
            orderBy: { sortOrder: "asc" },
            include: { exercise: true, sets: { where: { completed: true } } },
          },
        },
      },
      sets: { where: { completed: true }, orderBy: { setNumber: "asc" } },
    },
  });
  if (!se || se.session.userId !== userId) return { ok: false, error: "Exercise was not found." };
  if (se.session.status !== "IN_PROGRESS") {
    return { ok: false, error: "Coaching is available during an active workout." };
  }
  if (se.sets.length < se.targetSets) {
    return { ok: false, error: "Finish every set before the recap." };
  }

  const [recovery, whoopDay, history] = await Promise.all([
    getLatestEffectiveRecovery(userId, localToday()),
    getWhoopDayContext(userId, localToday()),
    prisma.sessionExercise.findMany({
      where: {
        templateExerciseId: se.templateExerciseId,
        session: { userId, status: "COMPLETED", isDeload: false, date: { lt: se.session.date } },
      },
      orderBy: { session: { date: "desc" } },
      take: 2,
      select: {
        session: { select: { date: true } },
        sets: {
          where: { completed: true },
          orderBy: { setNumber: "asc" },
          select: { setNumber: true, weight: true, reps: true, rir: true },
        },
      },
    }),
  ]);

  const remaining = se.session.exercises
    .filter((sib) => sib.id !== se.id && sib.sets.length < sib.targetSets)
    .map((sib) => ({
      name: sib.exercise.name,
      setsRemaining: Math.max(0, sib.targetSets - sib.sets.length),
      targetReps: { min: sib.targetRepMin, max: sib.targetRepMax },
    }));
  const sessionSetsDone = se.session.exercises.reduce((n, sib) => n + sib.sets.length, 0);
  const sessionSetsTarget = se.session.exercises.reduce((n, sib) => n + sib.targetSets, 0);

  const whoop = toCoachWhoopContext(whoopDay);
  const context = {
    finishedExercise: {
      name: se.exercise.name,
      equipment: se.exercise.equipment,
      isBodyweight: se.exercise.isBodyweight,
      isPerSide: se.templateExercise.isPerSide,
      weightConvention:
        se.exercise.equipment === "DUMBBELL" ? "PER_DUMBBELL" : "TOTAL_EXTERNAL_LOAD",
      prescription: {
        targetSets: se.targetSets,
        repMin: se.targetRepMin,
        repMax: se.targetRepMax,
        rirMin: se.targetRirMin,
        rirMax: se.targetRirMax,
      },
      completedSets: se.sets.map((s) => ({
        setNumber: s.setNumber,
        weight: s.weight,
        reps: s.reps,
        rir: s.rir,
      })),
    },
    recentSessions: history.map((h) => ({ date: h.session.date, sets: h.sets })),
    remainingExercises: remaining,
    sessionProgress: { setsDone: sessionSetsDone, setsTarget: sessionSetsTarget },
    recoveryScore: recovery.score,
    program: { week: se.session.weekInCycle, phase: se.session.blockPhase, isDeload: se.session.isDeload },
    ...(whoop ? { whoop } : {}),
  };

  const recap =
    (await requestMiniMaxRecap(context)) ??
    deterministicRecap({
      exerciseName: se.exercise.name,
      completedSets: se.sets.map((s) => ({ weight: s.weight, reps: s.reps })),
      priorSets: history[0]?.sets.map((s) => ({ weight: s.weight, reps: s.reps })) ?? null,
      remaining: remaining.map((r) => ({ name: r.name, setsRemaining: r.setsRemaining })),
      isDeload: se.session.isDeload,
    });
  return { ok: true, recap };
}
