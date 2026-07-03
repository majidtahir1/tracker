/**
 * lib/whoop/config.ts — WHOOP OAuth/API constants and env-var configuration.
 * Env: WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, WHOOP_REDIRECT_URI (.env.example).
 */

export const WHOOP_AUTHORIZE_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";

export const WHOOP_SCOPES = "read:recovery read:cycles read:sleep read:workout read:profile offline";

/** All three OAuth env vars are present. */
export function isWhoopConfigured(): boolean {
  return Boolean(
    process.env.WHOOP_CLIENT_ID &&
      process.env.WHOOP_CLIENT_SECRET &&
      process.env.WHOOP_REDIRECT_URI,
  );
}
