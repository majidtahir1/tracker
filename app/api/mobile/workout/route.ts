import { auth } from "@/lib/auth";
import {
  finishWorkout,
  logSet,
  startWorkoutForMobile,
  updateExerciseNotes,
} from "@/lib/actions/workout";

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { action?: string; [key: string]: unknown };
  let result: unknown;
  switch (body.action) {
    case "start":
      result = await startWorkoutForMobile({
        templateId: String(body.templateId ?? ""),
        date: typeof body.date === "string" ? body.date : undefined,
        scheduleOverride: body.scheduleOverride === true,
      });
      break;
    case "logSet":
      result = await logSet({
        sessionExerciseId: String(body.sessionExerciseId ?? ""),
        setNumber: Number(body.setNumber),
        weight: Number(body.weight),
        reps: Number(body.reps),
        rir: body.rir == null ? null : Number(body.rir),
        completed: body.completed === true,
      });
      break;
    case "finish":
      result = await finishWorkout(String(body.sessionId ?? ""));
      break;
    case "notes":
      result = await updateExerciseNotes(String(body.sessionExerciseId ?? ""), String(body.notes ?? ""));
      break;
    default:
      return Response.json({ error: "Unknown workout action" }, { status: 400 });
  }
  return Response.json({ data: result });
}
