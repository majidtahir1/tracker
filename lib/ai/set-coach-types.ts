export type CoachAction = "INCREASE" | "REPEAT" | "REDUCE" | "STOP" | "NO_CHANGE";

export interface SetCoachResponse {
  action: CoachAction;
  nextWeight: number | null;
  repMin: number | null;
  repMax: number | null;
  headline: string;
  explanation: string;
  encouragement: string;
  safetyWarning: string | null;
  source: "minimax" | "deterministic";
}

/** Structured WHOOP metrics for the coach context (numbers only, no free text). */
export interface CoachWhoopContext {
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHr: number | null;
  sleepHours: number | null;
  sleepPerformancePct: number | null;
  sleepDebtHours: number | null;
  yesterdayStrain: number | null;
  recentWorkouts: Array<{ sportName: string; strain: number | null; durationMin: number }>;
}

export interface SetCoachGuardrails {
  allowedActions: CoachAction[];
  candidateWeight: number | null;
  repeatWeight: number | null;
  allowedWeightMin: number;
  allowedWeightMax: number;
  repMin: number;
  repMax: number;
  reason: string;
}
