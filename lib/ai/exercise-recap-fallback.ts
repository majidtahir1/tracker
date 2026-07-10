/**
 * lib/ai/exercise-recap-fallback.ts — deterministic recap when MiniMax is
 * unavailable. Pure: built only from logged numbers, no network or clock.
 */
import type { ExerciseRecapResponse } from "./exercise-recap-types";

export interface RecapFallbackInput {
  exerciseName: string;
  /** Completed sets of the just-finished exercise, in order. */
  completedSets: Array<{ weight: number; reps: number }>;
  /** Completed sets of the most recent prior non-deload session, or null. */
  priorSets: Array<{ weight: number; reps: number }> | null;
  /** Exercises still to do in this session. */
  remaining: Array<{ name: string; setsRemaining: number }>;
  isDeload: boolean;
}

function volume(sets: Array<{ weight: number; reps: number }>): number {
  return sets.reduce((n, s) => n + s.weight * s.reps, 0);
}

function focusCue(remaining: RecapFallbackInput["remaining"]): string {
  if (remaining.length === 0) {
    return "That was the last exercise — finish strong and log the session.";
  }
  const setsLeft = remaining.reduce((n, r) => n + r.setsRemaining, 0);
  const next = remaining[0].name;
  return `${remaining.length} exercise${remaining.length === 1 ? "" : "s"} (${setsLeft} set${
    setsLeft === 1 ? "" : "s"
  }) to go — bring the same intent to ${next} and keep rest honest.`;
}

export function deterministicRecap(input: RecapFallbackInput): ExerciseRecapResponse {
  const { exerciseName, completedSets, priorSets, remaining, isDeload } = input;
  const cue = focusCue(remaining);

  if (isDeload) {
    return {
      headline: `${exerciseName} done — deload pace.`,
      message: "Easy work is the point today. Moving well while you recover is what sets up the next block.",
      focusCue: cue,
      source: "deterministic",
    };
  }

  if (!priorSets || priorSets.length === 0) {
    return {
      headline: `First ${exerciseName} in the book.`,
      message: `${completedSets.length} sets logged — that's your baseline. Everything from here is progress you can measure.`,
      focusCue: cue,
      source: "deterministic",
    };
  }

  const vol = volume(completedSets);
  const priorVol = volume(priorSets);
  const deltaPct = priorVol > 0 ? ((vol - priorVol) / priorVol) * 100 : 0;

  if (deltaPct > 1) {
    return {
      headline: `${exerciseName} volume up ${Math.round(deltaPct)}% on last session.`,
      message: "You beat your last outing — exactly how progress is supposed to look. Keep stacking sessions like this.",
      focusCue: cue,
      source: "deterministic",
    };
  }
  if (deltaPct >= -1) {
    return {
      headline: `Matched last session on ${exerciseName}.`,
      message: "Holding your numbers is a win — consistency is what earns the next jump.",
      focusCue: cue,
      source: "deterministic",
    };
  }
  return {
    headline: `${exerciseName}: a touch under last session.`,
    message: "A little shy of last time — normal, fatigue and sleep count too. The trend matters more than any single day.",
    focusCue: cue,
    source: "deterministic",
  };
}
