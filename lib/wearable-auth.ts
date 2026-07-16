/**
 * lib/wearable-auth.ts — build a provider authorize URL for a user, binding
 * a fresh single-use OAuth state (lib/oauth-state). Shared by the browser
 * GET routes (app/api/{whoop,fitbit}/auth) and the mobile JSON API: the iOS
 * shell authenticates with a bearer header, which window.open cannot carry,
 * so the app asks for the URL and opens it in the system browser. The
 * callback identifies the user by the DB state row, not the session.
 */
import { createHash, randomBytes } from "node:crypto";
import { createOAuthState, type OAuthProvider } from "@/lib/oauth-state";
import {
  isWhoopConfigured,
  WHOOP_AUTHORIZE_URL,
  WHOOP_SCOPES,
} from "@/lib/whoop/config";
import {
  isFitbitConfigured,
  GOOGLE_AUTHORIZE_URL,
  GOOGLE_HEALTH_SCOPES,
} from "@/lib/fitbit/config";

/**
 * Absolute URL on the canonical public origin. The reverse proxy does not
 * forward the public Host header, so `request.url` resolves to the upstream
 * (localhost:<port>) — absolute redirects built from it send the browser to
 * localhost. BETTER_AUTH_URL is the deployment's public origin; fall back to
 * the request only in dev, where the two match.
 */
export function publicUrl(path: string, request: Request): URL {
  return new URL(path, process.env.BETTER_AUTH_URL ?? request.url);
}

/** Authorize URL for the provider, or null when it isn't configured. */
export async function wearableAuthorizeUrl(
  userId: string,
  provider: OAuthProvider,
): Promise<string | null> {
  if (provider === "whoop") {
    if (!isWhoopConfigured()) return null;
    const state = await createOAuthState(userId, "whoop");
    const url = new URL(WHOOP_AUTHORIZE_URL);
    url.searchParams.set("client_id", process.env.WHOOP_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", process.env.WHOOP_REDIRECT_URI ?? "");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", WHOOP_SCOPES);
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (!isFitbitConfigured()) return null;
  // PKCE + offline access so a refresh token is always issued.
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = await createOAuthState(userId, "fitbit", codeVerifier);
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
  return url.toString();
}
