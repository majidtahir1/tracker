# Path 2 — Postgres + Object Storage Migration (scalability) — Design

**Date:** 2026-07-10
**Status:** Plan (not started). Optional — only needed to scale beyond a single instance.

## When you need this

Path 1 (SQLite on a mounted volume, single container) is fine for personal/small
use. Migrate to Path 2 when you want any of:

- **Horizontal scaling / HA** — more than one app instance, rolling deploys with
  zero downtime, or a managed platform (Vercel/Fly Machines/K8s) whose filesystem
  is ephemeral/read-only (incompatible with file-SQLite and local-disk photos).
- **Managed backups / PITR** on the database.
- **Photos on durable, offloaded storage** (CDN, lifecycle rules) instead of a
  host disk.

If none of these apply, **don't do this** — it adds moving parts (YAGNI).

## Two independent migrations

They can ship separately; do the database first (bigger risk), photos second.

### A. Database: SQLite → Postgres

**Current state**
- `prisma/schema.prisma`: `datasource db { provider = "sqlite" }`; client generated
  to `lib/generated/prisma`.
- `lib/db.ts`: `PrismaBetterSqlite3` adapter, `url` from `DATABASE_URL` (default
  `file:./prisma/dev.db`).
- Auth adapter: `prismaAdapter(prisma, { provider: "sqlite" })` in `lib/auth.ts`.

**Target**
- Managed Postgres (Neon, Supabase, or self-hosted Postgres container on the home
  lab with its own volume). Prisma 7 with the Postgres driver adapter
  (`@prisma/adapter-pg` + `pg`) or the plain `provider = "postgresql"` client.

**Steps**
1. Add `provider = "postgresql"` datasource; swap `lib/db.ts` to the pg adapter;
   change the better-auth adapter provider to `"postgresql"`.
2. **Type audit** — SQLite is permissive; Postgres is strict. Review every model
   for: `DateTime` storage (SQLite stored as text/number), `Boolean` (SQLite int
   0/1), `Json` fields, and any `Int`/`BigInt` used for timestamps. Fix column
   types and app-level assumptions. Grep the `lib/queries/*` and `lib/actions/*`
   for raw comparisons that relied on SQLite text-sortable dates.
3. Generate an initial migration against an empty Postgres db (`prisma migrate
   dev` — this repo currently uses `db push`; Path 2 is a good moment to adopt a
   migration history).
4. **Data migration** — export existing rows from `tracker.db` and load into
   Postgres. Options: a one-off Node script using both Prisma clients (read from
   SQLite, write to Postgres in FK-safe order: users → per-user rows → tokens),
   or `pgloader`. Validate row counts per table and spot-check WHOOP tokens and
   a full user's workout history.
5. **Auth/session note** — sessions live in the DB; migrating them preserves
   logins. If you skip session rows, users just re-login.
6. Cut over: point `DATABASE_URL` at Postgres, deploy, keep the SQLite file as a
   backup until verified.

**Risks**
- Timestamp/boolean coercion is the classic SQLite→PG break. Budget testing here.
- The custom generated-client path (`lib/generated/prisma`) must regenerate for
  the new provider (postinstall handles it).
- Concurrency semantics change (SQLite single-writer → PG MVCC); unlikely to
  affect this app but review any read-modify-write in server actions.

### B. Photos: local disk → object storage (S3 / Cloudflare R2)

**Current state**
- `app/api/photos/route.ts` writes multipart uploads to
  `path.join(process.cwd(), "public", "photos")` via `node:fs/promises`, deletes
  on replace, and stores the `/photos/<name>` path in the `MeasurementPhoto` (or
  equivalent) row. Files are served statically and **unauthenticated**.

**Target**
- An S3-compatible bucket (AWS S3, Cloudflare R2, MinIO on the home lab).
- Upload via the AWS SDK (`@aws-sdk/client-s3`) or presigned PUT from the client.
- **Serve through an authenticated route** (presigned GET or a proxy handler that
  checks the session) — fixes the current public-photo exposure in the same move.

**Steps**
1. Add the S3 client + bucket env (`S3_ENDPOINT`, `S3_BUCKET`, keys).
2. Rewrite the POST handler to stream to the bucket; store the object key in the
   DB instead of a public path.
3. Add `GET /api/photos/[id]` that authorizes the requesting user and returns a
   presigned URL (or streams the object). Update the photos UI to use it.
4. Remove the `public/photos` static exclusion from `proxy.ts`.
5. Migrate existing files: upload everything under `./photos` to the bucket,
   rewrite stored paths → keys.

**Risks**
- Don't break the replace/delete logic (currently unlinks the old file).
- Presigned URL expiry vs. how long the UI holds them.

## Rollout

Database and photos each get their own branch → spec is already here → write an
implementation plan per part (`writing-plans`) → execute. Keep the SQLite DB and
local photos as the rollback until each cutover is verified in production.

## Out of scope

- Multi-region, read replicas, sharding — not warranted at this app's scale.
- Changing the server-actions architecture (no REST/tRPC layer needed).
