/**
 * POST /api/push/test — send an immediate test push to the calling user's
 * devices and return a diagnostic report (no device tokens included). Used
 * by the iOS app's "Send test notification" Settings action to verify the
 * whole pipeline: registered token → APNs credentials → delivery status.
 *
 * Bypasses the PushSent ledger on purpose — this is a diagnostic, not a
 * scheduled push.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push/apns";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await sendPushToUser(session.user.id, {
    title: "Test notification",
    body: "Push delivery is working — you'll get your briefs and reminders here.",
    href: "/",
  });

  return NextResponse.json({
    configured: report.configured,
    tokens: report.tokens,
    results: report.results.map(({ status, reason }) => ({ status, reason })),
  });
}
