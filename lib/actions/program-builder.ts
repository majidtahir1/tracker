"use server";

/**
 * AI Program Builder actions. runBuilderTurn is stateless — the client sends
 * the full chat history each turn. finalizeDraftProgram writes the draft to
 * the catalog/program tables exactly like the seed scripts do.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requireUserId } from "@/lib/session";
import {
  computeVolume,
  intakePrompt,
  requestProgramDraft,
  type CatalogExercise,
} from "@/lib/ai/program-builder";
import type {
  BuilderIntake,
  BuilderResult,
  ChatTurn,
  DraftProgram,
  FinalizeResult,
} from "@/lib/ai/program-builder-types";
import type { ExerciseType } from "@/lib/generated/prisma/enums";
import { visibleExerciseWhere } from "@/lib/program-access";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { hasAiDataConsent } from "@/lib/ai/consent";

const REST_BY_TYPE: Record<ExerciseType, number> = {
  HEAVY_COMPOUND: 180,
  COMPOUND: 150,
  MACHINE_COMPOUND: 105,
  ISOLATION: 75,
  CORE: 60,
};

// Beginners keep more in reserve (2-3 RIR); everyone else runs the app default.
function rirForType(type: ExerciseType, beginner: boolean): { min: number; max: number } {
  const isolation = type === "ISOLATION" || type === "CORE";
  if (beginner) return isolation ? { min: 1, max: 2 } : { min: 2, max: 3 };
  return isolation ? { min: 0, max: 1 } : { min: 1, max: 2 };
}

async function loadCatalog(userId: string): Promise<{
  list: CatalogExercise[];
  byName: Map<string, CatalogExercise>;
}> {
  const list = await prisma.exercise.findMany({
    where: visibleExerciseWhere(userId),
    orderBy: { name: "asc" },
    select: {
      name: true,
      primaryMuscle: true,
      secondaryMuscles: true,
      equipment: true,
      type: true,
    },
  });
  return { list, byName: new Map(list.map((e) => [e.name.toLowerCase(), e])) };
}

/**
 * One chat turn. First turn: history is empty and intake seeds the prompt.
 * Later turns: pass the running history plus the new userMessage.
 */
export async function runBuilderTurn(input: {
  intake: BuilderIntake;
  history: ChatTurn[];
  userMessage: string | null;
}): Promise<BuilderResult> {
  const user = await requireUser();
  if (!(await hasAiDataConsent(user.id))) {
    return {
      ok: false,
      error: "Enable AI coaching in Settings before using the program builder.",
    };
  }
  try {
    await enforceRateLimit(user.id, "ai:program-builder", 10, 60 * 60);
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, error: error.message };
    throw error;
  }
  const { list, byName } = await loadCatalog(user.id);

  const history: ChatTurn[] = [...input.history];
  if (history.length === 0) {
    // Display name over login handle: "Majid" reads better than "majidt".
    const athleteName = (user.name || user.username || "athlete").trim();
    history.push({ role: "user", content: intakePrompt(input.intake, list, athleteName) });
  } else if (input.userMessage && input.userMessage.trim()) {
    history.push({ role: "user", content: input.userMessage.trim().slice(0, 2000) });
  } else {
    return { ok: false, error: "Nothing to send." };
  }

  const result = await requestProgramDraft(history, byName);
  if ("error" in result) return { ok: false, error: result.error };
  history.push({
    role: "assistant",
    content: JSON.stringify({ message: result.message, program: result.draft }),
  });
  return {
    ok: true,
    message: result.message,
    draft: result.draft,
    volumeByPhase: [
      computeVolume(result.draft, byName, 1),
      computeVolume(result.draft, byName, 2),
      computeVolume(result.draft, byName, 3),
    ],
    history,
  };
}

/** Write the finalized draft to the DB; optionally make it the active program. */
export async function finalizeDraftProgram(
  draft: DraftProgram,
  options: { activate: boolean; beginner: boolean },
): Promise<FinalizeResult> {
  const userId = await requireUserId();
  const { byName } = await loadCatalog(userId);

  // Re-validate shape defensively: the draft round-tripped through the client.
  if (!draft?.name || !Array.isArray(draft.days) || draft.days.length === 0) {
    return { ok: false, error: "Draft program is incomplete." };
  }

  let name = draft.name.trim().slice(0, 60);
  if (name.length < 2) return { ok: false, error: "Program name must be at least 2 characters." };
  const taken = await prisma.program.findUnique({ where: { name } });
  if (taken) name = `${name.slice(0, 50)} (${new Date().toISOString().slice(0, 10)})`;

  try {
    const programId = await prisma.$transaction(async (tx) => {
      // 1. Create any new exercises (re-check the catalog inside the tx).
      const exerciseIdByName = new Map<string, string>();
      for (const day of draft.days) {
        for (const slot of day.slots) {
          const key = slot.exercise.toLowerCase();
          if (exerciseIdByName.has(key)) continue;
          const existing = await tx.exercise.findFirst({
            where: { name: slot.exercise },
            select: { id: true },
          });
          if (existing) {
            exerciseIdByName.set(key, existing.id);
            continue;
          }
          if (!slot.newExercise) throw new Error(`Unknown exercise: ${slot.exercise}`);
          const created = await tx.exercise.create({
            data: {
              name: slot.exercise,
              primaryMuscle: slot.newExercise.primaryMuscle,
              secondaryMuscles: JSON.stringify(slot.newExercise.secondaryMuscles),
              equipment: slot.newExercise.equipment,
              type: slot.newExercise.type,
              weightIncrement: slot.newExercise.type === "ISOLATION" ? 2.5 : 5,
              isBodyweight: slot.newExercise.equipment === "BODYWEIGHT",
              ownerId: userId,
            },
          });
          exerciseIdByName.set(key, created.id);
        }
      }

      // 2. Program + days + slots.
      const program = await tx.program.create({
        data: { name, description: draft.description || null, ownerId: userId },
      });
      const slotIdByDayAndName = new Map<string, string>();
      for (let di = 0; di < draft.days.length; di++) {
        const day = draft.days[di];
        const template = await tx.workoutTemplate.create({
          data: {
            name: day.name.slice(0, 60),
            programId: program.id,
            dayNumber: di + 1,
            sortOrder: di,
            isActive: true,
          },
        });
        for (let si = 0; si < day.slots.length; si++) {
          const slot = day.slots[si];
          const cat = byName.get(slot.exercise.toLowerCase());
          const type: ExerciseType = cat?.type ?? slot.newExercise?.type ?? "COMPOUND";
          const rir = rirForType(type, options.beginner);
          const row = await tx.templateExercise.create({
            data: {
              templateId: template.id,
              exerciseId: exerciseIdByName.get(slot.exercise.toLowerCase())!,
              sortOrder: si,
              baseSets: slot.sets,
              repRangeMin: slot.repMin,
              repRangeMax: slot.repMax,
              targetRirMin: rir.min,
              targetRirMax: rir.max,
              priority: slot.priority,
              restSeconds: REST_BY_TYPE[type],
              isPerSide: slot.isPerSide,
              notes: slot.notes,
            },
          });
          slotIdByDayAndName.set(`${di + 1}:${slot.exercise.toLowerCase()}`, row.id);
        }
      }

      // 3. Block overrides.
      const adds: Array<{ block: number; day: number; exercise: string; addSets: number }> = [
        ...draft.block2AddSets.map((a) => ({ block: 2, ...a, addSets: 1 })),
        ...draft.block3AddSets.map((a) => ({ block: 3, ...a })),
      ];
      for (const add of adds) {
        const templateExerciseId = slotIdByDayAndName.get(
          `${add.day}:${add.exercise.toLowerCase()}`,
        );
        if (!templateExerciseId) continue; // validated upstream; skip rather than fail
        await tx.blockOverride.create({
          data: { templateExerciseId, blockNumber: add.block, addSets: add.addSets },
        });
      }

      if (options.activate) {
        await tx.appSettings.update({
          where: { userId },
          data: { activeProgramId: program.id },
        });
      }
      return program.id;
    });

    revalidatePath("/programs");
    revalidatePath("/workout");
    revalidatePath("/");
    return { ok: true, programId, programName: name };
  } catch (err) {
    console.error("finalizeDraftProgram failed", err);
    return { ok: false, error: "Saving the program failed. Try again." };
  }
}
