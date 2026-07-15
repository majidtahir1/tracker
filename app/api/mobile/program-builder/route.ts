import { auth } from "@/lib/auth";
import {
  finalizeDraftProgram,
  runBuilderTurn,
} from "@/lib/actions/program-builder";
import type {
  BuilderIntake,
  ChatTurn,
  DraftProgram,
} from "@/lib/ai/program-builder-types";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 });

  if (body.action === "turn") {
    const intake = body.intake as BuilderIntake | undefined;
    const history = body.history as ChatTurn[] | undefined;
    if (!intake || !Array.isArray(history) || history.length > 20) {
      return Response.json({ error: "Invalid builder state" }, { status: 400 });
    }
    const result = await runBuilderTurn({
      intake,
      history,
      userMessage: typeof body.userMessage === "string" ? body.userMessage : null,
    });
    return Response.json({ data: result });
  }

  if (body.action === "finalize") {
    const draft = body.draft as DraftProgram | undefined;
    if (!draft) return Response.json({ error: "Program draft is required" }, { status: 400 });
    const result = await finalizeDraftProgram(draft, {
      activate: body.activate !== false,
      beginner: body.beginner === true,
    });
    return Response.json({ data: result });
  }

  return Response.json({ error: "Unknown builder action" }, { status: 400 });
}
