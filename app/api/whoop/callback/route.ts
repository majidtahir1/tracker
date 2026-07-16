/**
 * GET /api/whoop/callback — WHOOP OAuth redirect target. Works WITHOUT a
 * session: the user is identified by the single-use state row created in
 * /api/whoop/auth (on mobile this request arrives in Safari, which has no
 * app session). Verify state, exchange the code, store the connection, run
 * the initial sync, then land on /recovery (same-browser) or the public
 * /connected page (session-less browser).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumeOAuthState } from "@/lib/oauth-state";
import { publicUrl } from "@/lib/wearable-auth";
import { WHOOP_API_BASE } from "@/lib/whoop/config";
import { exchangeCode } from "@/lib/whoop/client";
import { syncWhoop } from "@/lib/whoop/sync";
import type { WhoopProfile } from "@/lib/whoop/types";
import { encryptToken } from "@/lib/security/token-crypto";

export const runtime = "nodejs";

async function doneRedirect(request: Request, status: string): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  const target = session ? `/settings?whoop=${status}` : `/connected?provider=whoop&status=${status}`;
  return NextResponse.redirect(publicUrl(target, request));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  if (params.get("error")) return doneRedirect(request, "denied");

  const state = params.get("state");
  const pending = state ? await consumeOAuthState(state, "whoop") : null;
  if (!pending) return doneRedirect(request, "state_mismatch");

  const code = params.get("code");
  if (!code) return doneRedirect(request, "error");

  const userId = pending.userId;

  try {
    const tokens = await exchangeCode(code);

    // Fetch the WHOOP user id so the connection row identifies the account.
    let whoopUserId: string | null = null;
    const profileRes = await fetch(`${WHOOP_API_BASE}/user/profile/basic`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as WhoopProfile;
      whoopUserId = String(profile.user_id);
    }

    const data = {
      whoopUserId,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope ?? null,
      lastSyncError: null,
    };
    await prisma.whoopConnection.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  } catch {
    return doneRedirect(request, "error");
  }

  // Initial backfill — awaited so the first page load already has data.
  await syncWhoop(userId, { force: true });

  return doneRedirect(request, "connected");
}
