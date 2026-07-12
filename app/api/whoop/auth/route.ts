/**
 * GET /api/whoop/auth — start the WHOOP OAuth flow: bind a random state to
 * the signed-in user (DB row, not a cookie — the callback may arrive in a
 * different browser on mobile) and redirect to WHOOP's authorize page.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createOAuthState } from "@/lib/oauth-state";
import {
  isWhoopConfigured,
  WHOOP_AUTHORIZE_URL,
  WHOOP_SCOPES,
} from "@/lib/whoop/config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isWhoopConfigured()) {
    return NextResponse.redirect(new URL("/settings?whoop=not_configured", request.url));
  }

  const state = await createOAuthState(session.user.id, "whoop");

  const url = new URL(WHOOP_AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.WHOOP_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", process.env.WHOOP_REDIRECT_URI ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", WHOOP_SCOPES);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}
