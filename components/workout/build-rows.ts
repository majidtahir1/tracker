/**
 * components/workout/build-rows.ts — initial editable rows for the logger.
 * Persisted sets keep their set numbers; missing numbers up to targetSets are
 * padded with prefills. Set numbers must stay unique — every row update in the
 * logger is keyed by setNumber.
 */
import type { LoggerExercise, SetData } from "./types";

export function buildRows(ex: LoggerExercise): SetData[] {
  const rows: SetData[] = ex.sets.map((s) => ({ ...s }));
  const taken = new Set(rows.map((r) => r.setNumber));
  for (let n = 1; n <= ex.targetSets; n++) {
    if (taken.has(n)) continue;
    const prev = ex.prevSets[n - 1] ?? ex.prevSets[ex.prevSets.length - 1];
    const weight = ex.targetWeight ?? prev?.weight ?? 0;
    const reps =
      ex.recommendation === "INCREASE" ? ex.targetRepMin : prev?.reps ?? ex.targetRepMin;
    rows.push({ id: null, setNumber: n, weight, reps, rir: null, completed: false });
  }
  return rows.sort((a, b) => a.setNumber - b.setNumber);
}
