/**
 * lib/streaks.ts — consistency & streaks (ARCHITECTURE.md §5). Pure.
 */
import type { SessionStatus } from "@/lib/generated/prisma/enums";

export interface ScheduledSession {
  status: SessionStatus;
}

export interface WeekSessions {
  /** Monday of the week, YYYY-MM-DD (identifier only). */
  weekStart: string;
  /** Sessions scheduled that week (deload weeks count with halved prescriptions). */
  sessions: ScheduledSession[];
  /** Program schedules 4 sessions/week. */
  scheduledCount?: number;
}

export const SESSIONS_PER_WEEK = 4;

/** A week is complete when all scheduled sessions are COMPLETED. */
export function weekComplete(week: WeekSessions): boolean {
  const scheduled = week.scheduledCount ?? SESSIONS_PER_WEEK;
  const completed = week.sessions.filter((s) => s.status === "COMPLETED").length;
  return completed >= scheduled;
}

/**
 * Streak of complete weeks ending at the last fully elapsed week.
 * `weeks` must be ordered oldest → newest and contain only fully elapsed weeks.
 */
export function consecutiveWeeks(weeks: WeekSessions[]): number {
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weekComplete(weeks[i])) streak++;
    else break;
  }
  return streak;
}

/** Completed / scheduled × 100 across a range (the >90% success metric). */
export function consistencyPct(weeks: WeekSessions[]): number {
  let scheduled = 0;
  let completed = 0;
  for (const week of weeks) {
    scheduled += week.scheduledCount ?? SESSIONS_PER_WEEK;
    completed += week.sessions.filter((s) => s.status === "COMPLETED").length;
  }
  if (scheduled === 0) return 0;
  return (completed / scheduled) * 100;
}
