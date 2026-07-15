"use server";

/**
 * lib/actions/workout.ts — the Workout module's write layer.
 * startWorkout, logSet (+ PR detection), finishWorkout (+ session-volume PR),
 * substituteExercise (slot-preserving swap + audit), cancelWorkout, notes.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { addDays, isoWeekMonday, localToday } from "@/lib/dates";
import {
  blockPhase,
  isDeloadWeek,
  weekInCycle,
  isCycleComplete,
} from "@/lib/schedule";
import {
  detectSetPRs,
  detectSessionVolumePR,
  PR_TYPE_LABELS,
  type CurrentBests,
  type DetectedPr,
} from "@/lib/pr";
import {
  NOTIFICATIONS_ENABLED,
  prAchievedNotification,
} from "@/lib/notifications";
import { requireUserId } from "@/lib/session";
import {
  getDeloadPct,
  getLatestBlock,
  getLatestRecoveryScore,
  planSlot,
} from "@/lib/queries/workout";
import type { FiredPr } from "@/components/workout/types";
import { sendSessionPrPush } from "@/lib/push/events";
import { isOwnedSlot, isOwnedWorkout, isVisibleExercise } from "@/lib/program-access";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateWorkoutPaths(sessionId?: string) {
  revalidatePath("/");
  revalidatePath("/workout");
  revalidatePath("/history");
  revalidatePath("/records");
  if (sessionId) revalidatePath(`/workout/${sessionId}`);
}

// ---------------------------------------------------------------------------
// startWorkout — create (or resume) the session for a scheduled workout day
// ---------------------------------------------------------------------------

async function startWorkoutSession(formData: FormData): Promise<string> {
  const userId = await requireUserId();
  const templateId = String(formData.get("templateId") ?? "");
  const date = String(formData.get("date") ?? localToday());
  const scheduleOverride = formData.get("scheduleOverride") === "today";
  if (!templateId || !DATE_RE.test(date))
    throw new Error("Invalid start request");
  if (!(await isOwnedWorkout(userId, templateId))) throw new Error("Workout template not found");

  // Resume: an existing session for this template+date just flips to IN_PROGRESS.
  const existing = await prisma.workoutSession.findFirst({
    where: { userId, templateId, date },
    include: { exercises: true },
  });
  if (existing) {
    if (existing.status === "PLANNED" || existing.status === "SKIPPED") {
      await prisma.workoutSession.update({
        where: { id: existing.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: existing.startedAt ?? new Date(),
        },
      });
    }
    revalidateWorkoutPaths(existing.id);
    return existing.id;
  }

  // Ensure a current TrainingBlock (auto-roll after week 13 elapses).
  let block = await getLatestBlock();
  if (!block) {
    block = await prisma.trainingBlock.create({
      data: { userId, cycleNumber: 1, startDate: isoWeekMonday(date) },
    });
  } else if (isCycleComplete(block, date)) {
    block = await prisma.trainingBlock.create({
      data: {
        userId,
        cycleNumber: block.cycleNumber + 1,
        startDate: isoWeekMonday(date),
      },
    });
  }

  const template = await prisma.workoutTemplate.findUnique({
    where: { id: templateId },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: true, blockOverrides: true },
      },
    },
  });
  if (!template) throw new Error("Workout template not found");
  if (!template.isActive) throw new Error("Workout template is not active");
  if (date !== localToday() && scheduleOverride)
    throw new Error("Program day override is only valid for today");

  // A single-user logger should never fork two simultaneous workouts.
  const activeSession = await prisma.workoutSession.findFirst({
    where: { userId, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (activeSession) return activeSession.id;

  const week = Math.max(1, weekInCycle(block, date));
  const phase = blockPhase(week);
  const isDeload = isDeloadWeek(week);
  const deloadPct = await getDeloadPct();

  // Snapshot resolved targets + progression recommendations per slot.
  const slotData: {
    templateExerciseId: string;
    exerciseId: string;
    sortOrder: number;
    targetSets: number;
    targetRepMin: number;
    targetRepMax: number;
    targetRirMin: number;
    targetRirMax: number;
    restSeconds: number;
    targetWeight: number | null;
    recommendation: string | null;
  }[] = [];
  for (const slot of template.exercises) {
    const plan = await planSlot(slot, phase, isDeload, {
      deloadPct,
      beforeDate: date,
    });
    slotData.push({
      templateExerciseId: slot.id,
      exerciseId: slot.exerciseId,
      sortOrder: slot.sortOrder,
      targetSets: plan.targets.sets,
      targetRepMin: plan.targets.repMin,
      targetRepMax: plan.targets.repMax,
      targetRirMin: plan.targets.rirMin,
      targetRirMax: plan.targets.rirMax,
      restSeconds: plan.targets.restSeconds,
      targetWeight: plan.result.weight,
      recommendation: plan.result.rec === "FIRST_TIME" ? null : plan.result.rec,
    });
  }

  const session = await prisma.workoutSession.create({
    data: {
      userId,
      templateId,
      blockId: block.id,
      date,
      weekInCycle: week,
      blockPhase: phase,
      isDeload,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      exercises: { create: slotData },
    },
  });

  revalidateWorkoutPaths(session.id);
  return session.id;
}

export async function startWorkout(formData: FormData): Promise<void> {
  const sessionId = await startWorkoutSession(formData);
  redirect(`/workout/${sessionId}`);
}

export async function startWorkoutForMobile(input: {
  templateId: string;
  date?: string;
  scheduleOverride?: boolean;
}): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  const formData = new FormData();
  formData.set("templateId", input.templateId);
  if (input.date) formData.set("date", input.date);
  if (input.scheduleOverride) formData.set("scheduleOverride", "today");
  try {
    return { ok: true, sessionId: await startWorkoutSession(formData) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to start workout" };
  }
}

// ---------------------------------------------------------------------------
// logSet — upsert one set + run PR detection (lib/pr)
// ---------------------------------------------------------------------------

export interface LogSetInput {
  sessionExerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
  completed: boolean;
}

export interface LogSetResult {
  ok: boolean;
  setId?: string;
  prs: FiredPr[];
  error?: string;
}

export async function logSet(input: LogSetInput): Promise<LogSetResult> {
  const userId = await requireUserId();
  const { sessionExerciseId, setNumber } = input;
  const weight = Number(input.weight);
  const reps = Math.round(Number(input.reps));
  const rir =
    input.rir == null
      ? null
      : Math.max(0, Math.min(5, Math.round(Number(input.rir))));
  if (
    !sessionExerciseId ||
    !Number.isInteger(setNumber) ||
    setNumber < 1 ||
    setNumber > 30 ||
    !Number.isFinite(weight) ||
    weight < 0 ||
    weight > 2000 ||
    !Number.isInteger(reps) ||
    reps < 0 ||
    reps > 100
  ) {
    return { ok: false, prs: [], error: "Invalid set values" };
  }

  const se = await prisma.sessionExercise.findUnique({
    where: { id: sessionExerciseId },
    include: { session: true, exercise: true },
  });
  if (!se || se.session.userId !== userId)
    return { ok: false, prs: [], error: "Exercise not found" };

  const setLog = await prisma.setLog.upsert({
    where: { sessionExerciseId_setNumber: { sessionExerciseId, setNumber } },
    create: {
      sessionExerciseId,
      setNumber,
      weight,
      reps,
      rir,
      completed: input.completed,
    },
    update: { weight, reps, rir, completed: input.completed },
  });

  // Corrections to a completed workout must keep its denormalized volume in sync.
  if (se.session.status === "COMPLETED") {
    const completedSets = await prisma.setLog.findMany({
      where: { sessionExercise: { sessionId: se.sessionId }, completed: true },
      select: { weight: true, reps: true },
    });
    await prisma.workoutSession.update({
      where: { id: se.sessionId },
      data: {
        totalVolume: completedSets.reduce(
          (sum, s) => sum + s.weight * s.reps,
          0,
        ),
      },
    });
    await prisma.coachBrief.deleteMany({ where: { sessionId: se.sessionId } });
  }

  const fired: FiredPr[] = [];
  if (input.completed && !se.session.isDeload) {
    const bests = await currentBests(userId, se.templateExerciseId);
    const detected = detectSetPRs(
      { weight, reps, completed: true },
      bests,
      se.session.isDeload,
    );
    for (const pr of detected) {
      fired.push(
        await persistPr(
          userId,
          pr,
          se.exerciseId,
          se.exercise.name,
          se.templateExerciseId,
          se.session.date,
          setLog.id,
        ),
      );
    }
  }

  revalidateWorkoutPaths(se.sessionId);
  return { ok: true, setId: setLog.id, prs: fired };
}

async function currentBests(
  userId: string,
  templateExerciseId: string,
): Promise<CurrentBests> {
  const [heaviest, e1rm, reps, volume] = await Promise.all([
    prisma.personalRecord.findFirst({
      where: { userId, templateExerciseId, type: "HEAVIEST_WEIGHT" },
      orderBy: { value: "desc" },
    }),
    prisma.personalRecord.findFirst({
      where: { userId, templateExerciseId, type: "BEST_E1RM" },
      orderBy: { value: "desc" },
    }),
    prisma.personalRecord.findFirst({
      where: { userId, templateExerciseId, type: "MOST_REPS" },
      orderBy: { value: "desc" },
    }),
    prisma.personalRecord.findFirst({
      where: { userId, templateExerciseId, type: "MOST_SESSION_VOLUME" },
      orderBy: { value: "desc" },
    }),
  ]);
  return {
    heaviestWeight: heaviest?.value ?? null,
    bestE1rm: e1rm?.value ?? null,
    mostReps: reps ? { reps: reps.value, weight: reps.weight ?? 0 } : null,
    mostSessionVolume: volume?.value ?? null,
  };
}

function fmtPrValue(pr: DetectedPr): string {
  if (pr.type === "MOST_REPS") return `${Math.round(pr.value)} reps`;
  return `${Math.round(pr.value).toLocaleString("en-US")} lb`;
}

async function persistPr(
  userId: string,
  pr: DetectedPr,
  exerciseId: string,
  exerciseName: string,
  templateExerciseId: string,
  date: string,
  setLogId: string | null,
): Promise<FiredPr> {
  // Re-saving the same set updates its existing PR row instead of duplicating.
  const existing = setLogId
    ? await prisma.personalRecord.findFirst({
        where: { userId, setLogId, type: pr.type },
      })
    : null;
  const row = existing
    ? await prisma.personalRecord.update({
        where: { id: existing.id },
        data: {
          value: pr.value,
          weight: pr.weight ?? null,
          reps: pr.reps ?? null,
          date,
        },
      })
    : await prisma.personalRecord.create({
        data: {
          userId,
          exerciseId,
          templateExerciseId,
          type: pr.type,
          value: pr.value,
          weight: pr.weight ?? null,
          reps: pr.reps ?? null,
          date,
          setLogId,
        },
      });

  if (NOTIFICATIONS_ENABLED) {
    const candidate = prAchievedNotification(userId, {
      exerciseName,
      prLabel: PR_TYPE_LABELS[pr.type],
      value: fmtPrValue(pr),
      personalRecordId: row.id,
    });
    const existingNotification = await prisma.notification.findUnique({
      where: { userId_dedupeKey: { userId, dedupeKey: candidate.dedupeKey } },
    });
    if (existingNotification) {
      await prisma.notification.update({
        where: { id: existingNotification.id },
        data: { title: candidate.title, body: candidate.body },
      });
    } else {
      await prisma.notification.create({
        data: {
          userId,
          type: candidate.type,
          title: candidate.title,
          body: candidate.body,
          href: candidate.href,
          dedupeKey: candidate.dedupeKey,
        },
      });
    }
  }

  return {
    type: pr.type,
    label: PR_TYPE_LABELS[pr.type],
    display: fmtPrValue(pr),
  };
}

// ---------------------------------------------------------------------------
// finishWorkout — totals, session-volume PRs, mark COMPLETED
// ---------------------------------------------------------------------------

export interface FinishResult {
  ok: boolean;
  prs: FiredPr[];
  error?: string;
}

export async function finishWorkout(sessionId: string): Promise<FinishResult> {
  const userId = await requireUserId();
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: { exercises: { include: { exercise: true, sets: true } } },
  });
  if (!session || session.userId !== userId)
    return { ok: false, prs: [], error: "Session not found" };

  let totalVolume = 0;
  const fired: FiredPr[] = [];

  for (const ex of session.exercises) {
    const done = ex.sets.filter((s) => s.completed);
    const exVolume = done.reduce((n, s) => n + s.weight * s.reps, 0);
    totalVolume += exVolume;

    if (!session.isDeload && exVolume > 0) {
      const bests = await currentBests(userId, ex.templateExerciseId);
      const pr = detectSessionVolumePR(exVolume, bests, session.isDeload);
      if (pr) {
        fired.push(
          await persistPr(
            userId,
            pr,
            ex.exerciseId,
            ex.exercise.name,
            ex.templateExerciseId,
            session.date,
            null,
          ),
        );
      }
    }
  }

  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      completedAt: session.completedAt ?? new Date(),
      startedAt: session.startedAt ?? new Date(),
      totalVolume,
    },
  });

  // Best-effort push with the session's meaningful e1RM PRs (never throws).
  await sendSessionPrPush(userId, sessionId);

  revalidateWorkoutPaths(sessionId);
  return { ok: true, prs: fired };
}

// ---------------------------------------------------------------------------
// substituteExercise — swap the slot's exercise, keep progression lineage
// ---------------------------------------------------------------------------

export async function substituteExercise(input: {
  sessionExerciseId: string;
  newExerciseId: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const { sessionExerciseId, newExerciseId } = input;
  if (!sessionExerciseId || !newExerciseId)
    return { ok: false, error: "Invalid substitution" };

  const se = await prisma.sessionExercise.findUnique({
    where: { id: sessionExerciseId },
    include: { session: true },
  });
  if (!se || se.session.userId !== userId)
    return { ok: false, error: "Exercise not found" };
  if (!(await isOwnedSlot(userId, se.templateExerciseId))) {
    return { ok: false, error: "Program slot not found" };
  }
  if (se.exerciseId === newExerciseId) return { ok: true };

  if (!(await isVisibleExercise(userId, newExerciseId)))
    return { ok: false, error: "Replacement exercise not found" };

  await prisma.$transaction([
    // The slot keeps its id → progression history continues unbroken.
    prisma.templateExercise.update({
      where: { id: se.templateExerciseId },
      data: { exerciseId: newExerciseId },
    }),
    prisma.sessionExercise.update({
      where: { id: sessionExerciseId },
      data: { exerciseId: newExerciseId },
    }),
    prisma.substitutionEvent.create({
      data: {
        userId,
        templateExerciseId: se.templateExerciseId,
        oldExerciseId: se.exerciseId,
        newExerciseId,
        reason: input.reason?.slice(0, 500) || null,
        date: se.session.date,
      },
    }),
  ]);

  revalidateWorkoutPaths(se.sessionId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// notes + cancel
// ---------------------------------------------------------------------------

export async function updateExerciseNotes(
  sessionExerciseId: string,
  notes: string,
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const se = await prisma.sessionExercise.findUnique({
    where: { id: sessionExerciseId },
    include: { session: { select: { userId: true } } },
  });
  if (!se || se.session.userId !== userId) return { ok: false };
  await prisma.sessionExercise.update({
    where: { id: sessionExerciseId },
    data: { notes: notes.slice(0, 1000) || null },
  });
  revalidatePath(`/workout/${se.sessionId}`);
  return { ok: true };
}

/** Cancel an in-progress session: deletes it (sets cascade). */
export async function cancelWorkout(sessionId: string): Promise<void> {
  const userId = await requireUserId();
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
  });
  if (session && session.userId === userId && session.status !== "COMPLETED") {
    await prisma.workoutSession.deleteMany({
      where: { id: sessionId, userId },
    });
  }
  revalidateWorkoutPaths();
  redirect("/workout");
}
