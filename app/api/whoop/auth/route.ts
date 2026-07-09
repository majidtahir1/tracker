/**
 * GET /api/whoop/auth — start the WHOOP OAuth flow: stash a random state in
 * an httpOnly cookie and redirect to WHOOP's authorize page.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
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
    return NextResponse.redirect(new URL("/recovery?whoop=not_configured", request.url));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("whoop_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const url = new URL(WHOOP_AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.WHOOP_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", process.env.WHOOP_REDIRECT_URI ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", WHOOP_SCOPES);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}
