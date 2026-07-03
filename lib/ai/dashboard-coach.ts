import { prisma } from "@/lib/db";
import { localToday } from "@/lib/dates";
import { getWhoopDayContext, toCoachWhoopContext } from "@/lib/queries/effective-recovery";

export interface CoachBriefData {
  headline: string;
  message: string;
  encouragement: string;
  source: "minimax" | "deterministic";
}

function parseBrief(content: string): CoachBriefData | null {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const value = JSON.parse(match[0]) as Record<string, unknown>;
    if (!["headline", "message", "encouragement"].every((k) => typeof value[k] === "string")) return null;
    return { headline: String(value.headline).slice(0, 100), message: String(value.message).slice(0, 320), encouragement: String(value.encouragement).slice(0, 180), source: "minimax" };
  } catch { return null; }
}

async function callMiniMax(context: unknown): Promise<CoachBriefData | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(process.env.MINIMAX_API_URL ?? "https://api.minimax.io/v1/text/chatcompletion_v2", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.MINIMAX_MODEL ?? "MiniMax-M3",
        messages: [
          { role: "system", name: "Coach", content: "You are a direct, observant hypertrophy coach. Review only the supplied completed-workout facts. Mention one specific positive, one useful observation, and the next focus. Be encouraging without hype or generic praise. If a \"whoop\" block is present, read it conservatively: low recovery (below 40), high sleep debt, or high yesterday strain (above 14) mean the next focus should lean toward maintaining rather than pushing load; never let WHOOP data override the logged workout facts. Never invent data or give medical advice. Return only JSON: {\"headline\":string,\"message\":string,\"encouragement\":string}. Keep the visible response under 70 words." },
          { role: "user", name: "athlete", content: JSON.stringify(context) },
        ],
        max_completion_tokens: 1200, temperature: 1, top_p: 0.95,
      }),
    });
    if (!response.ok) return null;
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return parseBrief(body.choices?.[0]?.message?.content ?? "");
  } catch { return null; } finally { clearTimeout(timeout); }
}

export async function buildLatestCoachBrief(): Promise<{ sessionId: string; brief: CoachBriefData } | null> {
  const session = await prisma.workoutSession.findFirst({
    where: { status: "COMPLETED" }, orderBy: [{ date: "desc" }, { completedAt: "desc" }],
    include: { template: true, exercises: { orderBy: { sortOrder: "asc" }, include: { exercise: true, sets: { where: { completed: true } } } } },
  });
  if (!session) return null;
  const cached = await prisma.coachBrief.findUnique({ where: { sessionId: session.id } });
  if (cached) return { sessionId: session.id, brief: { headline: cached.headline, message: cached.message, encouragement: cached.encouragement, source: cached.source === "minimax" ? "minimax" : "deterministic" } };
  const setCount = session.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const [prExercises, priorWorkoutCount, whoopDay] = await Promise.all([
    prisma.personalRecord.findMany({ where: { date: session.date }, distinct: ["exerciseId"], select: { exerciseId: true } }),
    prisma.workoutSession.count({ where: { status: "COMPLETED", date: { lt: session.date } } }),
    getWhoopDayContext(localToday()),
  ]);
  const whoop = toCoachWhoopContext(whoopDay);
  const context = {
    workout: session.template.name, date: session.date, totalSets: setCount,
    totalVolume: Math.round(session.totalVolume), isDeload: session.isDeload, prExerciseCount: prExercises.length, isFirstWorkout: priorWorkoutCount === 0,
    exercises: session.exercises.map((ex) => ({ name: ex.exercise.name, sets: ex.sets.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir })) })),
    ...(whoop ? { whoop } : {}),
  };
  const generated = await callMiniMax(context);
  const brief: CoachBriefData = generated ?? {
    headline: `${session.template.name} complete`,
    message: `You logged ${setCount} working sets and ${Math.round(session.totalVolume).toLocaleString("en-US")} lb of volume${priorWorkoutCount === 0 ? `, establishing baselines across ${session.exercises.length} exercises` : prExercises.length > 0 ? ` with new records across ${prExercises.length} exercise${prExercises.length === 1 ? "" : "s"}` : ""}. Review the hardest sets honestly and carry that information into the next session.`,
    encouragement: "The work is recorded. Recover well, then build on it.", source: "deterministic",
  };
  if (generated) await prisma.coachBrief.create({ data: { sessionId: session.id, ...generated } });
  return { sessionId: session.id, brief };
}
