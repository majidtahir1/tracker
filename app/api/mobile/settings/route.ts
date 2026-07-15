import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cloneBuiltInProgram, isOwnedProgram } from "@/lib/program-access";

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { action?: string; enabled?: boolean; programId?: string };

  if (body.action === "activateProgram") {
    const programId = String(body.programId ?? "");
    if (!programId) return Response.json({ error: "Program is required" }, { status: 400 });

    const owned = await isOwnedProgram(session.user.id, programId);
    const activeProgramId = owned
      ? programId
      : await cloneBuiltInProgram(session.user.id, programId);
    if (!activeProgramId) return Response.json({ error: "Program not found" }, { status: 404 });

    await prisma.appSettings.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, activeProgramId },
      update: { activeProgramId },
    });
    return Response.json({ data: { activeProgramId } });
  }

  if (body.action !== "aiConsent") {
    return Response.json({ error: "Unknown settings action" }, { status: 400 });
  }
  const enabled = body.enabled === true;
  await prisma.appSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      aiDataSharingEnabled: enabled,
      aiDataConsentAt: enabled ? new Date().toISOString() : null,
    },
    update: {
      aiDataSharingEnabled: enabled,
      aiDataConsentAt: enabled ? new Date().toISOString() : null,
    },
  });
  return Response.json({ data: { enabled } });
}
