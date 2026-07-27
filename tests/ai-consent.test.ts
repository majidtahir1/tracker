import test from "node:test";
import assert from "node:assert/strict";
import { aiConsentUpdate } from "../lib/ai/consent";

test("aiConsentUpdate grant stamps both timestamps", () => {
  const now = "2026-07-27T12:00:00.000Z";
  assert.deepEqual(aiConsentUpdate(true, now), {
    aiDataSharingEnabled: true,
    aiDataConsentAt: now,
    aiConsentDecidedAt: now,
  });
});

test("aiConsentUpdate decline clears consent time but records the decision", () => {
  const now = "2026-07-27T12:00:00.000Z";
  assert.deepEqual(aiConsentUpdate(false, now), {
    aiDataSharingEnabled: false,
    aiDataConsentAt: null,
    aiConsentDecidedAt: now,
  });
});
