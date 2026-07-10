/**
 * AI Program Builder — shared types between the client wizard, the server
 * actions, and the MiniMax provider. The draft is plain JSON so it can round
 * trip through server actions and the model.
 */
import type {
  Equipment,
  ExerciseType,
  MuscleGroup,
  Priority,
} from "@/lib/generated/prisma/enums";

export type BuilderGoal = "HYPERTROPHY" | "STRENGTH" | "FAT_LOSS" | "ATHLETIC";
export type BuilderExperience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface BuilderIntake {
  goal: BuilderGoal;
  experience: BuilderExperience;
  daysPerWeek: number; // 2-6
  sessionMinutes: number; // 30-90
  equipment: Equipment[];
  priorityMuscles: MuscleGroup[];
  injuries: string; // free text, may be empty
  notes: string; // free text, may be empty
}

export interface DraftNewExercise {
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
}

export interface DraftSlot {
  exercise: string;
  sets: number;
  repMin: number;
  repMax: number;
  priority: Priority;
  isPerSide: boolean;
  notes: string | null;
  /** Present only when the exercise is not in the shared catalog. */
  newExercise: DraftNewExercise | null;
}

export interface DraftDay {
  name: string;
  focus: string;
  slots: DraftSlot[];
}

export interface DraftProgram {
  name: string;
  description: string;
  days: DraftDay[];
  /** Weeks 5-8: +1 set to these [dayNumber, exercise] pairs. */
  block2AddSets: Array<{ day: number; exercise: string }>;
  /** Weeks 9-12: total extra sets vs block 1 (overrides are per-phase). */
  block3AddSets: Array<{ day: number; exercise: string; addSets: number }>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface VolumeRow {
  muscle: MuscleGroup;
  directSets: number;
  indirectSets: number;
}

export type BuilderResult =
  | {
      ok: true;
      message: string;
      draft: DraftProgram;
      volume: VolumeRow[];
      /** Authoritative conversation including this turn; send it back next turn. */
      history: ChatTurn[];
    }
  | { ok: false; error: string };

export type FinalizeResult =
  | { ok: true; programId: string; programName: string }
  | { ok: false; error: string };
