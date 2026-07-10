import test from "node:test";
import assert from "node:assert/strict";
import { nextTemplateIndex } from "../lib/schedule";

// ---------- nextTemplateIndex (shared next-workout rotation) ----------

test("nextTemplateIndex starts at 0 with no completed history", () => {
  const templates = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(nextTemplateIndex(templates, null), 0);
  assert.equal(nextTemplateIndex(templates, undefined), 0);
});

test("nextTemplateIndex advances past the last completed template", () => {
  const templates = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(nextTemplateIndex(templates, "a"), 1);
  assert.equal(nextTemplateIndex(templates, "b"), 2);
});

test("nextTemplateIndex wraps around after the last day", () => {
  const templates = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(nextTemplateIndex(templates, "c"), 0);
});

test("nextTemplateIndex falls back to 0 for unknown templates (program switched)", () => {
  const templates = [{ id: "a" }, { id: "b" }];
  assert.equal(nextTemplateIndex(templates, "zzz"), 0);
});

test("nextTemplateIndex returns -1 for an empty program", () => {
  assert.equal(nextTemplateIndex([], "a"), -1);
});
