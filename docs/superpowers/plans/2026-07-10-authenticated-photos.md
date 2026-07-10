# Authenticated Progress-Photo Serving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve progress photos only through an authenticated, ownership-checked route, with files stored outside the public web root.

**Architecture:** Photo files move from `public/photos/` to a private `PHOTOS_DIR`; `ProgressPhoto.filePath` stores the bare filename. A new `GET /api/photos/[id]` route checks session + ownership and streams the file. Upload/delete/render/middleware are updated to match.

**Tech Stack:** Next.js 16 (App Router, Node runtime route handlers), Prisma 7 (SQLite), better-auth. Tests: `node:test` + `node:assert` via `npm test`.

## Global Constraints

- No new npm dependencies.
- Photo files must NOT live under `public/`. Storage dir = `PHOTOS_DIR` env, default `./var/photos`.
- `ProgressPhoto.filePath` stores the **bare filename** (e.g. `2026-07-06-front-ab12cd34.jpg`), not a path. No Prisma schema migration (SQLite; existing photos are disposable).
- The serving route returns `401` with no session and `404` for not-found / not-owned / missing-file / traversal — identical `404` body so existence isn't leaked.
- `Cache-Control: private, max-age=3600` on served images (per-user private data).
- Tests run with `npm test` (`TZ=America/New_York tsx --test tests/*.test.ts`).

---

## File Structure

- **Create** `lib/photos-storage.ts` — `photosDir()`, `contentTypeForFilename()`, `resolveSafe()`. Pure/near-pure, unit-tested.
- **Create** `tests/photos-storage.test.ts` — unit tests for the above.
- **Create** `app/api/photos/[id]/route.ts` — authenticated `GET` streaming route.
- **Modify** `app/api/photos/route.ts` — upload writes to `photosDir()`, stores bare filename.
- **Modify** `lib/actions/tracking.ts` — delete unlinks from `photosDir()` via `resolveSafe`.
- **Modify** `app/photos/page.tsx` — `<img src>` → `/api/photos/<id>`.
- **Modify** `proxy.ts` — matcher: drop `photos/`, add `api/photos`.
- **Modify** `prisma/schema.prisma` — `filePath` comment.
- **Modify** `.env.example` (document `PHOTOS_DIR`), `.gitignore` (add `/var/`).

---

## Task 1: Storage helpers (`lib/photos-storage.ts`)

**Files:**
- Create: `lib/photos-storage.ts`
- Test: `tests/photos-storage.test.ts`

**Interfaces:**
- Produces:
  - `function photosDir(): string` — `process.env.PHOTOS_DIR ?? path.join(process.cwd(), "var", "photos")`.
  - `function contentTypeForFilename(name: string): string` — ext→mime; `application/octet-stream` default.
  - `function resolveSafe(filename: string): string | null` — absolute path under `photosDir()` for a plain filename, or `null` if unsafe.

- [ ] **Step 1: Write the failing test**

Create `tests/photos-storage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../lib/photos-storage`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/photos-storage.ts`:

```ts
/** Private storage location + MIME/path helpers for progress photos. */
import path from "node:path";

/** Absolute directory where progress-photo files are stored (outside public/). */
export function photosDir(): string {
  return process.env.PHOTOS_DIR ?? path.join(process.cwd(), "var", "photos");
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

/** MIME type from a filename's extension; octet-stream for unknown. */
export function contentTypeForFilename(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/**
 * Absolute path for a bare photo filename under photosDir(), or null if the
 * name is unsafe. A bare filename cannot escape the dir, so rejecting path
 * separators, "..", and NUL is sufficient.
 */
export function resolveSafe(filename: string): string | null {
  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0") ||
    filename.includes("..")
  ) {
    return null;
  }
  return path.join(photosDir(), filename);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (new photos-storage tests green; existing suites unaffected).

- [ ] **Step 5: Commit**

```bash
git add lib/photos-storage.ts tests/photos-storage.test.ts
git commit -m "feat: private photo storage helpers (dir, mime, safe-resolve)"
```

---

## Task 2: Authenticated serving route (`app/api/photos/[id]/route.ts`)

**Files:**
- Create: `app/api/photos/[id]/route.ts`

**Interfaces:**
- Consumes: `photosDir`/`contentTypeForFilename`/`resolveSafe` from `@/lib/photos-storage`, `prisma` from `@/lib/db`, `auth` from `@/lib/auth`.
- Produces: `GET /api/photos/[id]` — streams the owned photo or returns `401`/`404`.

This route needs a DB + session + filesystem, so it is verified manually (Step 3), not by a unit test — matching the repo convention that unit tests cover pure `lib/` code.

- [ ] **Step 1: Write the route**

Create `app/api/photos/[id]/route.ts`:

```ts
/**
 * GET /api/photos/[id] — authenticated, ownership-checked progress-photo bytes.
 * 401 without a session; 404 for not-found / not-owned / missing file / unsafe
 * name (identical 404 so existence isn't leaked). Files live under PHOTOS_DIR.
 */
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { contentTypeForFilename, resolveSafe } from "@/lib/photos-storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const photo = await prisma.progressPhoto.findUnique({ where: { id } });
  if (!photo || photo.userId !== session.user.id) {
    return new NextResponse(null, { status: 404 });
  }

  const abs = resolveSafe(photo.filePath);
  if (!abs) return new NextResponse(null, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(abs);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForFilename(photo.filePath),
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from `app/api/photos/[id]/route.ts`. (Note: Next 16 provides `params` as a `Promise` — the `await params` above is correct.)

- [ ] **Step 3: Commit**

```bash
git add "app/api/photos/[id]/route.ts"
git commit -m "feat: authenticated ownership-checked photo serving route"
```

(End-to-end verification of this route happens in Task 4 once uploads write bare filenames and the page points at it.)

---

## Task 3: Uploads & deletes use the private dir (`app/api/photos/route.ts`, `lib/actions/tracking.ts`)

**Files:**
- Modify: `app/api/photos/route.ts`
- Modify: `lib/actions/tracking.ts`

**Interfaces:**
- Consumes: `photosDir`, `resolveSafe` from `@/lib/photos-storage`.
- Produces: uploaded files land in `photosDir()`; `ProgressPhoto.filePath` holds the bare filename; delete unlinks from `photosDir()`.

- [ ] **Step 1: Update the upload route to write to the private dir and store the bare filename**

In `app/api/photos/route.ts`, add to the imports (below the existing `import { auth } from "@/lib/auth";`):

```ts
import { photosDir, resolveSafe } from "@/lib/photos-storage";
```

Replace this block:

```ts
  const photosDir = path.join(process.cwd(), "public", "photos");
  await mkdir(photosDir, { recursive: true });

  const saved: Array<{ id: string; angle: string; filePath: string }> = [];
  for (const { angle, file, ext } of files) {
    const name = `${date}-${angle.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filePath = `/photos/${name}`;
    await writeFile(path.join(photosDir, name), Buffer.from(await file.arrayBuffer()));

    // Replacing the same user+date+angle: keep the unique row, remove the old file.
    const existing = await prisma.progressPhoto.findUnique({
      where: { userId_date_angle: { userId, date, angle } },
    });

    const row = await prisma.progressPhoto.upsert({
      where: { userId_date_angle: { userId, date, angle } },
      update: { filePath, weight, bodyFat, notes },
      create: { userId, date, angle, filePath, weight, bodyFat, notes },
    });

    if (existing && existing.filePath !== filePath) {
      const old = path.resolve(path.join(process.cwd(), "public", existing.filePath));
      if (old.startsWith(photosDir + path.sep)) {
        try {
          await unlink(old);
        } catch {
          // already gone
        }
      }
    }

    saved.push({ id: row.id, angle, filePath });
  }
```

with:

```ts
  const dir = photosDir();
  await mkdir(dir, { recursive: true });

  const saved: Array<{ id: string; angle: string; filePath: string }> = [];
  for (const { angle, file, ext } of files) {
    const name = `${date}-${angle.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

    // Replacing the same user+date+angle: keep the unique row, remove the old file.
    const existing = await prisma.progressPhoto.findUnique({
      where: { userId_date_angle: { userId, date, angle } },
    });

    const row = await prisma.progressPhoto.upsert({
      where: { userId_date_angle: { userId, date, angle } },
      update: { filePath: name, weight, bodyFat, notes },
      create: { userId, date, angle, filePath: name, weight, bodyFat, notes },
    });

    if (existing && existing.filePath !== name) {
      const old = resolveSafe(existing.filePath);
      if (old) {
        try {
          await unlink(old);
        } catch {
          // already gone
        }
      }
    }

    saved.push({ id: row.id, angle, filePath: name });
  }
```

(`path` is still used for `path.join(dir, name)`, so keep its import. `mkdir`, `writeFile`, `unlink`, `crypto` imports stay.)

- [ ] **Step 2: Update the delete action to unlink from the private dir**

In `lib/actions/tracking.ts`, replace this block inside `deletePhoto` (currently ~lines 208-217):

```ts
  // Remove the file — only ever touch files inside public/photos.
  const photosDir = path.join(process.cwd(), "public", "photos");
  const abs = path.resolve(path.join(process.cwd(), "public", photo.filePath));
  if (abs.startsWith(photosDir + path.sep)) {
    try {
      await unlink(abs);
    } catch {
      // File already gone — the DB row is the source of truth.
    }
  }
```

with:

```ts
  // Remove the file — resolveSafe guards against anything outside the photos dir.
  const abs = resolveSafe(photo.filePath);
  if (abs) {
    try {
      await unlink(abs);
    } catch {
      // File already gone — the DB row is the source of truth.
    }
  }
```

Then update imports in `lib/actions/tracking.ts`: **remove** `import path from "node:path";` (now unused — it was only used in the block above), keep `import { unlink } from "node:fs/promises";`, and add:

```ts
import { resolveSafe } from "@/lib/photos-storage";
```

- [ ] **Step 3: Typecheck (catches any now-unused import)**

Run: `npx tsc --noEmit`
Expected: no errors. If it flags `path` as unused in `tracking.ts`, confirm the import line was removed.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: all suites pass (no behavior change to tested pure code).

- [ ] **Step 5: Commit**

```bash
git add app/api/photos/route.ts lib/actions/tracking.ts
git commit -m "feat: store/delete progress photos in private PHOTOS_DIR (bare filenames)"
```

---

## Task 4: Point rendering + middleware at the route; wire config; verify end-to-end

**Files:**
- Modify: `app/photos/page.tsx`
- Modify: `proxy.ts`
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`, `.gitignore`

**Interfaces:**
- Consumes: `GET /api/photos/[id]` from Task 2.

- [ ] **Step 1: Render images via the authenticated route**

In `app/photos/page.tsx`, change the `<img>` source (currently line ~71):

```tsx
                            <img
                              src={photo.filePath}
```

to:

```tsx
                            <img
                              src={`/api/photos/${photo.id}`}
```

(`photo.id` is already present on the object — it's used two lines above for `DeletePhotoButton photoId={photo.id}`.)

- [ ] **Step 2: Update the middleware matcher**

In `proxy.ts`, change the matcher from:

```ts
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|photos/|.*\\..*).*)"],
```

to:

```ts
  matcher: ["/((?!api/auth|api/photos|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
```

(Drops the now-defunct `photos/` static exclusion; adds `api/photos` so the route returns its own `401` instead of a login redirect.)

- [ ] **Step 3: Update the schema comment**

In `prisma/schema.prisma`, change the `ProgressPhoto.filePath` line comment from:

```prisma
  filePath String // relative to /public, e.g. "/public/photos/2026-07-06-front.jpg"
```

to:

```prisma
  filePath String // bare filename, stored under PHOTOS_DIR, e.g. "2026-07-06-front-ab12cd34.jpg"
```

(Match the exact existing comment text when editing; the column type is unchanged, so no `prisma db push` is required for this comment.)

- [ ] **Step 4: Document the env var and ignore the dev dir**

Append to `.env.example`:

```bash

# Private directory for progress-photo files (served only via /api/photos/[id]).
# Dev default is ./var/photos when unset. In production set an absolute path on
# a persistent volume, e.g. /data/photos.
PHOTOS_DIR=
```

Add to `.gitignore` (below the existing `/public/photos/` line):

```gitignore

# private progress-photo storage (dev)
/var/
```

- [ ] **Step 5: Cutover — clear disposable old photos**

Existing rows use the old path scheme and their files sit in `public/photos`. Remove both so nothing dangles:

```bash
rm -rf public/photos/*
# delete existing ProgressPhoto rows (disposable pre-launch data)
npx prisma db execute --stdin <<'SQL'
DELETE FROM "ProgressPhoto";
SQL
```

- [ ] **Step 6: Verify end-to-end in the browser**

Run: `npm run dev`, then:
1. Log in, go to `/photos`, upload a photo for a date/angle → it saves and displays.
2. Confirm the file landed in `./var/photos/` (not `public/photos/`): `ls var/photos`.
3. Confirm the `<img>` requests `/api/photos/<id>` (DevTools Network) and returns `200 image/*` with `Cache-Control: private, max-age=3600`.
4. Copy a photo's id; in a private window (logged out) `curl -i http://localhost:3000/api/photos/<id>` → **401**.
5. While logged in, `curl` a random/other id → **404**.
6. Delete the photo in the UI → row gone and `var/photos` file removed.

- [ ] **Step 7: Typecheck, test, commit**

Run: `npx tsc --noEmit` (clean) and `npm test` (all pass).

```bash
git add app/photos/page.tsx proxy.ts prisma/schema.prisma .env.example .gitignore
git commit -m "feat: serve photos via authenticated route; drop public/photos exposure"
```

---

## Final verification (whole feature)

- [ ] `npm test` — all suites pass (including `tests/photos-storage.test.ts`).
- [ ] `npx tsc --noEmit` — no type errors.
- [ ] Upload → file in `var/photos`, DB `filePath` is a bare filename, image renders via `/api/photos/<id>`.
- [ ] Logged-out request to `/api/photos/<id>` → `401`; other user's / unknown id → `404`.
- [ ] No file is reachable under `/photos/...` anymore (the static exclusion is gone and nothing is written to `public/photos`).
- [ ] Delete removes both the row and the file.

## Coordination note (cross-branch, not code in this plan)

When this branch and the deploy scaffold (PR #6, `deploy-home-lab`) both merge, update on the deploy side:
- `docker-compose.yml` mount `./photos:/app/public/photos` → `./photos:/data/photos`
- add `PHOTOS_DIR=/data/photos` to the app environment
- `.env.production.example` — document `PHOTOS_DIR`
- `DEPLOYMENT.md` §2 — mark the "photos served unauthenticated" item resolved.
