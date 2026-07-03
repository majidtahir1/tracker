/**
 * lib/dates.ts — the ONLY module that touches `Date` (ARCHITECTURE.md §7).
 * Calendar dates are local "YYYY-MM-DD" strings everywhere else.
 * Week starts Monday (ISO) everywhere.
 */

export type LocalDate = string; // "YYYY-MM-DD"

/** Format a JS Date as local YYYY-MM-DD. */
export function fmtLocalDate(d: Date): LocalDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today as local YYYY-MM-DD. */
export function localToday(): LocalDate {
  return fmtLocalDate(new Date());
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
export function parseLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** ISO day of week: 1 = Monday .. 7 = Sunday. */
export function isoDayOfWeek(date: LocalDate): number {
  const dow = parseLocalDate(date).getDay();
  return dow === 0 ? 7 : dow;
}

/** Monday of the ISO week containing `date`, as YYYY-MM-DD. */
export function isoWeekMonday(date: LocalDate): LocalDate {
  return addDays(date, -(isoDayOfWeek(date) - 1));
}

/** Add (or subtract) whole days. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return fmtLocalDate(d);
}

/** Whole-day difference: `b - a` in days (positive when b is after a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const MS_PER_DAY = 86_400_000;
  // Local-midnight based; DST shifts are < 1 day so rounding is safe.
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / MS_PER_DAY);
}

/** "2026-07" style month key, for monthly reminders/grouping. */
export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

/** Human display, e.g. "Mon, Jun 29". */
export function fmtDisplay(date: LocalDate): string {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
