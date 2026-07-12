/**
 * lib/push/scheduled.ts — scheduled push notifications, run by the cron
 * route (app/api/cron/notify). Everything is idempotent via deliverPush's
 * PushSent ledger, so overlapping or repeated cron runs are safe.
 *
 * Pushes:
 *  - Morning brief (daily): recovery + today's workout, from the daily brief.
 *  - Streak saver (Sunday): one session short of the weekly target.
 *  - Deload notices (daily check): week-12 heads-up, week-13 active.
 */
import { prisma } from "@/lib/db";
import { isoDayOfWeek, isoWeekMonday, localToday } from "@/lib/dates";
import { blockPosition } from "@/lib/schedule";
import { SESSIONS_PER_WEEK } from "@/lib/streaks";
import { buildDailyBrief } from "@/lib/ai/daily-brief";
import { deloadActiveNotification, deloadUpcomingNotification } from "@/lib/notifications";
import { deliverPush } from "@/lib/push/deliver";

export interface ScheduledPushResult {
  users: number;
  sent: { brief: number; streak: number; deload: number };
}

/** Truncate push body text to keep the banner readable. */
function clipBody(text: string, max = 170): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function runScheduledPushes(): Promise<ScheduledPushResult> {
  const today = localToday();
  const result: ScheduledPushResult = { users: 0, sent: { brief: 0, streak: 0, deload: 0 } };

  // Only users with a registered device can receive anything.
  const users = await prisma.user.findMany({
    where: { pushTokens: { some: {} } },
    select: { id: true, appSettings: { select: { notifyMorningBrief: true, notifyStreakSaver: true } } },
  });
  result.users = users.length;

  for (const user of users) {
    const prefs = user.appSettings;

    // ----- Morning brief -----
    if (prefs?.notifyMorningBrief ?? true) {
      try {
        const brief = await buildDailyBrief(user.id, today);
        const sent = await deliverPush(user.id, `MORNING_BRIEF:${today}`, {
          title: brief.headline,
          body: clipBody(brief.message),
          href: "/",
        });
        if (sent) result.sent.brief++;
      } catch (err) {
        console.error("[push] morning brief failed", err);
      }
    }

    // ----- Streak saver (Sunday, exactly one session short) -----
    if ((prefs?.notifyStreakSaver ?? true) && isoDayOfWeek(today) === 7) {
      const weekStart = isoWeekMonday(today);
      const doneThisWeek = await prisma.workoutSession.count({
        where: { userId: user.id, status: "COMPLETED", date: { gte: weekStart, lte: today } },
      });
      if (doneThisWeek === SESSIONS_PER_WEEK - 1) {
        const sent = await deliverPush(user.id, `STREAK_SAVER:${weekStart}`, {
          title: "One session keeps the streak alive",
          body: `${doneThisWeek} of ${SESSIONS_PER_WEEK} done this week — today still counts.`,
          href: "/workout",
        });
        if (sent) result.sent.streak++;
      }
    }

    // ----- Deload notices -----
    const block = await prisma.trainingBlock.findFirst({
      where: { userId: user.id },
      orderBy: { cycleNumber: "desc" },
    });
    if (block) {
      const position = blockPosition(block, today);
      const candidate =
        position.week === 12
          ? deloadUpcomingNotification(user.id, block.id)
          : position.week === 13
            ? deloadActiveNotification(user.id, block.id)
            : null;
      if (candidate) {
        const sent = await deliverPush(user.id, candidate.dedupeKey, {
          title: candidate.title,
          body: candidate.body,
          href: candidate.href,
        });
        if (sent) result.sent.deload++;
      }
    }
  }

  return result;
}
