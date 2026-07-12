/**
 * lib/notifications.ts — notification generation RULES (ARCHITECTURE.md §5).
 * Pure candidate builders; a server action/query layer persists them with
 * `prisma.notification.upsert({ where: { dedupeKey } })` so generation is
 * idempotent. PR_ACHIEVED / FATIGUE_WARNING are emitted inline by pr.ts /
 * recovery save, using the same candidate shape.
 */
import type { NotificationType } from "@/lib/generated/prisma/enums";
import { monthKey, type LocalDate } from "@/lib/dates";

/**
 * Global kill switch (2026-07-10): in-app notifications are disabled and
 * hidden until the iOS app lands with real push support. Generators and the
 * dashboard honor this flag; existing rows are kept but never shown.
 */
export const NOTIFICATIONS_ENABLED = false;

export interface NotificationCandidate {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  dedupeKey: string;
}

/** Rule 1 — PROGRESSION: a slot's next recommendation is INCREASE. */
export function progressionNotification(
  userId: string,
  args: {
    templateExerciseId: string;
    exerciseName: string;
    newWeight: number;
    nextSessionDate: LocalDate;
  }
): NotificationCandidate {
  return {
    userId,
    type: "PROGRESSION",
    title: `Increase ${args.exerciseName} next workout`,
    body: `All sets hit the top of the range. Load ${args.newWeight} lb next session.`,
    href: "/workout",
    dedupeKey: `PROGRESSION:${args.templateExerciseId}:${args.nextSessionDate}`,
  };
}

/** Rule 2 — deload notices, keyed by block + week. */
export function deloadUpcomingNotification(userId: string, blockId: string): NotificationCandidate {
  return {
    userId,
    type: "DELOAD_UPCOMING",
    title: "Deload starts next week",
    body: "Week 13: half the sets at ~82.5% of working weight. No failure.",
    href: "/",
    dedupeKey: `DELOAD_UPCOMING:${blockId}:12`,
  };
}

export function deloadActiveNotification(userId: string, blockId: string): NotificationCandidate {
  return {
    userId,
    type: "DELOAD_ACTIVE",
    title: "Deload week",
    body: "Recover hard: reduced sets and load all week.",
    href: "/",
    dedupeKey: `DELOAD_ACTIVE:${blockId}:13`,
  };
}

/** Rule 3 — monthly photo/measurement reminders (no entry yet this month). */
export function photoReminderNotification(userId: string, today: LocalDate): NotificationCandidate {
  return {
    userId,
    type: "PHOTO_REMINDER",
    title: "Monthly progress photos due",
    body: "Front, side, and back — same lighting, same time of day.",
    href: "/photos",
    dedupeKey: `PHOTO_REMINDER:${monthKey(today)}`,
  };
}

export function measurementReminderNotification(userId: string, today: LocalDate): NotificationCandidate {
  return {
    userId,
    type: "MEASUREMENT_REMINDER",
    title: "Monthly measurements due",
    body: "Log body weight and girths to keep trend lines honest.",
    href: "/measurements",
    dedupeKey: `MEASUREMENT_REMINDER:${monthKey(today)}`,
  };
}

/** Rule 4 — nutrition nudge after 8 PM when protein is unlogged. */
export function nutritionReminderNotification(userId: string, today: LocalDate): NotificationCandidate {
  return {
    userId,
    type: "NUTRITION_REMINDER",
    title: "Protein not logged today",
    body: "Log today's intake before bed.",
    href: "/nutrition",
    dedupeKey: `NUTRITION:${today}`,
  };
}

/** Rule 5a — emitted inline by PR detection. */
export function prAchievedNotification(
  userId: string,
  args: {
    exerciseName: string;
    prLabel: string; // e.g. "PR · e1RM"
    value: string; // pre-formatted, e.g. "231 lb"
    personalRecordId: string;
  }
): NotificationCandidate {
  return {
    userId,
    type: "PR_ACHIEVED",
    title: `${args.prLabel} — ${args.exerciseName}`,
    body: `New best: ${args.value}.`,
    href: "/records",
    dedupeKey: `PR_ACHIEVED:${args.personalRecordId}`,
  };
}

/** Rule 5b — emitted inline when a saved recovery score is < 40. */
export function fatigueWarningNotification(userId: string, date: LocalDate, score: number): NotificationCandidate {
  return {
    userId,
    type: "FATIGUE_WARNING",
    title: "Recovery is low",
    body: `Score ${score}/100. Today's recommendations were reduced — consider lighter loads.`,
    href: "/recovery",
    dedupeKey: `FATIGUE_WARNING:${date}`,
  };
}

/**
 * Convenience: evaluate the schedule-driven rules (2–4) in one pass.
 * Callers supply current state; returns only the candidates that apply.
 */
export function scheduleNotifications(
  userId: string,
  args: {
    today: LocalDate;
    blockId: string;
    weekInCycle: number;
    isAfter8pm: boolean;
    proteinLoggedToday: boolean;
    photoLoggedThisMonth: boolean;
    measurementLoggedThisMonth: boolean;
    photoReminderDay: number;
    measurementReminderDay: number;
  }
): NotificationCandidate[] {
  const out: NotificationCandidate[] = [];
  const dayOfMonth = Number(args.today.slice(8, 10));

  if (args.weekInCycle === 12) out.push(deloadUpcomingNotification(userId, args.blockId));
  if (args.weekInCycle === 13) out.push(deloadActiveNotification(userId, args.blockId));
  if (dayOfMonth >= args.photoReminderDay && !args.photoLoggedThisMonth) {
    out.push(photoReminderNotification(userId, args.today));
  }
  if (dayOfMonth >= args.measurementReminderDay && !args.measurementLoggedThisMonth) {
    out.push(measurementReminderNotification(userId, args.today));
  }
  if (args.isAfter8pm && !args.proteinLoggedToday) {
    out.push(nutritionReminderNotification(userId, args.today));
  }
  return out;
}
