# Authenticated Progress-Photo Serving — Design

**Date:** 2026-07-10
**Status:** Approved design, pending implementation plan
**Branch:** `photos-auth` (off `main`, independent of PR #5 light-mode and PR #6 deploy)

## Goal

Progress photos (body/health imagery) are currently served **unauthenticated**: files
live in `public/photos/` and are served statically, and `proxy.ts` explicitly excludes
`photos/` from the auth middleware. Anyone who knows/guesses a URL can fetch them. Close
this by serving every photo through a single **authenticated, ownership-checked** route
and moving the files out of the public web root.

## Current state (as explored)

- **Upload** — `app/api/photos/route.ts` (`POST /api/photos`, Node runtime) checks the
  session, then writes files to `path.join(process.cwd(), "public", "photos")` and upserts
  `ProgressPhoto` rows (`@@unique([userId, date, angle])`). Filenames:
  `<date>-<angle>-<8hex>.<ext>`.
- **Storage/DB** — `ProgressPhoto.filePath` stores a public path like `/photos/<name>`
  (schema comment: "relative to /public"). Model has `userId`, `@@index([userId])`.
- **Render** — `app/photos/page.tsx:71` renders `<img src={photo.filePath}>`. This is the
  only render site (grep-confirmed).
- **Delete** — `lib/actions/tracking.ts:210` resolves `public/ + filePath` and `unlink`s.
- **Middleware** — `proxy.ts` matcher: `["/((?!api/auth|_next/static|_next/image|favicon.ico|photos/|.*\\..*).*)"]`
  — note the `photos/` exclusion, and `api/auth` is the only excluded API.

**Root cause:** a file physically under `public/` is served by Next's static handler and is
reachable by URL regardless of middleware. Gating requires the file to NOT be in `public/`.

## Decisions (from brainstorming)

- **Approach A** — private storage dir + authenticated streaming route. (Not middleware
  gating of public files, which is fragile; not signed URLs, which are overkill when every
  view is inside an authenticated session.)
- **Existing photos are disposable** — pre-launch dev data. No migration script; wipe old
  rows + `public/photos` files on cutover.

## Architecture

**Private storage.** Files move to `PHOTOS_DIR` (env), never under `public/`:
- Dev default: `./var/photos` (gitignored).
- Prod: `/data/photos` on a mounted volume (see Coordination note).

**DB semantics change (no schema migration).** `ProgressPhoto.filePath` stores the **bare
filename** (e.g. `2026-07-06-front-ab12cd34.jpg`) instead of `/photos/<name>`. Same column;
update the schema comment. No Prisma migration needed (SQLite, disposable data).

**One authenticated serving route** — `GET /api/photos/[id]` (Node runtime):
1. `session = auth.api.getSession({ headers })`; if none → `401`.
2. `photo = prisma.progressPhoto.findUnique({ where: { id } })`; if `!photo` **or**
   `photo.userId !== session.user.id` → `404` (identical response, no existence leak).
3. `abs = resolveSafe(photo.filePath)` (join under `PHOTOS_DIR`, reject traversal); if the
   resolved path escapes `PHOTOS_DIR` or the file is missing → `404`.
4. Stream the bytes: `Content-Type` from the filename extension,
   `Cache-Control: private, max-age=3600`, `Content-Length`.

This route is the single serving choke-point Path 2 later repoints at presigned object
storage.

## Components & interfaces

**New**
- `lib/photos-storage.ts` — pure/near-pure helpers:
  - `photosDir(): string` — `process.env.PHOTOS_DIR ?? path.join(process.cwd(), "var", "photos")`.
  - `contentTypeForFilename(name: string): string` — ext→mime for `jpg|jpeg|png|webp|heic`
    (default `application/octet-stream`).
  - `resolveSafe(filename: string): string | null` — returns the absolute path under
    `photosDir()` for a plain filename, or `null` if it contains a path separator / `..` /
    resolves outside `photosDir()`.
- `app/api/photos/[id]/route.ts` — the `GET` route above. `export const runtime = "nodejs"`.

**Modified**
- `app/api/photos/route.ts` (upload) — write to `photosDir()` (mkdir recursive); store the
  bare filename in `filePath`. Delete-on-replace unlinks from `photosDir()`.
- `lib/actions/tracking.ts` (delete action, ~line 210) — unlink `path.join(photosDir(), filePath)`.
- `app/photos/page.tsx:71` — `src={photo.filePath}` → ``src={`/api/photos/${photo.id}`}``.
- `proxy.ts` — matcher becomes
  `["/((?!api/auth|api/photos|_next/static|_next/image|favicon.ico|.*\\..*).*)"]`
  (drop `photos/`, add `api/photos` so the route returns a real `401` rather than a redirect).
- `prisma/schema.prisma` — `filePath` comment → "bare filename, stored under PHOTOS_DIR".
- `.env.example` — document `PHOTOS_DIR`.
- `.gitignore` — add `/var/`.

## Data flow

- **Upload:** client → `POST /api/photos` (authed) → write to `PHOTOS_DIR`, upsert row with
  filename → `201`.
- **View:** authed page renders `<img src=/api/photos/<id>>` → browser GET → route checks
  session + ownership → streams bytes.
- **Delete:** server action → unlink `PHOTOS_DIR/<filename>` + delete row.

## Cutover (disposable data)

On deploy of this change: delete existing `ProgressPhoto` rows and remove the old
`public/photos/*` files (one-off; old rows use the previous path scheme and won't resolve).
Document as a manual step; not code.

## Error handling

- `401` no session · `404` not found / not owned / file missing / traversal attempt ·
  existing `400`s on upload validation unchanged.

## Testing

- **TDD `lib/photos-storage.ts`** (`node:test`, pure):
  - `contentTypeForFilename`: `.jpg`/`.jpeg`→`image/jpeg`, `.png`→`image/png`,
    `.webp`→`image/webp`, `.heic`→`image/heic`, unknown→`application/octet-stream`.
  - `resolveSafe`: accepts `2026-07-06-front-ab12cd34.jpg`; returns `null` for
    `../secrets`, `a/b.jpg`, `..\\x`, absolute paths.
- **Route auth/ownership** (needs DB + fs) — verified manually during implementation:
  owner sees the image; logged-out `GET /api/photos/<id>` → `401`; another user's id → `404`;
  a valid id whose file was removed → `404`.

## Coordination note (cross-branch)

The deploy scaffold (PR #6, branch `deploy-home-lab`) mounts photos at
`./photos:/app/public/photos`. When this and the deploy work both merge, update:
- `docker-compose.yml` mount → `./photos:/data/photos`
- add `PHOTOS_DIR=/data/photos` to the app environment
- `.env.production.example` → document `PHOTOS_DIR`
- `DEPLOYMENT.md` §2 — mark the "photos served unauthenticated" hardening item as resolved.

## Out of scope

- Object-storage migration (Path 2 spec) — this route is the seam for it.
- Native camera capture (separate spec) — this change is orthogonal to how photos are captured.
- Signed/expiring URLs, thumbnails, image resizing/optimization.
