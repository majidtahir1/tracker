/**
 * POST /api/push/debug — TEMPORARY diagnostic sink for the instrumented
 * PushRegistrar: logs each registration step so push failures on TestFlight
 * builds (non-inspectable webviews) can be read from pm2 logs. Remove once
 * push registration is confirmed working.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.text().catch(() => "");
  console.log("[push-debug]", new Date().toISOString(), body.slice(0, 500));
  return NextResponse.json({ ok: true });
}
