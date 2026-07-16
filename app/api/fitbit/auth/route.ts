/**
 * GET /api/fitbit/auth — start the Google OAuth flow for the Google Health
 * API (Fitbit data): bind a random state + PKCE verifier to the signed-in
 * user (DB row, not cookies — the callback may arrive in a different browser
 * on mobile) and redirect to Google's consent page. access_type=offline +
 * prompt=consent so a refresh token is always issued.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { wearableAuthorizeUrl } from "@/lib/wearable-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = await wearableAuthorizeUrl(session.user.id, "fitbit");
  if (!url) {
    return NextResponse.redirect(new URL("/settings?fitbit=not_configured", request.url));
  }
  return NextResponse.redirect(url);
}
