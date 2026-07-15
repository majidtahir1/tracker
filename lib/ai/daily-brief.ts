/**
 * lib/ai/daily-brief.ts — the morning coach brief, shown at the start of each
 * physiological day (current WHOOP cycle; calendar-day fallback) until a
 * workout is completed, when the post-workout reflection takes over.
 * MiniMax-generated when a key is configured (cached per day), else a
 * deterministic composition that is recomputed on every load so it picks up
 * late-arriving WHOOP syncs.
 */
import { prisma } from "@/lib/db";
import { addDays, fmtDisplay, type LocalDate } from "@/lib/dates";
import { recoveryBand, type RecoveryBand } from "@/lib/recovery";
import { isDeloadWeek, nextTemplateIndex, weekInCycle } from "@/lib/schedule";
import { getWhoopDayContext } from "@/lib/queries/effective-recovery";
import { callMiniMax, clip, type CoachBriefData } from "./dashboard-coach";

const DAILY_BRIEF_SYSTEM_PROMPT =
  "You are a direct, observant hypertrophy coach greeting an athlete at the start of their day. Using only the supplied facts: if a \"firstDay\" field is present, welcome them to their first day — no recap of yesterday, no talk of rest days or missing data; point them at today's workout and how to pick starting weights. Otherwise acknowledge yesterday (workout recap or rest). If a \"whoop\" block is present, read recovery and sleep conservatively (recovery below 40 or heavy sleep debt means advise backing off intensity today; 40-69 means manage load; 70+ is a green light); if there is no whoop block, never mention WHOOP, recovery scores, sleep, or syncing — the athlete does not track these. Tell them what's on tap today (the named workout, or rest). Close with genuine motivation — a short apt quote is welcome when recovery is decent, never when advising rest. No hype, no invented data, no medical advice. Return only JSON: {\"headline\":string,\"message\":string,\"encouragement\":string}. Keep the visible response under 80 words.";

/** Short, non-cheesy training quotes for the deterministic path. */
const QUOTES = [
  "“We are what we repeatedly do. Excellence, then, is not an act, but a habit.”",
  "“The last three or four reps is what makes the muscle grow.” — Arnold",
  "“A year from now you may wish you had started today.”",
  "“Discipline is choosing between what you want now and what you want most.”",
  "“Strength does not come from winning. Your struggles develop your strengths.”",
  "“The only bad workout is the one that didn't happen.”",
  "“Small daily improvements are the key to staggering long-term results.”",
  "“You don't have to be extreme, just consistent.”",
];

export function pickQuote(dayKey: string): string {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) hash = (hash * 31 + dayKey.charCodeAt(i)) | 0;
  return QUOTES[Math.abs(hash) % QUOTES.length];
}

export interface DailyBriefInputs {
  date: LocalDate;
  dayKey: string;
  recoveryScore: number | null;
  sleepHours: number | null;
  sleepPerformancePct: number | null;
  yesterday: {
    workoutName: string;
    totalSets: number;
    totalVolume: number;
    prCount: number;
  } | null;
  todayWorkout: { name: string; inProgress: boolean } | null;
  isDeloadWeek: boolean;
  /** Any completed session ever — false means a brand-new user. */
  hasHistory: boolean;
  /** WHOOP integration exists; unconnected users never hear about recovery data. */
  whoopConnected: boolean;
}

/** Pure composition — exported for tests. */
export function composeDailyBrief(inputs: DailyBriefInputs): CoachBriefData {
  // Brand-new user: welcome them. There is no yesterday and no baseline —
  // recapping "rest" or missing WHOOP data would be inventing a past.
  if (!inputs.hasHistory && !inputs.yesterday) {
    const message = inputs.todayWorkout
      ? `Your program starts with ${inputs.todayWorkout.name}. Weight targets appear once you've logged a session — today is about finding working weights: pick a load you could lift for about two more reps at the top of each range.`
      : "Pick a program to get rolling — keep the built-in starter, build one with the AI coach, or make your own under Programs. Your first workout appears here the moment one is active.";
    return {
      headline: clip("Welcome — day one starts now", 100),
      message: clip(message, 600),
      encouragement: clip("Every number you log today is a baseline you'll beat.", 220),
      source: "deterministic",
    };
  }

  const band: RecoveryBand | null =
    inputs.whoopConnected && inputs.recoveryScore != null
      ? recoveryBand(inputs.recoveryScore)
      : null;

  const headline =
    band === "fatigued"
      ? "Recovery is low — take it easy today"
      : inputs.todayWorkout
        ? band === "recovered"
          ? `Green light: ${inputs.todayWorkout.name} today`
          : `On tap today: ${inputs.todayWorkout.name}`
        : "Rest day — recover on purpose";

  const parts: string[] = [];
  if (inputs.yesterday) {
    const y = inputs.yesterday;
    parts.push(
      `Yesterday you finished ${y.workoutName} — ${y.totalSets} sets, ${Math.round(y.totalVolume).toLocaleString("en-US")} lb` +
        (y.prCount > 0 ? ` and ${y.prCount} PR${y.prCount === 1 ? "" : "s"}.` : "."),
    );
  } else {
    parts.push("Yesterday was a rest day.");
  }
  if (inputs.whoopConnected) {
    if (inputs.recoveryScore != null) {
      const sleepBit =
        inputs.sleepHours != null
          ? ` on ${inputs.sleepHours}h of sleep${inputs.sleepPerformancePct != null ? ` (${inputs.sleepPerformancePct}%)` : ""}`
          : "";
      parts.push(`WHOOP has you at ${inputs.recoveryScore}% recovered${sleepBit}.`);
    } else if (inputs.sleepHours != null) {
      parts.push(`You slept ${inputs.sleepHours}h.`);
    }
  }
  if (inputs.todayWorkout) {
    parts.push(
      inputs.todayWorkout.inProgress
        ? `${inputs.todayWorkout.name} is already underway — go close it out.`
        : band === "fatigued"
          ? `${inputs.todayWorkout.name} is scheduled${inputs.isDeloadWeek ? " (deload week)" : ""} — keep the weights honest and stop sets further from failure.`
          : `${inputs.todayWorkout.name} is on the schedule${inputs.isDeloadWeek ? " — deload week, lighter by design" : ""}.`,
    );
  } else {
    parts.push("Nothing scheduled — sleep, protein, and a walk are the workout today.");
  }

  const encouragement =
    band === "fatigued"
      ? "Backing off today is how you show up stronger tomorrow."
      : pickQuote(inputs.dayKey);

  return {
    headline: clip(headline, 100),
    message: clip(parts.join(" "), 600),
    encouragement: clip(encouragement, 220),
    source: "deterministic",
  };
}

/** Today's planned session: existing session first, else next template in rotation. */
async function resolveTodayWorkout(
  userId: string,
  today: LocalDate,
): Promise<{ name: string; inProgress: boolean; completed: boolean } | null> {
  const existing = await prisma.workoutSession.findFirst({
    where: { userId, date: today },
    include: { template: { select: { name: true } } },
    orderBy: { startedAt: "desc" },
  });
  if (existing) {
    return {
      name: existing.template.name,
      inProgress: existing.status === "IN_PROGRESS",
      completed: existing.status === "COMPLETED",
    };
  }
  const settings = await prisma.appSettings.findUnique({ where: { userId } });
  if (!settings?.activeProgramId) return null;
  const templates = await prisma.workoutTemplate.findMany({
    where: { programId: settings.activeProgramId, isActive: true, program: { ownerId: userId } },
    orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }],
    select: { id: true, name: true },
  });
  if (templates.length === 0) return null;
  const lastCompleted = await prisma.workoutSession.findFirst({
    where: { userId, status: "COMPLETED", template: { programId: settings.activeProgramId } },
    orderBy: [{ date: "desc" }, { completedAt: "desc" }],
    select: { templateId: true },
  });
  const next = templates[nextTemplateIndex(templates, lastCompleted?.templateId)];
  return { name: next.name, inProgress: false, completed: false };
}

/** The current physiological day's cache key. */
async function resolveDayKey(userId: string, today: LocalDate): Promise<string> {
  const currentCycle = await prisma.whoopCycle.findFirst({
    where: { userId },
    orderBy: { start: "desc" },
    select: { id: true, date: true },
  });
  // Only trust the cycle when it's recent; a stale sync falls back to the calendar day.
  if (currentCycle && currentCycle.date >= addDays(today, -1)) return `cycle:${currentCycle.id}`;
  return today;
}

export async function buildDailyBrief(userId: string, today: LocalDate): Promise<CoachBriefData> {
  const dayKey = await resolveDayKey(userId, today);

  const cached = await prisma.dailyBrief.findUnique({
    where: { userId_dayKey: { userId, dayKey } },
  });
  if (cached) {
    return {
      headline: cached.headline,
      message: cached.message,
      encouragement: cached.encouragement,
      source: cached.source === "minimax" ? "minimax" : "deterministic",
    };
  }

  const yesterday = addDays(today, -1);
  const [whoopDay, yesterdaySession, todayWorkout, block, whoopConnection, completedCount] =
    await Promise.all([
      getWhoopDayContext(userId, today),
      prisma.workoutSession.findFirst({
        where: { userId, status: "COMPLETED", date: yesterday },
        include: {
          template: { select: { name: true } },
          exercises: { include: { sets: { where: { completed: true }, select: { id: true } } } },
        },
        orderBy: { completedAt: "desc" },
      }),
      resolveTodayWorkout(userId, today),
      prisma.trainingBlock.findFirst({ where: { userId }, orderBy: { cycleNumber: "desc" } }),
      prisma.whoopConnection.findUnique({ where: { userId }, select: { id: true } }),
      prisma.workoutSession.count({ where: { userId, status: "COMPLETED" } }),
    ]);
  const whoopConnected = whoopConnection != null;
  const hasHistory = completedCount > 0;

  const [prCount, deload] = await Promise.all([
    yesterdaySession
      ? prisma.personalRecord.count({ where: { userId, date: yesterday } })
      : Promise.resolve(0),
    Promise.resolve(block ? isDeloadWeek(weekInCycle(block, today)) : false),
  ]);

  const inputs: DailyBriefInputs = {
    date: today,
    dayKey,
    recoveryScore: whoopDay.recovery?.score ?? null,
    sleepHours: whoopDay.sleep?.hours ?? null,
    sleepPerformancePct: whoopDay.sleep?.performancePct ?? null,
    yesterday: yesterdaySession
      ? {
          workoutName: yesterdaySession.template.name,
          totalSets: yesterdaySession.exercises.reduce((n, ex) => n + ex.sets.length, 0),
          totalVolume: yesterdaySession.totalVolume,
          prCount,
        }
      : null,
    todayWorkout: todayWorkout && !todayWorkout.completed ? todayWorkout : null,
    isDeloadWeek: deload,
    hasHistory,
    whoopConnected,
  };

  const context = {
    date: fmtDisplay(today),
    // Omitted entirely for unconnected users — the coach must never mention
    // WHOOP, recovery, or sleep data the athlete doesn't track.
    ...(whoopConnected
      ? {
          whoop: {
            recoveryScore: inputs.recoveryScore,
            sleepHours: inputs.sleepHours,
            sleepPerformancePct: inputs.sleepPerformancePct,
            sleepDebtHours: whoopDay.sleep?.debtHours ?? null,
            yesterdayStrain: whoopDay.yesterdayStrain,
          },
        }
      : {}),
    ...(hasHistory
      ? { yesterday: inputs.yesterday ?? "rest day" }
      : { firstDay: "This athlete has never logged a workout — welcome them to day one." }),
    today: inputs.todayWorkout
      ? { workout: inputs.todayWorkout.name, isDeloadWeek: inputs.isDeloadWeek }
      : "rest day",
  };
  const generated = await callMiniMax(context, DAILY_BRIEF_SYSTEM_PROMPT);
  if (generated) {
    await prisma.dailyBrief.upsert({
      where: { userId_dayKey: { userId, dayKey } },
      update: { ...generated },
      create: { userId, dayKey, ...generated },
    });
    return generated;
  }
  return composeDailyBrief(inputs);
}
