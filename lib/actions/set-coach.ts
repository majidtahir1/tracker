"use server";

import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { localToday } from "@/lib/dates";
import { getLatestEffectiveRecovery, getWhoopDayContext, toCoachWhoopContext } from "@/lib/queries/effective-recovery";
import { calculateSetGuardrails, deterministicCoachResponse } from "@/lib/ai/set-coach-guardrails";
import { requestMiniMaxCoach } from "@/lib/ai/set-coach-provider";
import type { SetCoachResponse } from "@/lib/ai/set-coach-types";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export type SetCoachResult = { ok: true; advice: SetCoachResponse } | { ok: false; error: string };

export async function askSetCoach(sessionExerciseId: string): Promise<SetCoachResult> {
  if (!sessionExerciseId) return { ok: false, error: "Exercise is required." };
  const userId = await requireUserId();
  try {
    await enforceRateLimit(userId, "ai:set-coach", 30, 60 * 60);
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, error: error.message };
    throw error;
  }
  const se = await prisma.sessionExercise.findUnique({
    where: { id: sessionExerciseId },
    include: {
      exercise: true,
      templateExercise: true,
      session: true,
      sets: { where: { completed: true }, orderBy: { setNumber: "asc" } },
    },
  });
  if (!se || se.session.userId !== userId) return { ok: false, error: "Exercise was not found." };
  if (se.session.status !== "IN_PROGRESS") return { ok: false, error: "Coaching is available during an active workout." };
  const lastSet = se.sets.at(-1);
  if (!lastSet) return { ok: false, error: "Complete a set before asking the coach." };

  const [recovery, whoopDay, history] = await Promise.all([
    getLatestEffectiveRecovery(userId, localToday()),
    getWhoopDayContext(userId, localToday()),
    prisma.sessionExercise.findMany({
      where: { templateExerciseId: se.templateExerciseId, session: { userId, status: "COMPLETED", isDeload: false, date: { lt: se.session.date } } },
      orderBy: { session: { date: "desc" } }, take: 2,
      select: { session: { select: { date: true } }, sets: { where: { completed: true }, orderBy: { setNumber: "asc" }, select: { setNumber: true, weight: true, reps: true, rir: true } } },
    }),
  ]);
  const remainingSets = Math.max(0, se.targetSets - se.sets.length);
  const guardrails = calculateSetGuardrails({
    lastSet: { weight: lastSet.weight, reps: lastSet.reps, rir: lastSet.rir },
    targets: { repMin: se.targetRepMin, repMax: se.targetRepMax, rirMin: se.targetRirMin, rirMax: se.targetRirMax },
    weightIncrement: se.exercise.weightIncrement, recoveryScore: recovery.score,
    isDeload: se.session.isDeload, deloadWeight: se.targetWeight, remainingSets,
  });
  const whoop = toCoachWhoopContext(whoopDay);
  const context = {
    exercise: { name: se.exercise.name, equipment: se.exercise.equipment, isBodyweight: se.exercise.isBodyweight, isPerSide: se.templateExercise.isPerSide, weightIncrement: se.exercise.weightIncrement, weightConvention: se.exercise.equipment === "DUMBBELL" ? "PER_DUMBBELL" : "TOTAL_EXTERNAL_LOAD" },
    prescription: { targetSets: se.targetSets, repMin: se.targetRepMin, repMax: se.targetRepMax, rirMin: se.targetRirMin, rirMax: se.targetRirMax },
    currentSets: se.sets.map((s) => ({ setNumber: s.setNumber, weight: s.weight, reps: s.reps, rir: s.rir })),
    remainingSets, recentSessions: history.map((h) => ({ date: h.session.date, sets: h.sets })),
    recoveryScore: recovery.score,
    program: { week: se.session.weekInCycle, phase: se.session.blockPhase, isDeload: se.session.isDeload },
    guardrails,
    ...(whoop ? { whoop } : {}),
  };
  const advice = await requestMiniMaxCoach(context, guardrails) ?? deterministicCoachResponse(guardrails);
  return { ok: true, advice };
}
