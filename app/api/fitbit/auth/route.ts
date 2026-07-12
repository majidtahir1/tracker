/**
 * GET /api/fitbit/auth — start the Google OAuth flow for the Google Health
 * API (Fitbit data): bind a random state + PKCE verifier to the signed-in
 * user (DB row, not cookies — the callback may arrive in a different browser
 * on mobile) and redirect to Google's consent page. access_type=offline +
 * prompt=consent so a refresh token is always issued.
 */
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createOAuthState } from "@/lib/oauth-state";
import {
  isFitbitConfigured,
  GOOGLE_AUTHORIZE_URL,
  GOOGLE_HEALTH_SCOPES,
} from "@/lib/fitbit/config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isFitbitConfigured()) {
    return NextResponse.redirect(new URL("/settings?fitbit=not_configured", request.url));
  }

  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = await createOAuthState(session.user.id, "fitbit", codeVerifier);

  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.GOOGLE_HEALTH_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", process.env.GOOGLE_HEALTH_REDIRECT_URI ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_HEALTH_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url);
}
