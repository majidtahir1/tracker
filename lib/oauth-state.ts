/**
 * lib/oauth-state.ts — DB-backed OAuth state, bound to the user server-side.
 * Mobile flows can finish in a different browser than they started in (the
 * iOS shell's webview starts the flow; Safari receives the callback), so the
 * callback identifies the user by the single-use state row, not by session.
 */
import { prisma } from "@/lib/db";

const MAX_AGE_MS = 10 * 60 * 1000;

export type OAuthProvider = "whoop" | "fitbit";

/** Create a fresh single-use state for the user, replacing any pending one. */
export async function createOAuthState(
  userId: string,
  provider: OAuthProvider,
  codeVerifier?: string,
): Promise<string> {
  const state = crypto.randomUUID();
  await prisma.oAuthState.deleteMany({ where: { userId, provider } });
  await prisma.oAuthState.create({
    data: { state, provider, userId, codeVerifier: codeVerifier ?? null },
  });
  return state;
}

/**
 * Look up and delete the state row (single-use). Returns null for unknown,
 * wrong-provider, or expired states.
 */
export async function consumeOAuthState(
  state: string,
  provider: OAuthProvider,
): Promise<{ userId: string; codeVerifier: string | null } | null> {
  const row = await prisma.oAuthState.findUnique({ where: { state } });
  if (!row) return null;
  await prisma.oAuthState.delete({ where: { state } }).catch(() => {});
  if (row.provider !== provider) return null;
  if (Date.now() - row.createdAt.getTime() > MAX_AGE_MS) return null;
  return { userId: row.userId, codeVerifier: row.codeVerifier };
}
