import test from "node:test";
import assert from "node:assert/strict";
import { aiConsentUpdate } from "../lib/ai/consent";
import { AI_CONSENT_COPY } from "../lib/ai/consent-copy";

test("aiConsentUpdate grant stamps both timestamps", () => {
  const now = "2026-07-27T12:00:00.000Z";
  assert.deepEqual(aiConsentUpdate(true, now), {
    aiDataSharingEnabled: true,
    aiDataConsentAt: now,
    aiConsentDecidedAt: now,
  });
});

test("consent copy names the recipient and discloses all data categories sent", () => {
  const all = [AI_CONSENT_COPY.intro, ...AI_CONSENT_COPY.sends, AI_CONSENT_COPY.recipient].join(" ");
  assert.match(all, /MiniMax/);
  assert.match(all, /workout/i);
  assert.match(all, /recovery|sleep/i);
  assert.match(all, /injur/i); // program-builder intake free text
  assert.match(all, /display name/i); // program-builder greeting name
  assert.match(all, /Settings/); // where to change the decision
});

test("consent copy states what is never sent", () => {
  const all = [AI_CONSENT_COPY.intro, ...AI_CONSENT_COPY.sends, AI_CONSENT_COPY.recipient].join(" ");
  assert.match(all, /username|photos|tokens/i);
});

test("aiConsentUpdate decline clears consent time but records the decision", () => {
  const now = "2026-07-27T12:00:00.000Z";
  assert.deepEqual(aiConsentUpdate(false, now), {
    aiDataSharingEnabled: false,
    aiDataConsentAt: null,
    aiConsentDecidedAt: now,
  });
});
