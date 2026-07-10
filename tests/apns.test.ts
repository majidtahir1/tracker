import test from "node:test";
import assert from "node:assert/strict";
import { buildApnsPayload, isApnsConfigured, sendPushToUser } from "../lib/push/apns";

test("buildApnsPayload shapes the aps alert + sound + href", () => {
  const payload = buildApnsPayload({ title: "Recovery is low", body: "Score 31/100.", href: "/recovery" });
  assert.deepEqual(payload, {
    aps: { alert: { title: "Recovery is low", body: "Score 31/100." }, sound: "default" },
    href: "/recovery",
  });
});

test("buildApnsPayload omits body when not provided", () => {
  const payload = buildApnsPayload({ title: "Title only" });
  assert.equal(payload.aps.alert.title, "Title only");
  assert.equal(payload.aps.alert.body, undefined);
  assert.equal(payload.href, undefined);
  assert.equal(payload.aps.sound, "default");
});

test("isApnsConfigured is false when env is unset", () => {
  const saved = {
    key: process.env.APNS_KEY_ID,
    team: process.env.APNS_TEAM_ID,
    auth: process.env.APNS_AUTH_KEY,
  };
  delete process.env.APNS_KEY_ID;
  delete process.env.APNS_TEAM_ID;
  delete process.env.APNS_AUTH_KEY;

  try {
    assert.equal(isApnsConfigured(), false);
  } finally {
    if (saved.key !== undefined) process.env.APNS_KEY_ID = saved.key;
    if (saved.team !== undefined) process.env.APNS_TEAM_ID = saved.team;
    if (saved.auth !== undefined) process.env.APNS_AUTH_KEY = saved.auth;
  }
});

test("isApnsConfigured is false when only some env vars are set", () => {
  const saved = { key: process.env.APNS_KEY_ID, auth: process.env.APNS_AUTH_KEY };
  delete process.env.APNS_TEAM_ID;
  process.env.APNS_KEY_ID = "ABC123";
  process.env.APNS_AUTH_KEY = "";

  try {
    assert.equal(isApnsConfigured(), false);
  } finally {
    if (saved.key !== undefined) process.env.APNS_KEY_ID = saved.key;
    else delete process.env.APNS_KEY_ID;
    if (saved.auth !== undefined) process.env.APNS_AUTH_KEY = saved.auth;
    else delete process.env.APNS_AUTH_KEY;
  }
});

test("sendPushToUser is a dormant no-op with no APNs env configured", async () => {
  delete process.env.APNS_KEY_ID;
  delete process.env.APNS_TEAM_ID;
  delete process.env.APNS_AUTH_KEY;

  await assert.doesNotReject(sendPushToUser("nonexistent-user", { title: "t" }));
});
