/**
 * AI Program Builder provider: MiniMax call, strict draft validation against
 * the exercise catalog, and weekly-volume accounting. Follows the guardrail
 * philosophy of set-coach-provider.ts — the model proposes, the server checks.
 */
import {
  Equipment,
  ExerciseType,
  MuscleGroup,
  Priority,
} from "@/lib/generated/prisma/enums";
import { PROGRAM_BUILDER_SYSTEM_PROMPT } from "./program-builder-prompt";
import {
  slotSetsForPhase,
  type BuilderIntake,
  type ChatTurn,
  type DraftDay,
  type DraftNewExercise,
  type DraftProgram,
  type DraftSlot,
  type ProgramPhase,
  type VolumeRow,
} from "./program-builder-types";

export interface CatalogExercise {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: string; // JSON array string, as stored
  equipment: Equipment;
  type: ExerciseType;
}

const MUSCLES = Object.values(MuscleGroup);
const EQUIPMENT = Object.values(Equipment);
const TYPES = Object.values(ExerciseType);
const PRIORITIES = Object.values(Priority);

// ---------- Validation ----------

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function str(v: unknown, min: number, max: number): string | null {
  return typeof v === "string" && v.trim().length >= min && v.trim().length <= max
    ? v.trim()
    : null;
}

function validateNewExercise(v: unknown, errors: string[], where: string): DraftNewExercise | null {
  if (v == null) return null;
  const o = v as Record<string, unknown>;
  const primaryMuscle = MUSCLES.includes(o.primaryMuscle as MuscleGroup)
    ? (o.primaryMuscle as MuscleGroup)
    : null;
  const equipment = EQUIPMENT.includes(o.equipment as Equipment) ? (o.equipment as Equipment) : null;
  const type = TYPES.includes(o.type as ExerciseType) ? (o.type as ExerciseType) : null;
  const secondary = Array.isArray(o.secondaryMuscles)
    ? (o.secondaryMuscles.filter((m) => MUSCLES.includes(m as MuscleGroup)) as MuscleGroup[])
    : [];
  if (!primaryMuscle || !equipment || !type) {
    errors.push(`${where}: newExercise needs valid primaryMuscle, equipment, and type`);
    return null;
  }
  return { primaryMuscle, secondaryMuscles: secondary, equipment, type };
}

/**
 * Validate the raw model JSON into a DraftProgram. Returns errors for a
 * correction retry rather than silently fixing structural problems; only
 * trivial issues (trimming, defaulting priority) are normalized.
 */
export function validateDraft(
  raw: unknown,
  catalog: Map<string, CatalogExercise>,
): { draft: DraftProgram | null; errors: string[] } {
  const errors: string[] = [];
  const root = (raw ?? {}) as Record<string, unknown>;
  const p = (root.program ?? {}) as Record<string, unknown>;

  const name = str(p.name, 2, 60);
  if (!name) errors.push("program.name must be 2-60 characters");
  const description = str(p.description, 0, 200) ?? "";

  const rawDays = Array.isArray(p.days) ? p.days : [];
  if (rawDays.length < 1 || rawDays.length > 6) errors.push("program.days must have 1-6 days");

  const days: DraftDay[] = [];
  rawDays.forEach((rd, di) => {
    const d = (rd ?? {}) as Record<string, unknown>;
    const dayName = str(d.name, 2, 60);
    if (!dayName) errors.push(`day ${di + 1}: name must be 2-60 characters`);
    const rawSlots = Array.isArray(d.slots) ? d.slots : [];
    if (rawSlots.length < 1 || rawSlots.length > 8)
      errors.push(`day ${di + 1}: must have 1-8 exercises`);

    const slots: DraftSlot[] = [];
    rawSlots.forEach((rs, si) => {
      const s = (rs ?? {}) as Record<string, unknown>;
      const where = `day ${di + 1} slot ${si + 1}`;
      const exercise = str(s.exercise, 2, 80);
      if (!exercise) {
        errors.push(`${where}: exercise name required`);
        return;
      }
      if (!isInt(s.sets, 1, 6)) errors.push(`${where} (${exercise}): sets must be 1-6`);
      if (!isInt(s.repMin, 1, 30) || !isInt(s.repMax, 1, 30) || (s.repMin as number) > (s.repMax as number))
        errors.push(`${where} (${exercise}): reps must be 1-30 with repMin <= repMax`);

      const inCatalog = catalog.has(exercise.toLowerCase());
      let newExercise = validateNewExercise(s.newExercise, errors, `${where} (${exercise})`);
      if (inCatalog) newExercise = null; // catalog metadata wins
      if (!inCatalog && !newExercise)
        errors.push(
          `${where}: "${exercise}" is not in the catalog — use the exact catalog name or provide newExercise metadata`,
        );

      slots.push({
        exercise: inCatalog ? catalog.get(exercise.toLowerCase())!.name : exercise,
        sets: isInt(s.sets, 1, 6) ? s.sets : 3,
        repMin: isInt(s.repMin, 1, 30) ? s.repMin : 8,
        repMax: isInt(s.repMax, 1, 30) ? s.repMax : 12,
        priority: PRIORITIES.includes(s.priority as Priority) ? (s.priority as Priority) : "NORMAL",
        isPerSide: s.isPerSide === true,
        notes: str(s.notes, 1, 120),
        newExercise,
      });
    });
    days.push({ name: dayName ?? `Day ${di + 1}`, focus: str(d.focus, 0, 80) ?? "", slots });
  });

  // Duplicate slot names within a day break block-override lookups.
  days.forEach((d, di) => {
    const seen = new Set<string>();
    for (const slot of d.slots) {
      if (seen.has(slot.exercise)) errors.push(`day ${di + 1}: "${slot.exercise}" appears twice`);
      seen.add(slot.exercise);
    }
  });

  const readAdds = (
    v: unknown,
    label: string,
    withCount: boolean,
  ): Array<{ day: number; exercise: string; addSets: number }> => {
    if (v == null) return [];
    if (!Array.isArray(v)) {
      errors.push(`${label} must be an array`);
      return [];
    }
    const out: Array<{ day: number; exercise: string; addSets: number }> = [];
    for (const item of v) {
      const o = (item ?? {}) as Record<string, unknown>;
      const day = isInt(o.day, 1, days.length) ? o.day : null;
      const exercise = str(o.exercise, 2, 80);
      const addSets = withCount ? (isInt(o.addSets, 1, 3) ? o.addSets : null) : 1;
      if (!day || !exercise || addSets == null) {
        errors.push(`${label}: entries need a valid day, exercise${withCount ? ", addSets 1-3" : ""}`);
        continue;
      }
      const slot = days[day - 1]?.slots.find(
        (s) => s.exercise.toLowerCase() === exercise.toLowerCase(),
      );
      if (!slot) {
        errors.push(`${label}: "${exercise}" is not on day ${day}`);
        continue;
      }
      out.push({ day, exercise: slot.exercise, addSets });
    }
    return out;
  };

  const block2AddSets = readAdds(p.block2AddSets, "block2AddSets", false).map(({ day, exercise }) => ({ day, exercise }));
  const block3AddSets = readAdds(p.block3AddSets, "block3AddSets", true);

  if (errors.length > 0) return { draft: null, errors };
  return {
    draft: { name: name!, description, days, block2AddSets, block3AddSets },
    errors: [],
  };
}

// ---------- Volume accounting ----------

/** Weekly sets per muscle for a phase: direct (primary) and indirect (secondary). */
export function computeVolume(
  draft: DraftProgram,
  catalog: Map<string, CatalogExercise>,
  phase: ProgramPhase = 1,
): VolumeRow[] {
  const direct = new Map<MuscleGroup, number>();
  const indirect = new Map<MuscleGroup, number>();
  draft.days.forEach((day, di) => {
    for (const slot of day.slots) {
      const sets = slotSetsForPhase(draft, di + 1, slot.exercise, slot.sets, phase);
      const cat = catalog.get(slot.exercise.toLowerCase());
      const primary = cat?.primaryMuscle ?? slot.newExercise?.primaryMuscle;
      const secondary: MuscleGroup[] = cat
        ? (JSON.parse(cat.secondaryMuscles) as MuscleGroup[])
        : (slot.newExercise?.secondaryMuscles ?? []);
      if (primary) direct.set(primary, (direct.get(primary) ?? 0) + sets);
      for (const m of secondary) indirect.set(m, (indirect.get(m) ?? 0) + sets);
    }
  });
  const muscles = new Set([...direct.keys(), ...indirect.keys()]);
  return [...muscles]
    .map((muscle) => ({
      muscle,
      directSets: direct.get(muscle) ?? 0,
      indirectSets: indirect.get(muscle) ?? 0,
    }))
    .sort((a, b) => b.directSets - a.directSets || b.indirectSets - a.indirectSets);
}

// ---------- MiniMax call ----------

export function catalogPromptLines(catalog: CatalogExercise[]): string {
  return catalog
    .map((e) => {
      const secondary = (JSON.parse(e.secondaryMuscles) as string[]).join("/");
      return `${e.name} | ${e.primaryMuscle}${secondary ? `+${secondary}` : ""} | ${e.equipment} | ${e.type}`;
    })
    .join("\n");
}

export function intakePrompt(
  intake: BuilderIntake,
  catalog: CatalogExercise[],
  athleteName: string,
): string {
  return [
    "ATHLETE INTAKE",
    `name: ${athleteName}`,
    `goal: ${intake.goal}`,
    `experience: ${intake.experience}`,
    `days per week: ${intake.daysPerWeek}`,
    `session length: ${intake.sessionMinutes} minutes`,
    `equipment available: ${intake.equipment.join(", ")}`,
    `priority muscles: ${intake.priorityMuscles.length ? intake.priorityMuscles.join(", ") : "none stated"}`,
    `injuries/limitations: ${intake.injuries || "none stated"}`,
    `other notes: ${intake.notes || "none"}`,
    "",
    "CATALOG (name | muscles | equipment | type)",
    catalogPromptLines(catalog),
    "",
    "Design the program now.",
  ].join("\n");
}

interface MiniMaxMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Non-streaming call. The highspeed model answers in 40-90s, well within
 * connection-idle limits. (Streaming SSE stalls under Next's patched fetch in
 * server actions — do not reintroduce it here.)
 */
async function callMiniMax(messages: MiniMaxMessage[]): Promise<string | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error("program-builder: MINIMAX_API_KEY not set");
    return null;
  }
  // Full program design on the deep-reasoning M3 takes 10+ minutes; the
  // highspeed tier finishes in ~1 minute with adequate quality.
  const model = process.env.PROGRAM_BUILDER_MODEL ?? "MiniMax-M2.7-highspeed";
  const apiUrl = process.env.MINIMAX_API_URL ?? "https://api.minimax.io/v1/text/chatcompletion_v2";
  // The highspeed tier finishes in 40-90s; anything past 150s is a hung
  // stream, and the transport retry gets a fresh connection sooner.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150000);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        // Reasoning tokens count against this budget; the model may think at
        // length before emitting the program JSON.
        max_completion_tokens: 24000,
        temperature: 0.7,
        top_p: 0.95,
      }),
    });
    if (!response.ok) {
      console.error("program-builder: MiniMax HTTP", response.status, await response.text().catch(() => ""));
      return null;
    }
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("program-builder: MiniMax request failed", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** callMiniMax with one retry on transport failure (resets, rate limits). */
async function callMiniMaxWithRetry(messages: MiniMaxMessage[]): Promise<string | null> {
  const first = await callMiniMax(messages);
  if (first != null) return first;
  await new Promise((r) => setTimeout(r, 3000));
  return callMiniMax(messages);
}

function parseModelJson(content: string): { message: string; raw: unknown } | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]) as Record<string, unknown>;
    return { message: typeof value.message === "string" ? value.message : "", raw: value };
  } catch {
    return null;
  }
}

export interface BuilderCallResult {
  message: string;
  draft: DraftProgram;
}

/**
 * One builder turn: history (already including the latest user message) goes
 * to MiniMax; an invalid draft gets one correction retry with the validation
 * errors appended.
 */
export async function requestProgramDraft(
  history: ChatTurn[],
  catalog: Map<string, CatalogExercise>,
): Promise<BuilderCallResult | { error: string }> {
  const base: MiniMaxMessage[] = [
    { role: "system", content: PROGRAM_BUILDER_SYSTEM_PROMPT },
    ...history.map((t) => ({ role: t.role, content: t.content }) as MiniMaxMessage),
  ];

  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages =
      attempt === 0
        ? base
        : [
            ...base,
            {
              role: "user" as const,
              content: `Your previous JSON failed validation:\n- ${lastErrors.join("\n- ")}\nReturn the corrected COMPLETE JSON only.`,
            },
          ];
    const content = await callMiniMaxWithRetry(messages);
    if (content == null) return { error: "The AI service is unavailable right now — try again in a minute." };
    const parsed = parseModelJson(content);
    if (!parsed) {
      lastErrors = ["response was not a single valid JSON object"];
      continue;
    }
    const { draft, errors } = validateDraft(parsed.raw, catalog);
    if (draft) return { message: parsed.message || "Here is the updated program.", draft };
    lastErrors = errors.slice(0, 12);
  }
  return { error: `The AI returned an invalid program twice (${lastErrors[0] ?? "unknown error"}). Try rephrasing your request.` };
}
