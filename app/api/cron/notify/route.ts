/**
 * GET/POST /api/cron/notify — scheduled push notifications, hit by system
 * cron (see .env.production.example). Protected by CRON_SECRET bearer token;
 * safe to re-run any time — delivery is deduped via the PushSent ledger.
 *
 * Suggested crontab (server local time):
 *   0 7 * * *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://host/api/cron/notify
 *   0 16 * * 0  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://host/api/cron/notify
 */
import { NextResponse } from "next/server";
import { runScheduledPushes } from "@/lib/push/scheduled";

export const runtime = "nodejs";

async function handle(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runScheduledPushes();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
