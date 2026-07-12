/**
 * lib/push/events.ts — event-driven pushes (always on, no settings toggle):
 * meaningful e1RM PRs after a finished session, and wearable-reconnect
 * alerts when a token refresh dies. Best-effort: never throws.
 */
import { prisma } from "@/lib/db";
import { deliverPush } from "@/lib/push/deliver";

/** An exercise needs this many earlier training days before its PRs count
 * (same cold-start gate as the dashboard's PRs tile). */
const MIN_PR_HISTORY_DAYS = 3;

/**
 * After a session completes: push one summary of the e1RM PRs it produced,
 * counting only exercises with ≥ MIN_PR_HISTORY_DAYS earlier training days.
 */
export async function sendSessionPrPush(userId: string, sessionId: string): Promise<void> {
  try {
    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      select: {
        date: true,
        exercises: { select: { exerciseId: true, sets: { select: { id: true } } } },
      },
    });
    if (!session) return;

    const setLogIds = session.exercises.flatMap((ex) => ex.sets.map((s) => s.id));
    if (setLogIds.length === 0) return;

    const prs = await prisma.personalRecord.findMany({
      where: { userId, type: "BEST_E1RM", setLogId: { in: setLogIds } },
      select: { exerciseId: true, value: true, exercise: { select: { name: true } } },
    });
    if (prs.length === 0) return;

    // Cold-start gate: count distinct earlier training days per exercise.
    const exerciseIds = [...new Set(prs.map((p) => p.exerciseId))];
    const priorSets = await prisma.setLog.findMany({
      where: {
        completed: true,
        sessionExercise: {
          exerciseId: { in: exerciseIds },
          session: { userId, status: "COMPLETED", date: { lt: session.date } },
        },
      },
      select: {
        sessionExercise: { select: { exerciseId: true, session: { select: { date: true } } } },
      },
    });
    const daysByExercise = new Map<string, Set<string>>();
    for (const log of priorSets) {
      const { exerciseId, session: s } = log.sessionExercise;
      (daysByExercise.get(exerciseId) ?? daysByExercise.set(exerciseId, new Set()).get(exerciseId)!).add(
        s.date,
      );
    }

    const meaningful = prs.filter(
      (pr) => (daysByExercise.get(pr.exerciseId)?.size ?? 0) >= MIN_PR_HISTORY_DAYS,
    );
    if (meaningful.length === 0) return;

    const lines = meaningful.map((pr) => `${pr.exercise.name} ${Math.round(pr.value)} lb`);
    await deliverPush(userId, `PR_PUSH:${sessionId}`, {
      title: meaningful.length === 1 ? "e1RM PR 🎉" : `${meaningful.length} e1RM PRs 🎉`,
      body: lines.join(" · "),
      href: "/records",
    });
  } catch (err) {
    console.error("[push] session PR push failed", err);
  }
}

/**
 * Wearable token refresh failed — the user must reconnect. Keyed by the
 * connection's frozen expiresAt so each incident notifies exactly once
 * (a successful reconnect writes a new expiresAt).
 */
export async function sendReauthPush(
  userId: string,
  provider: "whoop" | "fitbit",
  incidentKey: string,
): Promise<void> {
  const name = provider === "whoop" ? "WHOOP" : "Fitbit";
  await deliverPush(userId, `REAUTH:${provider}:${incidentKey}`, {
    title: `${name} needs reconnecting`,
    body: `Syncing stopped — authorization expired. Reconnect in Settings to keep your ${name} data flowing.`,
    href: "/settings",
  });
}
