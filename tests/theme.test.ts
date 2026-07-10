import test from "node:test";
import assert from "node:assert/strict";
import {
  THEME_STORAGE_KEY,
  resolveStoredTheme,
  oppositeTheme,
  THEME_INIT_SCRIPT,
} from "../lib/theme";

test("storage key is 'theme'", () => {
  assert.equal(THEME_STORAGE_KEY, "theme");
});

test("resolveStoredTheme accepts valid values", () => {
  assert.equal(resolveStoredTheme("light"), "light");
  assert.equal(resolveStoredTheme("dark"), "dark");
});

test("resolveStoredTheme rejects anything else as null", () => {
  assert.equal(resolveStoredTheme(null), null);
  assert.equal(resolveStoredTheme(""), null);
  assert.equal(resolveStoredTheme("DARK"), null);
  assert.equal(resolveStoredTheme("system"), null);
});

test("oppositeTheme flips", () => {
  assert.equal(oppositeTheme("light"), "dark");
  assert.equal(oppositeTheme("dark"), "light");
});

test("init script references the storage key and sets data-theme", () => {
  assert.match(THEME_INIT_SCRIPT, /localStorage/);
  assert.match(THEME_INIT_SCRIPT, /theme/);
  assert.match(THEME_INIT_SCRIPT, /dataset\.theme|data-theme/);
  // must be self-contained (no imports) and defensive
  assert.match(THEME_INIT_SCRIPT, /try/);
});
