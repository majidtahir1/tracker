/**
 * GET /api/whoop/callback — WHOOP OAuth redirect target: verify state,
 * exchange the code, store the connection, run the initial sync, then land
 * the user back on /recovery.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { WHOOP_API_BASE } from "@/lib/whoop/config";
import { exchangeCode } from "@/lib/whoop/client";
import { syncWhoop } from "@/lib/whoop/sync";
import type { WhoopProfile } from "@/lib/whoop/types";

export const runtime = "nodejs";

function recoveryRedirect(request: Request, status: string): NextResponse {
  return NextResponse.redirect(new URL(`/recovery?whoop=${status}`, request.url));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("whoop_oauth_state")?.value;
  cookieStore.delete("whoop_oauth_state");

  if (params.get("error")) return recoveryRedirect(request, "denied");

  const state = params.get("state");
  if (!expectedState || !state || state !== expectedState) {
    return recoveryRedirect(request, "state_mismatch");
  }

  const code = params.get("code");
  if (!code) return recoveryRedirect(request, "error");

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
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope ?? null,
      lastSyncError: null,
    };
    await prisma.whoopConnection.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });
  } catch {
    return recoveryRedirect(request, "error");
  }

  // Initial backfill — awaited so the first page load already has data.
  await syncWhoop({ force: true });

  return recoveryRedirect(request, "connected");
}
