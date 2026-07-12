/**
 * lib/fitbit/config.ts — Google Health API OAuth/API constants and env-var
 * configuration. The legacy Fitbit Web API shuts down September 2026; Fitbit
 * data is now read through the Google Health API (developers.google.com/health)
 * with Google OAuth 2.0. Register an OAuth client in the Google Cloud Console.
 * Env: GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET,
 * GOOGLE_HEALTH_REDIRECT_URI (.env.example).
 */

export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const HEALTH_API_BASE = "https://health.googleapis.com/v4";

// All Google Health API scopes are "Restricted" — a personal app can stay in
// the console's Testing mode (add yourself as a test user); public apps need
// Google's privacy/security review.
export const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
].join(" ");

/** All three OAuth env vars are present. */
export function isFitbitConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_HEALTH_CLIENT_ID &&
      process.env.GOOGLE_HEALTH_CLIENT_SECRET &&
      process.env.GOOGLE_HEALTH_REDIRECT_URI,
  );
}
