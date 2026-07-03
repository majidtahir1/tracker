/**
 * components/workout/types.ts — serialized shapes shared between the server
 * read layer (lib/queries/workout.ts) and the client logger components.
 * Types only; safe to import from both sides.
 */

export interface SetData {
  /** SetLog id when persisted, null for rows not yet saved. */
  id: string | null;
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
  completed: boolean;
}

export interface PrevSet {
  weight: number;
  reps: number;
  rir: number | null;
}

export interface AlternativeOption {
  id: string;
  name: string;
}

export type RecommendationKind =
  | "FIRST_TIME"
  | "INCREASE"
  | "REPEAT"
  | "REDUCE"
  | "DELOAD";

export interface LoggerExercise {
  sessionExerciseId: string;
  templateExerciseId: string;
  exerciseId: string;
  name: string;
  isBodyweight: boolean;
  isPerSide: boolean;
  weightIncrement: number;
  priority: string;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
  targetRirMin: number;
  targetRirMax: number;
  restSeconds: number;
  targetWeight: number | null;
  recommendation: RecommendationKind | null;
  /** Last session's working weight, for the "Keep N" banner action. */
  prevWorkingWeight: number | null;
  notes: string | null;
  /** Completed sets from the most recent prior non-deload completed session. */
  prevSets: PrevSet[];
  alternatives: AlternativeOption[];
  sets: SetData[];
}

export interface LoggerSession {
  id: string;
  name: string;
  date: string;
  weekInCycle: number;
  blockPhase: number;
  isDeload: boolean;
  status: string;
  /** ISO instant string, for the elapsed timer. */
  startedAt: string | null;
  exercises: LoggerExercise[];
}

export interface FiredPr {
  type: string;
  label: string;
  display: string;
}
