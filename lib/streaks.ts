/**
 * lib/streaks.ts — consistency & streaks (ARCHITECTURE.md §5). Pure.
 */
import type { SessionStatus } from "@/lib/generated/prisma/enums";
import { addDays, type LocalDate } from "@/lib/dates";

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
 * Streak of complete weeks from completed-session dates. Weeks run from the
 * block start to `currentWeekStart` inclusive; the in-progress week joins the
 * streak as soon as it hits the session target — "0 wks" after training 4×
 * this week reads as broken. (Same semantics as the dashboard stat.)
 */
export function streakFromCompletedDates(
  blockStart: LocalDate,
  completedDates: LocalDate[],
  currentWeekStart: LocalDate,
): number {
  const weeks: WeekSessions[] = [];
  for (let ws = blockStart; ws <= currentWeekStart; ws = addDays(ws, 7)) {
    const weekEnd = addDays(ws, 6);
    const week: WeekSessions = {
      weekStart: ws,
      sessions: completedDates
        .filter((date) => date >= ws && date <= weekEnd)
        .map(() => ({ status: "COMPLETED" as const })),
    };
    if (ws < currentWeekStart || weekComplete(week)) weeks.push(week);
  }
  return consecutiveWeeks(weeks);
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
