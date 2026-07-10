import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { photosDir, contentTypeForFilename, resolveSafe } from "../lib/photos-storage";

test("photosDir honors PHOTOS_DIR env", () => {
  const prev = process.env.PHOTOS_DIR;
  process.env.PHOTOS_DIR = "/srv/photos";
  assert.equal(photosDir(), "/srv/photos");
  if (prev === undefined) delete process.env.PHOTOS_DIR;
  else process.env.PHOTOS_DIR = prev;
});

test("contentTypeForFilename maps known extensions, else octet-stream", () => {
  assert.equal(contentTypeForFilename("a.jpg"), "image/jpeg");
  assert.equal(contentTypeForFilename("a.jpeg"), "image/jpeg");
  assert.equal(contentTypeForFilename("a.PNG"), "image/png"); // case-insensitive
  assert.equal(contentTypeForFilename("a.webp"), "image/webp");
  assert.equal(contentTypeForFilename("a.heic"), "image/heic");
  assert.equal(contentTypeForFilename("a.gif"), "application/octet-stream");
  assert.equal(contentTypeForFilename("noext"), "application/octet-stream");
});

test("resolveSafe accepts a plain filename under photosDir", () => {
  const prev = process.env.PHOTOS_DIR;
  process.env.PHOTOS_DIR = "/srv/photos";
  assert.equal(
    resolveSafe("2026-07-06-front-ab12cd34.jpg"),
    path.join("/srv/photos", "2026-07-06-front-ab12cd34.jpg"),
  );
  if (prev === undefined) delete process.env.PHOTOS_DIR;
  else process.env.PHOTOS_DIR = prev;
});

test("resolveSafe rejects traversal, separators, and empty", () => {
  assert.equal(resolveSafe("../secrets"), null);
  assert.equal(resolveSafe("a/b.jpg"), null);
  assert.equal(resolveSafe("..\\x"), null);
  assert.equal(resolveSafe("dir/../../etc/passwd"), null);
  assert.equal(resolveSafe(""), null);
});
