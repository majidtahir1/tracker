/**
 * lib/whoop/client.ts — server-only authenticated WHOOP API client.
 * Token storage lives in the WhoopConnection singleton row; access tokens are
 * auto-refreshed (and rotated refresh tokens persisted) before each call.
 * Never log tokens.
 */
import { prisma } from "@/lib/db";
import { WHOOP_API_BASE, WHOOP_TOKEN_URL } from "@/lib/whoop/config";
import type { WhoopPage, WhoopTokenResponse } from "@/lib/whoop/types";

/** Thrown when WHOOP rejects our credentials — the user must reconnect. */
export class WhoopAuthError extends Error {
  constructor(message = "WHOOP re-authorization required") {
    super(message);
    this.name = "WhoopAuthError";
  }
}

const REQUEST_TIMEOUT_MS = 10_000;
const REFRESH_SKEW_MS = 60_000; // refresh when expiring within 60s
const RETRY_BACKOFF_MS = 1_000;
const PAGE_LIMIT = 25;

type WhoopConnectionRow = NonNullable<
  Awaited<ReturnType<typeof prisma.whoopConnection.findUnique>>
>;

/** The singleton connection row, or null when WHOOP is not connected. */
export async function getConnection(): Promise<WhoopConnectionRow | null> {
  return prisma.whoopConnection.findUnique({ where: { id: "singleton" } });
}

async function postToken(params: Record<string, string>): Promise<WhoopTokenResponse> {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.WHOOP_CLIENT_ID ?? "",
      client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
      ...params,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new WhoopAuthError();
    }
    throw new Error(`WHOOP token endpoint returned ${response.status}`);
  }
  return (await response.json()) as WhoopTokenResponse;
}

/** Exchange an OAuth authorization code for tokens (does not persist). */
export async function exchangeCode(code: string): Promise<WhoopTokenResponse> {
  return postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.WHOOP_REDIRECT_URI ?? "",
  });
}

/** Refresh the stored tokens; persists the rotated pair. */
async function refreshTokens(connection: WhoopConnectionRow): Promise<WhoopConnectionRow> {
  let tokens: WhoopTokenResponse;
  try {
    tokens = await postToken({
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
      scope: "offline",
    });
  } catch (err) {
    if (err instanceof WhoopAuthError) {
      await prisma.whoopConnection.update({
        where: { id: "singleton" },
        data: { lastSyncError: "reauth_required" },
      });
    }
    throw err;
  }
  return prisma.whoopConnection.update({
    where: { id: "singleton" },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope ?? connection.scope,
    },
  });
}

/** A valid access token, refreshing first when close to expiry. */
async function getAccessToken(): Promise<string> {
  let connection = await getConnection();
  if (!connection) throw new WhoopAuthError("WHOOP is not connected");
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
 * Fetch every record of a paginated collection (e.g. "/cycle",
 * "/activity/sleep") within [start, end], following next_token.
 */
export async function fetchCollection<T>(
  path: string,
  opts: { start: Date; end: Date },
): Promise<T[]> {
  const accessToken = await getAccessToken();
  const records: T[] = [];
  let nextToken: string | undefined;

  do {
    const url = new URL(`${WHOOP_API_BASE}${path}`);
    url.searchParams.set("limit", String(PAGE_LIMIT));
    url.searchParams.set("start", opts.start.toISOString());
    url.searchParams.set("end", opts.end.toISOString());
    if (nextToken) url.searchParams.set("nextToken", nextToken);

    const response = await apiGet(url.toString(), accessToken);
    if (response.status === 401) throw new WhoopAuthError();
    if (!response.ok) {
      throw new Error(`WHOOP GET ${path} returned ${response.status}`);
    }
    const page = (await response.json()) as WhoopPage<T>;
    records.push(...(page.records ?? []));
    nextToken = page.next_token ?? undefined;
  } while (nextToken);

  return records;
}
