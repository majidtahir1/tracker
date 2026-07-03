import type { SetCoachGuardrails, SetCoachResponse, CoachAction } from "./set-coach-types";
import { SET_COACH_SYSTEM_PROMPT } from "./set-coach-prompt";

const ACTIONS: CoachAction[] = ["INCREASE", "REPEAT", "REDUCE", "STOP", "NO_CHANGE"];

function parseResponse(content: string, guardrails: SetCoachGuardrails): SetCoachResponse | null {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const value = JSON.parse(match[0]) as Record<string, unknown>;
    const action = String(value.action ?? "") as CoachAction;
    if (!ACTIONS.includes(action) || !guardrails.allowedActions.includes(action)) return null;
    const nextWeight = value.nextWeight == null ? null : Number(value.nextWeight);
    const expectedWeight = action === "INCREASE" || action === "REDUCE" ? guardrails.candidateWeight : action === "REPEAT" ? guardrails.repeatWeight : null;
    if (nextWeight !== expectedWeight || (nextWeight != null && (!Number.isFinite(nextWeight) || nextWeight < guardrails.allowedWeightMin || nextWeight > guardrails.allowedWeightMax))) return null;
    const text = (key: string, max: number) => typeof value[key] === "string" ? String(value[key]).slice(0, max) : "";
    return {
      action, nextWeight,
      repMin: action === "NO_CHANGE" || action === "STOP" ? null : guardrails.repMin,
      repMax: action === "NO_CHANGE" || action === "STOP" ? null : guardrails.repMax,
      headline: text("headline", 100), explanation: text("explanation", 240), encouragement: text("encouragement", 160),
      safetyWarning: value.safetyWarning == null ? null : text("safetyWarning", 200), source: "minimax",
    };
  } catch { return null; }
}

export async function requestMiniMaxCoach(context: unknown, guardrails: SetCoachGuardrails): Promise<SetCoachResponse | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return null;
  const model = process.env.MINIMAX_MODEL ?? "MiniMax-M3";
  const apiUrl = process.env.MINIMAX_API_URL ?? "https://api.minimax.io/v1/text/chatcompletion_v2";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiUrl, {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", name: "Set Coach", content: SET_COACH_SYSTEM_PROMPT }, { role: "user", name: "athlete", content: JSON.stringify(context) }], max_completion_tokens: 1200, temperature: 1, top_p: 0.95 }),
    });
    if (!response.ok) return null;
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return parseResponse(body.choices?.[0]?.message?.content ?? "", guardrails);
  } catch { return null; } finally { clearTimeout(timeout); }
}
