/**
 * lib/queries/records.ts — server-only read layer for /records.
 */
import { prisma } from "@/lib/db";
import type { PrType } from "@/lib/generated/prisma/enums";
import type { LocalDate } from "@/lib/dates";

export interface PrCell {
  value: number;
  weight: number | null;
  reps: number | null;
  date: LocalDate;
  unseen: boolean;
}

export interface ExerciseRecords {
  exerciseId: string;
  exerciseName: string;
  records: Partial<Record<PrType, PrCell>>;
  /** Any unseen PR on this exercise (drives the row badge). */
  hasUnseen: boolean;
  latestDate: LocalDate;
}

export interface TimelineEntry {
  id: string;
  exerciseName: string;
  type: PrType;
  value: number;
  weight: number | null;
  reps: number | null;
  date: LocalDate;
  unseen: boolean;
}

export interface RecordsData {
  exercises: ExerciseRecords[];
  timeline: TimelineEntry[];
  unseenCount: number;
  totalPrs: number;
}

export async function getRecordsData(): Promise<RecordsData> {
  const rows = await prisma.personalRecord.findMany({
    orderBy: [{ date: "asc" }, { value: "asc" }],
    include: { exercise: { select: { name: true } } },
  });

  const byExercise = new Map<string, ExerciseRecords>();
  for (const row of rows) {
    let entry = byExercise.get(row.exerciseId);
    if (!entry) {
      entry = {
        exerciseId: row.exerciseId,
        exerciseName: row.exercise.name,
        records: {},
        hasUnseen: false,
        latestDate: row.date,
      };
      byExercise.set(row.exerciseId, entry);
    }
    const current = entry.records[row.type];
    // Rows are events; the standing record per type is the max value
    // (ties resolved to the most recent, since rows are date-ascending).
    if (!current || row.value >= current.value) {
      entry.records[row.type] = {
        value: row.value,
        weight: row.weight,
        reps: row.reps,
        date: row.date,
        unseen: !row.seenByUser,
      };
    }
    if (!row.seenByUser) entry.hasUnseen = true;
    if (row.date > entry.latestDate) entry.latestDate = row.date;
  }

  const exercises = [...byExercise.values()].sort((a, b) =>
    a.latestDate === b.latestDate
      ? a.exerciseName.localeCompare(b.exerciseName)
      : a.latestDate < b.latestDate
        ? 1
        : -1
  );

  const timeline: TimelineEntry[] = rows
    .slice()
    .reverse()
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      exerciseName: row.exercise.name,
      type: row.type,
      value: row.value,
      weight: row.weight,
      reps: row.reps,
      date: row.date,
      unseen: !row.seenByUser,
    }));

  return {
    exercises,
    timeline,
    unseenCount: rows.filter((r) => !r.seenByUser).length,
    totalPrs: rows.length,
  };
}
