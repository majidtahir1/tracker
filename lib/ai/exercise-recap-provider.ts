import type { ExerciseRecapResponse } from "./exercise-recap-types";
import { EXERCISE_RECAP_SYSTEM_PROMPT } from "./exercise-recap-prompt";

export function parseRecapResponse(content: string): ExerciseRecapResponse | null {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const value = JSON.parse(match[0]) as Record<string, unknown>;
    const text = (key: string, max: number) =>
      typeof value[key] === "string" ? String(value[key]).trim().slice(0, max) : "";
    const headline = text("headline", 100);
    const message = text("message", 240);
    const focusCue = text("focusCue", 160);
    if (!headline || !message || !focusCue) return null;
    return { headline, message, focusCue, source: "minimax" };
  } catch {
    return null;
  }
}

export async function requestMiniMaxRecap(context: unknown): Promise<ExerciseRecapResponse | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return null;
  const model = process.env.MINIMAX_MODEL ?? "MiniMax-M3";
  const apiUrl = process.env.MINIMAX_API_URL ?? "https://api.minimax.io/v1/text/chatcompletion_v2";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", name: "Set Coach", content: EXERCISE_RECAP_SYSTEM_PROMPT },
          { role: "user", name: "athlete", content: JSON.stringify(context) },
        ],
        max_completion_tokens: 1200,
        temperature: 1,
        top_p: 0.95,
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return parseRecapResponse(body.choices?.[0]?.message?.content ?? "");
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
