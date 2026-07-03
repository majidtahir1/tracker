import type { SetCoachGuardrails, SetCoachResponse } from "./set-coach-types";

export interface GuardrailInput {
  lastSet: { weight: number; reps: number; rir: number | null };
  targets: { repMin: number; repMax: number; rirMin: number; rirMax: number };
  weightIncrement: number;
  recoveryScore: number | null;
  isDeload: boolean;
  deloadWeight: number | null;
  remainingSets: number;
}

function round(weight: number, increment: number) {
  return Math.max(0, Math.round(weight / increment) * increment);
}

export function calculateSetGuardrails(input: GuardrailInput): SetCoachGuardrails {
  const { lastSet: set, targets, remainingSets } = input;
  const step = input.weightIncrement === 2.5 ? 2.5 : 5;
  if (remainingSets <= 0) return { allowedActions: ["NO_CHANGE"], candidateWeight: null, repeatWeight: null, allowedWeightMin: 0, allowedWeightMax: 0, repMin: targets.repMin, repMax: targets.repMax, reason: "All planned sets are complete." };
  if (input.isDeload) {
    const ceiling = input.deloadWeight ?? set.weight;
    return { allowedActions: ["REPEAT", "REDUCE"], candidateWeight: Math.min(set.weight, ceiling), repeatWeight: Math.min(set.weight, ceiling), allowedWeightMin: round(ceiling * 0.9, step), allowedWeightMax: ceiling, repMin: targets.repMin, repMax: targets.repMax, reason: "Deload loading ceiling applies." };
  }
  if ((input.recoveryScore != null && input.recoveryScore < 40) || set.reps < targets.repMin || set.rir === 0) {
    const reduced = round(set.weight * 0.9, step);
    return { allowedActions: ["REDUCE", "REPEAT"], candidateWeight: reduced, repeatWeight: set.weight, allowedWeightMin: reduced, allowedWeightMax: set.weight, repMin: targets.repMin, repMax: targets.repMax, reason: "Fatigue, effort, or reps indicate that load should not increase." };
  }
  const canIncrease = set.reps >= targets.repMax && set.rir != null && set.rir > targets.rirMax;
  return {
    allowedActions: canIncrease ? ["INCREASE", "REPEAT"] : ["REPEAT", "REDUCE"],
    candidateWeight: canIncrease ? set.weight + step : set.weight,
    repeatWeight: set.weight,
    allowedWeightMin: round(set.weight * 0.9, step),
    allowedWeightMax: canIncrease ? set.weight + step : set.weight,
    repMin: targets.repMin,
    repMax: targets.repMax,
    reason: canIncrease ? "The last set exceeded the top rep and RIR targets." : "The last set supports repeating the current load.",
  };
}

export function deterministicCoachResponse(g: SetCoachGuardrails): SetCoachResponse {
  const action = g.allowedActions[0];
  const weight = action === "NO_CHANGE" ? null : g.candidateWeight;
  const headline = action === "INCREASE" ? `Increase to ${weight} lb` : action === "REDUCE" ? `Reduce to ${weight} lb` : action === "NO_CHANGE" ? "Planned sets complete" : `Use ${weight} lb again`;
  return { action, nextWeight: weight, repMin: action === "NO_CHANGE" ? null : g.repMin, repMax: action === "NO_CHANGE" ? null : g.repMax, headline, explanation: g.reason, encouragement: action === "NO_CHANGE" ? "Move on when you are ready." : "Stay controlled and keep the next set honest.", safetyWarning: null, source: "deterministic" };
}
