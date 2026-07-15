import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1";

function encryptionKey(): Buffer {
  const raw = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY is required for wearable integrations");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function isEncryptedToken(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

export function encryptToken(value: string): string {
  if (isEncryptedToken(value)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptToken(value: string): string {
  if (!isEncryptedToken(value)) return value; // rollout compatibility for existing rows
  const parts = value.split(":");
  if (parts.length !== 5) throw new Error("Invalid encrypted OAuth token");
  const [, , ivRaw, tagRaw, ciphertextRaw] = parts;
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
