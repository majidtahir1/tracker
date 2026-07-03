/**
 * lib/queries/calendar.ts — server-only read layer for /calendar.
 * Month grid states per DESIGN.md §3.11, scheduled-vs-actual via lib/schedule.
 */
import { prisma } from "@/lib/db";
import {
  addDays,
  isoDayOfWeek,
  isoWeekMonday,
  localToday,
  monthKey,
  parseLocalDate,
  fmtLocalDate,
  fmtDisplay,
  type LocalDate,
} from "@/lib/dates";
import { weekInCycle, isDeloadWeek, CYCLE_WEEKS } from "@/lib/schedule";

export type DayState = "completed" | "missed" | "rest" | "future" | "in-progress";

export interface CalendarDay {
  date: LocalDate;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  isDeloadWeek: boolean;
  state: DayState;
  /** Scheduled workout name for training days (from the active templates). */
  workoutName: string | null;
  sessionId: string | null;
  photoReminder: boolean;
  measurementReminder: boolean;
  /** WHOOP-detected activities on this day (read-only context). */
  whoopWorkoutCount: number;
}

export interface SelectedDayWhoopWorkout {
  sportName: string;
  durationMin: number;
  strain: number | null; // 1dp
  calories: number | null; // kcal
}

export interface SelectedDayDetail {
  date: LocalDate;
  display: string; // "Mon, Jun 29"
  state: DayState;
  isDeloadWeek: boolean;
  workoutName: string | null;
  session: {
    id: string;
    status: string;
    totalVolume: number;
    setsLogged: number;
    exerciseCount: number;
    prCount: number;
  } | null;
  whoopWorkouts: SelectedDayWhoopWorkout[];
  reminders: string[];
}

export interface CalendarData {
  month: string; // "2026-07"
  monthLabel: string; // "July 2026"
  prevMonth: string;
  nextMonth: string;
  today: LocalDate;
  weeks: CalendarDay[][];
  selected: SelectedDayDetail | null;
  hasAnyCompleted: boolean;
}

/** Clamp/parse a "?month=YYYY-MM" param; falls back to the current month. */
export function parseMonthParam(raw: string | undefined): string {
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  return monthKey(localToday());
}

function monthStart(month: string): LocalDate {
  return `${month}-01`;
}

function monthEnd(month: string): LocalDate {
  const [y, m] = month.split("-").map(Number);
  return fmtLocalDate(new Date(y, m, 0)); // day 0 of next month = last day
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(fmtLocalDate(new Date(y, m - 1 + delta, 1)));
}

export async function getCalendarData(
  month: string,
  selectedDate: LocalDate | null
): Promise<CalendarData> {
  const today = localToday();
  const first = monthStart(month);
  const last = monthEnd(month);
  const gridStart = isoWeekMonday(first);
  const gridEnd = addDays(isoWeekMonday(last), 6);

  const [blocks, sessions, settings, monthMeasurements, monthPhotos, anyCompleted, whoopWorkouts] =
    await Promise.all([
      prisma.trainingBlock.findMany({ orderBy: { startDate: "asc" } }),
      prisma.workoutSession.findMany({
        where: { date: { gte: gridStart, lte: gridEnd } },
        select: { id: true, date: true, status: true, totalVolume: true, template: { select: { name: true } } },
      }),
      prisma.appSettings.findUnique({ where: { id: "singleton" } }),
      prisma.bodyMeasurement.count({ where: { date: { gte: first, lte: last } } }),
      prisma.progressPhoto.count({ where: { date: { gte: first, lte: last } } }),
      prisma.workoutSession.count({ where: { status: "COMPLETED" } }),
      // One batch load for the whole grid; day cells and the detail panel share it.
      prisma.whoopWorkout.findMany({
        where: { date: { gte: gridStart, lte: gridEnd } },
        orderBy: { start: "asc" },
        select: { date: true, sportName: true, start: true, end: true, strain: true, kilojoule: true },
      }),
    ]);

  const sessionByDate = new Map(sessions.map((s) => [s.date, s]));
  const whoopByDate = new Map<LocalDate, typeof whoopWorkouts>();
  for (const w of whoopWorkouts) {
    const arr = whoopByDate.get(w.date) ?? [];
    arr.push(w);
    whoopByDate.set(w.date, arr);
  }
  const photoDay = settings?.photoReminderDay ?? 1;
  const measurementDay = settings?.measurementReminderDay ?? 1;

  /** Deload if the date falls in week 13 of the block covering it. */
  const isDeloadDate = (date: LocalDate): boolean => {
    const block = [...blocks].reverse().find((b) => b.startDate <= date);
    if (!block) return false;
    const week = weekInCycle(block, date);
    return week >= 1 && week <= CYCLE_WEEKS && isDeloadWeek(week);
  };

  const programStart = blocks[0]?.startDate ?? null;

  const buildDay = (date: LocalDate): CalendarDay => {
    const session = sessionByDate.get(date);
    const workoutName = session?.template.name ?? null;
    let state: DayState;
    if (session?.status === "COMPLETED") state = "completed";
    else if (session?.status === "IN_PROGRESS") state = "in-progress";
    else state = "rest";
    return {
      date,
      dayOfMonth: parseLocalDate(date).getDate(),
      inMonth: monthKey(date) === month,
      isToday: date === today,
      isDeloadWeek: isDeloadDate(date),
      state,
      workoutName,
      sessionId: session?.id ?? null,
      photoReminder:
        monthKey(date) === month && parseLocalDate(date).getDate() === photoDay && monthPhotos === 0,
      measurementReminder:
        monthKey(date) === month &&
        parseLocalDate(date).getDate() === measurementDay &&
        monthMeasurements === 0,
      whoopWorkoutCount: whoopByDate.get(date)?.length ?? 0,
    };
  };

  const weeks: CalendarDay[][] = [];
  for (let w = gridStart; w <= gridEnd; w = addDays(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => buildDay(addDays(w, i))));
  }

  // ---------- selected-day detail ----------
  let selected: SelectedDayDetail | null = null;
  if (selectedDate) {
    const day = buildDay(selectedDate);
    const sessionRow = sessionByDate.get(selectedDate)
      ? await prisma.workoutSession.findFirst({
          where: { date: selectedDate },
          include: {
            exercises: { include: { sets: { where: { completed: true }, select: { id: true } } } },
          },
        })
      : null;
    const prCount = sessionRow
      ? await prisma.personalRecord.count({ where: { date: selectedDate } })
      : 0;
    const reminders: string[] = [];
    if (day.photoReminder) reminders.push("Monthly progress photos due");
    if (day.measurementReminder) reminders.push("Monthly measurements due");
    const dayWhoop: SelectedDayWhoopWorkout[] = (whoopByDate.get(selectedDate) ?? []).map((w) => ({
      sportName: w.sportName,
      durationMin: Math.max(1, Math.round((w.end.getTime() - w.start.getTime()) / 60000)),
      strain: w.strain != null ? Math.round(w.strain * 10) / 10 : null,
      calories: w.kilojoule != null ? Math.round(w.kilojoule / 4.184) : null,
    }));
    selected = {
      date: selectedDate,
      display: fmtDisplay(selectedDate),
      state: day.state,
      isDeloadWeek: day.isDeloadWeek,
      workoutName: day.workoutName,
      session: sessionRow
        ? {
            id: sessionRow.id,
            status: sessionRow.status,
            totalVolume: sessionRow.totalVolume,
            setsLogged: sessionRow.exercises.reduce((a, e) => a + e.sets.length, 0),
            exerciseCount: sessionRow.exercises.length,
            prCount,
          }
        : null,
      whoopWorkouts: dayWhoop,
      reminders,
    };
  }

  return {
    month,
    monthLabel: parseLocalDate(first).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    prevMonth: shiftMonth(month, -1),
    nextMonth: shiftMonth(month, 1),
    today,
    weeks,
    selected,
    hasAnyCompleted: anyCompleted > 0,
  };
}
