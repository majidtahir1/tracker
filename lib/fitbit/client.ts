/**
 * lib/fitbit/client.ts — server-only authenticated Google Health API client
 * (Fitbit data). Token storage lives in the per-user FitbitConnection row;
 * access tokens are auto-refreshed before each call. Google refresh tokens do
 * not rotate — the stored one is kept when a refresh response omits it.
 * Never log tokens.
 */
import { prisma } from "@/lib/db";
import { sendReauthPush } from "@/lib/push/events";
import { GOOGLE_TOKEN_URL, HEALTH_API_BASE } from "@/lib/fitbit/config";
import type { GhaDataPointList, GoogleTokenResponse } from "@/lib/fitbit/types";

/** Thrown when Google rejects our credentials — the user must reconnect. */
export class FitbitAuthError extends Error {
  constructor(message = "Google Health re-authorization required") {
    super(message);
    this.name = "FitbitAuthError";
  }
}

const REQUEST_TIMEOUT_MS = 10_000;
const REFRESH_SKEW_MS = 60_000; // refresh when expiring within 60s
const RETRY_BACKOFF_MS = 1_000;
const MAX_PAGES = 200; // hard stop against pagination loops

type FitbitConnectionRow = NonNullable<
  Awaited<ReturnType<typeof prisma.fitbitConnection.findUnique>>
>;

/** The user's connection row, or null when Google Health is not connected. */
export async function getConnection(userId: string): Promise<FitbitConnectionRow | null> {
  return prisma.fitbitConnection.findUnique({ where: { userId } });
}

async function postToken(params: Record<string, string>): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET ?? "",
      ...params,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new FitbitAuthError();
    }
    throw new Error(`Google token endpoint returned ${response.status}`);
  }
  return (await response.json()) as GoogleTokenResponse;
}

/** Exchange an OAuth authorization code + PKCE verifier for tokens (does not persist). */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<GoogleTokenResponse> {
  return postToken({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: process.env.GOOGLE_HEALTH_REDIRECT_URI ?? "",
  });
}

/** Refresh the access token; the refresh token itself does not rotate. */
async function refreshTokens(connection: FitbitConnectionRow): Promise<FitbitConnectionRow> {
  let tokens: GoogleTokenResponse;
  try {
    tokens = await postToken({
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
    });
  } catch (err) {
    if (err instanceof FitbitAuthError) {
      // Also hit when a Testing-mode consent screen expires refresh tokens
      // after 7 days — the reconnect banner covers it in-app.
      await prisma.fitbitConnection.update({
        where: { id: connection.id },
        data: { lastSyncError: "reauth_required" },
      });
      // One push per incident: expiresAt stays frozen until a reconnect.
      await sendReauthPush(connection.userId, "fitbit", String(connection.expiresAt.getTime()));
    }
    throw err;
  }
  return prisma.fitbitConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? connection.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope ?? connection.scope,
    },
  });
}

/** A valid access token for the user, refreshing first when close to expiry. */
async function getAccessToken(userId: string): Promise<string> {
  let connection = await getConnection(userId);
  if (!connection) throw new FitbitAuthError("Google Health is not connected");
  if (connection.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS) {
    connection = await refreshTokens(connection);
  }
  return connection.accessToken;
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Authenticated GET with a 10s timeout and one retry on network/429/5xx. */
async function apiGet(url: string, accessToken: string): Promise<Response> {
  const doFetch = () =>
    fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  try {
    const response = await doFetch();
    if (!isRetriableStatus(response.status)) return response;
  } catch {
    // network error / timeout — fall through to the single retry
  }
  await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
  return doFetch();
}

/**
 * Fetch every data point of a data type (e.g. "sleep", "steps"), following
 * nextPageToken. `filter` is AIP-160 — supported for interval/daily types
 * (e.g. steps.interval.start_time, daily_resting_heart_rate.date) but NOT for
 * session types (sleep, exercise), which must be windowed client-side.
 * Session types page at 25; sample/interval types accept up to 10 000.
 */
export async function fetchDataPoints<T>(
  userId: string,
  dataType: string,
  filter: string | null,
  opts?: { pageSize?: number },
): Promise<T[]> {
  const accessToken = await getAccessToken(userId);
  const records: T[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const url = new URL(`${HEALTH_API_BASE}/users/me/dataTypes/${dataType}/dataPoints`);
    if (filter) url.searchParams.set("filter", filter);
    if (opts?.pageSize) url.searchParams.set("pageSize", String(opts.pageSize));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await apiGet(url.toString(), accessToken);
    // Only 401 means the grant is bad — 403 is usually SERVICE_DISABLED
    // (API not enabled on the project) or a scope problem, not a token issue.
    if (response.status === 401) throw new FitbitAuthError();
    if (!response.ok) {
      throw new Error(`Google Health GET ${dataType} returned ${response.status}`);
    }
    const page = (await response.json()) as GhaDataPointList<T>;
    records.push(...(page.dataPoints ?? []));
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken && ++pages < MAX_PAGES);

  return records;
}
