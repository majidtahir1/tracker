import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";

import { decryptToken, encryptToken, isEncryptedToken } from "../lib/security/token-crypto";

test("OAuth tokens round-trip through authenticated encryption", () => {
  const previous = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  process.env.OAUTH_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    const encrypted = encryptToken("secret-refresh-token");
    assert.equal(isEncryptedToken(encrypted), true);
    assert.notEqual(encrypted, "secret-refresh-token");
    assert.equal(decryptToken(encrypted), "secret-refresh-token");
  } finally {
    if (previous === undefined) delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    else process.env.OAUTH_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test("legacy plaintext remains readable during migration", () => {
  assert.equal(decryptToken("legacy-token"), "legacy-token");
});

test("tampering is rejected by the GCM authentication tag", () => {
  const previous = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  process.env.OAUTH_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    const encrypted = encryptToken("secret");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
    assert.throws(() => decryptToken(tampered));
  } finally {
    if (previous === undefined) delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    else process.env.OAUTH_TOKEN_ENCRYPTION_KEY = previous;
  }
});
