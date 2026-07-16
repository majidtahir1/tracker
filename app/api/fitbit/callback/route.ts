/**
 * GET /api/fitbit/callback — Google OAuth redirect target (Google Health API,
 * Fitbit data). Works WITHOUT a session: the user is identified by the
 * single-use state row created in /api/fitbit/auth (on mobile this request
 * arrives in Safari, which has no app session). Verify state, exchange the
 * code with the stored PKCE verifier, store the connection, run the initial
 * sync, then land on /recovery (same-browser) or the public /connected page.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeOAuthState } from "@/lib/oauth-state";
import { publicUrl } from "@/lib/wearable-auth";
import { exchangeCode } from "@/lib/fitbit/client";
import { syncFitbit } from "@/lib/fitbit/sync";
import { encryptToken } from "@/lib/security/token-crypto";

export const runtime = "nodejs";

async function doneRedirect(request: Request, status: string): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const target = session
    ? `/settings?fitbit=${status}`
    : `/connected?provider=fitbit&status=${status}`;
  return NextResponse.redirect(publicUrl(target, request));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  if (params.get("error")) return doneRedirect(request, "denied");

  const state = params.get("state");
  const pending = state ? await consumeOAuthState(state, "fitbit") : null;
  if (!pending?.codeVerifier) return doneRedirect(request, "state_mismatch");

  const code = params.get("code");
  if (!code) return doneRedirect(request, "error");

  const userId = pending.userId;

  try {
    const tokens = await exchangeCode(code, pending.codeVerifier);
    // No refresh token means we can't sync unattended (shouldn't happen with
    // prompt=consent + access_type=offline) — treat as a failed connect.
    if (!tokens.refresh_token) return doneRedirect(request, "error");

    const data = {
      fitbitUserId: null,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope ?? null,
      lastSyncError: null,
    };
    await prisma.fitbitConnection.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  } catch {
    return doneRedirect(request, "error");
  }

  // Initial backfill — awaited so the first page load already has data.
  await syncFitbit(userId, { force: true });

  return doneRedirect(request, "connected");
}
