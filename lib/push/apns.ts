/**
 * lib/push/apns.ts — token-based (.p8) APNs sender, built on Node's own
 * `node:crypto` and `node:http2` only (no npm deps). This is a DORMANT
 * scaffold: `isApnsConfigured()` gates everything, so with no APNs env vars
 * set, `sendPushToUser` is a guaranteed no-op and never throws.
 *
 * Config (read lazily from process.env on every call, so tests/tools can
 * toggle env vars without a module reload):
 *   APNS_KEY_ID     — the .p8 key's Key ID (from App Store Connect).
 *   APNS_TEAM_ID    — your Apple Developer Team ID.
 *   APNS_BUNDLE_ID  — the app's bundle id / apns-topic (defaults to the
 *                     Capacitor appId, com.majidtahir.tracker).
 *   APNS_AUTH_KEY   — the .p8 PEM contents. May contain literal "\n" escape
 *                     sequences (common when set via a single-line env var
 *                     or shell export) — those are normalized to real
 *                     newlines before parsing.
 *   APNS_HOST       — https://api.sandbox.push.apple.com (dev, default) or
 *                     https://api.push.apple.com (production).
 */
import crypto from "node:crypto";
import http2 from "node:http2";
import { prisma } from "@/lib/db";

interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  authKey: string;
  host: string;
}

function readConfig(): ApnsConfig {
  const authKeyRaw = process.env.APNS_AUTH_KEY ?? "";
  return {
    keyId: process.env.APNS_KEY_ID ?? "",
    teamId: process.env.APNS_TEAM_ID ?? "",
    bundleId: process.env.APNS_BUNDLE_ID || "com.majidtahir.tracker",
    // Literal "\n" sequences show up when the PEM is stuffed into a
    // single-line env var (e.g. via a .env file or CI secret); real
    // newlines pass through unchanged.
    authKey: authKeyRaw.replace(/\\n/g, "\n"),
    host: process.env.APNS_HOST || "https://api.sandbox.push.apple.com",
  };
}

/** True only when the minimum set of credentials is present. */
export function isApnsConfigured(): boolean {
  const { keyId, teamId, authKey } = readConfig();
  return Boolean(keyId && teamId && authKey);
}

// ---------------------------------------------------------------- JWT (ES256)

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Convert a DER-encoded ECDSA signature (what node:crypto produces) into the
 * raw JOSE "R || S" format required by JWS (RFC 7518 §3.4): two fixed-width
 * big-endian integers concatenated, each `size` bytes (32 for P-256).
 *
 * DER layout: 30 <len> 02 <rLen> <R bytes> 02 <sLen> <S bytes>, where R/S may
 * carry a leading 0x00 padding byte (to keep them non-negative two's
 * complement) that must be stripped, or may be shorter than `size` and need
 * left-zero-padding.
 */
function derToJose(der: Buffer, size = 32): Buffer {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Invalid DER signature: expected SEQUENCE");
  // Sequence length (short or long form) — value itself is unused here.
  let seqLen = der[offset++];
  if (seqLen & 0x80) offset += seqLen & 0x7f;

  function readInt(): Buffer {
    if (der[offset++] !== 0x02) throw new Error("Invalid DER signature: expected INTEGER");
    let len = der[offset++];
    if (len & 0x80) {
      const nBytes = len & 0x7f;
      len = 0;
      for (let i = 0; i < nBytes; i++) len = (len << 8) | der[offset++];
    }
    let bytes = der.subarray(offset, offset + len);
    offset += len;
    // Strip a single leading 0x00 sign-padding byte.
    if (bytes.length > size && bytes[0] === 0x00) bytes = bytes.subarray(1);
    if (bytes.length < size) {
      const padded = Buffer.alloc(size);
      bytes.copy(padded, size - bytes.length);
      bytes = padded;
    }
    return Buffer.from(bytes);
  }

  const r = readInt();
  const s = readInt();
  return Buffer.concat([r, s]);
}

let cachedJwt: { token: string; issuedAt: number } | null = null;
const JWT_MAX_AGE_SECONDS = 50 * 60; // Apple recommends refreshing under 1h.

/** Build (and cache) the ES256 provider authentication token APNs requires. */
export function buildApnsJwt(): string {
  const config = readConfig();
  const now = Math.floor(Date.now() / 1000);

  if (cachedJwt && now - cachedJwt.issuedAt < JWT_MAX_AGE_SECONDS) {
    return cachedJwt.token;
  }

  const header = { alg: "ES256", kid: config.keyId };
  const payload = { iss: config.teamId, iat: now };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const signer = crypto.createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const derSignature = signer.sign(config.authKey);
  const joseSignature = derToJose(derSignature, 32);

  const token = `${signingInput}.${base64url(joseSignature)}`;
  cachedJwt = { token, issuedAt: now };
  return token;
}

// ---------------------------------------------------------------- payload

export interface PushMessage {
  title: string;
  body?: string;
  href?: string;
}

/** Pure, testable shaping of the APNs payload — no network, no signing. */
export function buildApnsPayload(msg: PushMessage): {
  aps: { alert: { title: string; body?: string }; sound: string };
  href?: string;
} {
  return {
    aps: {
      alert: { title: msg.title, body: msg.body },
      sound: "default",
    },
    href: msg.href,
  };
}

// ---------------------------------------------------------------- sending

/** Reasons from Apple's error payload that mean the token is dead for good. */
const DEAD_TOKEN_REASONS = new Set(["BadDeviceToken", "Unregistered"]);

function sendOne(config: ApnsConfig, jwt: string, deviceToken: string, payloadJson: string): Promise<{
  status: number | undefined;
  reason?: string;
}> {
  return new Promise((resolve) => {
    let session: http2.ClientHttp2Session;
    try {
      session = http2.connect(config.host);
    } catch (err) {
      console.error("[apns] connect failed", err);
      resolve({ status: undefined });
      return;
    }

    session.on("error", (err) => {
      console.error("[apns] session error", err);
      resolve({ status: undefined });
    });

    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json",
    });

    let responseStatus: number | undefined;
    let chunks: Buffer[] = [];

    req.on("response", (headers) => {
      responseStatus = Number(headers[":status"]);
    });
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      session.close();
      let reason: string | undefined;
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        if (body) reason = (JSON.parse(body) as { reason?: string }).reason;
      } catch {
        // Non-JSON or empty body — ignore.
      }
      resolve({ status: responseStatus, reason });
    });
    req.on("error", (err) => {
      console.error("[apns] request error", err);
      session.close();
      resolve({ status: responseStatus });
    });

    req.write(payloadJson);
    req.end();
  });
}

/**
 * Push a message to every device token on file for a user. No-op (dormant)
 * unless APNs credentials are configured. Never throws — push delivery is
 * best-effort and must not break the caller's flow (e.g. saving a recovery
 * log).
 */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<void> {
  if (!isApnsConfigured()) return;

  try {
    const config = readConfig();
    const tokens = await prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const jwt = buildApnsJwt();
    const payloadJson = JSON.stringify(buildApnsPayload(msg));

    for (const { token } of tokens) {
      try {
        const { status, reason } = await sendOne(config, jwt, token, payloadJson);
        if (status === 410 || (reason && DEAD_TOKEN_REASONS.has(reason))) {
          await prisma.pushToken.delete({ where: { token } }).catch(() => {
            // Already gone — fine.
          });
        }
      } catch (err) {
        console.error("[apns] send failed", err);
      }
    }
  } catch (err) {
    console.error("[apns] sendPushToUser failed", err);
  }
}
