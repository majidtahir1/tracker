/**
 * GET /api/whoop/auth — start the WHOOP OAuth flow: bind a random state to
 * the signed-in user (DB row, not a cookie — the callback may arrive in a
 * different browser on mobile) and redirect to WHOOP's authorize page.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { publicUrl, wearableAuthorizeUrl } from "@/lib/wearable-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(publicUrl("/login", request));
  }

  const url = await wearableAuthorizeUrl(session.user.id, "whoop");
  if (!url) {
    return NextResponse.redirect(publicUrl("/settings?whoop=not_configured", request));
  }
  return NextResponse.redirect(url);
}
