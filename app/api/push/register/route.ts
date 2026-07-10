/**
 * POST /api/push/register — device-token registration for APNs (iOS app via
 * Capacitor). DELETE unregisters (e.g. on logout). Dormant scaffold: rows
 * are stored regardless, but nothing is pushed until APNs env vars are set
 * (see lib/push/apns.ts).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { token, platform } = (body ?? {}) as { token?: unknown; platform?: unknown };
  if (typeof token !== "string" || token.trim() === "") {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }
  const platformValue = typeof platform === "string" && platform.trim() !== "" ? platform : "ios";

  await prisma.pushToken.upsert({
    where: { token },
    update: { userId, platform: platformValue },
    create: { token, userId, platform: platformValue },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { token } = (body ?? {}) as { token?: unknown };
  if (typeof token !== "string" || token.trim() === "") {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  await prisma.pushToken.deleteMany({ where: { token, userId } });

  return NextResponse.json({ ok: true });
}
