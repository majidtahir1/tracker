# User Logins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-user support: username + password login via Better Auth, all personal data scoped by `userId`, shared exercise/program catalog, existing data migrated to the owner's account.

**Architecture:** Better Auth (Prisma adapter, username plugin) owns `User`/`Session`/`Account`/`Verification` tables and the `/api/auth/*` endpoints. A `requireUserId()` helper enforces auth in the data layer (every function in `lib/queries/*` and `lib/actions/*`). Schema migration is two-phase: add nullable `userId` columns → backfill via a one-time script (owner account created through `auth.api.signUpEmail`) → flip columns to required and drop the old global flags (`Exercise.isFavorite`, `Program.isActive`).

**Tech Stack:** Next.js 16 (App Router; middleware is called **proxy** — `proxy.ts`), Prisma 7 (driver adapter `@prisma/adapter-better-sqlite3`, client generated to `lib/generated/prisma`), SQLite, better-auth ^1.6.

**Spec:** `docs/superpowers/specs/2026-07-03-user-logins-design.md`

## Global Constraints

- This repo's Next.js 16 differs from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (`01-app/01-getting-started/16-proxy.md`, `02-guides/authentication.md`, `15-route-handlers.md`).
- Prisma client is generated to `lib/generated/prisma` — import `PrismaClient` from `@/lib/generated/prisma/client`, NEVER from `@prisma/client`. Always use the existing `prisma` singleton from `@/lib/db` for app code.
- After schema edits run `npx prisma db push` (dev db `prisma/dev.db` contains REAL data — never reset it) then `npx prisma generate`.
- Every task must end with `npm run build` succeeding and `npm test` passing (tests: `TZ=America/New_York tsx --test tests/*.test.ts`).
- All action files start with `"use server"`. Queries are plain async functions called from server components.
- Commit after each task with a conventional message.
- Verification scripts and temp files go in `scripts/` (checked in) — the repo has no scripts dir yet; create it.

---

### Task 1: Better Auth foundation (server instance, schema tables, route handler, client)

**Files:**
- Modify: `package.json` (dependency)
- Create: `lib/auth.ts`
- Create: `lib/auth-client.ts`
- Create: `app/api/auth/[...all]/route.ts`
- Modify: `prisma/schema.prisma` (Better Auth models — CLI-generated, then hand-adjusted)
- Create: `.env` additions + `.env.example` additions
- Create: `scripts/verify-auth.ts`

**Interfaces:**
- Produces: `auth` (Better Auth server instance) exported from `@/lib/auth`; `authClient` from `@/lib/auth-client`; Prisma models `User`, `Session`, `Account`, `Verification`.
- Later tasks rely on: `auth.api.getSession({ headers })` and `auth.api.signUpEmail({ body })`.

- [ ] **Step 1: Install better-auth**

```bash
npm install better-auth
```

- [ ] **Step 2: Add env vars**

Append to `.env` (create if missing) and `.env.example`:

```bash
# Better Auth
BETTER_AUTH_SECRET=<generate: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
```

For `.env` generate a real secret (`openssl rand -base64 32`); in `.env.example` use the placeholder text `change-me-32-chars-minimum`.

- [ ] **Step 3: Create `lib/auth.ts`**

```ts
/**
 * Better Auth server instance. Username + password only — email is a
 * synthesized placeholder (`<username>@tracker.local`), no verification.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  plugins: [username(), nextCookies()], // nextCookies must be last
});
```

- [ ] **Step 4: Generate Better Auth models into the Prisma schema**

```bash
npx auth@latest generate --config lib/auth.ts --yes
```

Expected: `prisma/schema.prisma` gains `User`, `Session`, `Account`, `Verification` models (User includes `username`/`displayUsername` from the plugin). If the CLI fails to load the config (path-alias issue), temporarily change `lib/auth.ts` to import prisma via relative path `./db`, rerun, and restore. If model names are lowercase (`user`), keep whatever the CLI emits — Better Auth's runtime expects its own naming; do not rename models.

- [ ] **Step 5: Push and regenerate**

```bash
npx prisma db push && npx prisma generate
```

Expected: 4 new tables created, no data loss warnings, client regenerated.

- [ ] **Step 6: Create the catch-all route handler**

`app/api/auth/[...all]/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 7: Create `lib/auth-client.ts`**

```ts
"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [usernameClient()],
});
```

- [ ] **Step 8: Write verification script `scripts/verify-auth.ts`**

```ts
/** One-shot check that Better Auth can create + authenticate a user. */
import { auth } from "../lib/auth";

async function main() {
  const suffix = process.pid; // unique-ish per run
  const username = `smoketest${suffix}`;
  await auth.api.signUpEmail({
    body: {
      name: username,
      username,
      email: `${username}@tracker.local`,
      password: "test-password-123",
    },
  });
  const signIn = await auth.api.signInUsername({
    body: { username, password: "test-password-123" },
  });
  if (!signIn?.user?.id) throw new Error("sign-in returned no user");
  console.log(`OK: signed up + signed in as ${username} (${signIn.user.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

If `@/lib/db` path alias breaks under `tsx`, use relative imports (`../lib/auth`); tsx v4 resolves tsconfig paths, so it should work as written.

- [ ] **Step 9: Run verification**

```bash
npx tsx scripts/verify-auth.ts
```

Expected: `OK: signed up + signed in as smoketest<pid> (<cuid>)`. (This leaves a throwaway user row — harmless; it has no data.)

- [ ] **Step 10: Build, test, commit**

```bash
npm run build && npm test
git add -A && git commit -m "feat: add Better Auth server, schema tables, route handler, client"
```

---

### Task 2: Schema phase 1 — additive nullable userId columns

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: nullable `userId String?` on 15 data models; `UserExercisePref` model; `AppSettings.userId`/`activeProgramId`; `WhoopConnection.userId`. Old fields `Exercise.isFavorite`, `Program.isActive` and singleton ids REMAIN for now (dropped in Task 11).
- Consumes: `User` model from Task 1.

- [ ] **Step 1: Add `userId String?` + index + relation to these 15 models**

`TrainingBlock`, `WorkoutSession`, `PersonalRecord`, `BodyMeasurement`, `ProgressPhoto`, `NutritionLog`, `RecoveryLog`, `Goal`, `Notification`, `CoachBrief`, `SubstitutionEvent`, `WhoopCycle`, `WhoopRecovery`, `WhoopSleep`, `WhoopWorkout`.

Pattern for each (example on `WorkoutSession`):

```prisma
model WorkoutSession {
  // ... existing fields ...
  userId String?
  user   User?   @relation("WorkoutSessionUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, templateId, date])   // REPLACES @@unique([templateId, date])
  @@index([userId])
  @@index([date])
}
```

Add the matching back-relation list on `User` (e.g. `workoutSessions WorkoutSession[] @relation("WorkoutSessionUser")`). Every relation gets a unique name `"<Model>User"`.

- [ ] **Step 2: Replace global unique constraints with per-user composites**

| Model | Old | New |
|---|---|---|
| `WorkoutSession` | `@@unique([templateId, date])` | `@@unique([userId, templateId, date])` |
| `BodyMeasurement` | `date String @unique` | plain `date String` + `@@unique([userId, date])` |
| `NutritionLog` | `date String @unique` | plain + `@@unique([userId, date])` |
| `RecoveryLog` | `date String @unique` | plain + `@@unique([userId, date])` |
| `ProgressPhoto` | `@@unique([date, angle])` | `@@unique([userId, date, angle])` |
| `Goal` | `@@unique([type, measurementField])` | `@@unique([userId, type, measurementField])` |
| `Notification` | `dedupeKey String @unique` | plain + `@@unique([userId, dedupeKey])` |
| `TrainingBlock` | `cycleNumber Int @unique` | plain + `@@unique([userId, cycleNumber])` |

- [ ] **Step 3: Reshape the two singletons (additive only)**

```prisma
model WhoopConnection {
  id     String  @id @default("singleton")   // default dropped in Task 11
  userId String? @unique
  user   User?   @relation("WhoopConnectionUser", fields: [userId], references: [id], onDelete: Cascade)
  // ... existing fields unchanged ...
}

model AppSettings {
  id              String  @id @default("singleton")   // default dropped in Task 11
  userId          String? @unique
  user            User?   @relation("AppSettingsUser", fields: [userId], references: [id], onDelete: Cascade)
  activeProgramId String?
  // ... existing fields unchanged ...
}
```

- [ ] **Step 4: Add `UserExercisePref`**

```prisma
// Per-user exercise preferences over the shared catalog.
model UserExercisePref {
  id         String   @id @default(cuid())
  userId     String
  exerciseId String
  isFavorite Boolean  @default(false)
  user       User     @relation("UserExercisePrefUser", fields: [userId], references: [id], onDelete: Cascade)
  exercise   Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@unique([userId, exerciseId])
}
```

Add `prefs UserExercisePref[]` to `Exercise` and the back-relation to `User`.

- [ ] **Step 5: Push, regenerate, build, commit**

```bash
npx prisma db push && npx prisma generate && npm run build && npm test
```

Expected: push succeeds WITHOUT data-loss prompts (all additions nullable; unique swaps are safe because existing rows have NULL userId). Existing code still compiles — it doesn't reference the new columns yet.

```bash
git add -A && git commit -m "feat: schema phase 1 - nullable userId columns, UserExercisePref, per-user uniques"
```

---

### Task 3: Owner migration script — create owner account, backfill userId

**Files:**
- Create: `prisma/migrate-multi-user.ts`
- Modify: `package.json` (script `"db:migrate-users": "tsx prisma/migrate-multi-user.ts"`)

**Interfaces:**
- Consumes: `auth.api.signUpEmail` (Task 1), nullable userId columns (Task 2).
- Produces: a fully backfilled database where every pre-existing row belongs to the owner.

- [ ] **Step 1: Write `prisma/migrate-multi-user.ts`**

```ts
/**
 * One-time migration: creates the owner account and assigns all existing
 * (userId = NULL) rows to it. Idempotent: re-running skips rows already owned.
 * Usage: MIGRATE_USERNAME=maj MIGRATE_PASSWORD=... npm run db:migrate-users
 */
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";

async function main() {
  const username = process.env.MIGRATE_USERNAME;
  const password = process.env.MIGRATE_PASSWORD;
  if (!username || !password) {
    throw new Error("Set MIGRATE_USERNAME and MIGRATE_PASSWORD env vars.");
  }

  // 1. Owner account (reuse if the username already exists).
  let user = await prisma.user.findFirst({ where: { username: username.toLowerCase() } });
  if (!user) {
    const res = await auth.api.signUpEmail({
      body: { name: username, username, email: `${username}@tracker.local`, password },
    });
    user = await prisma.user.findUniqueOrThrow({ where: { id: res.user.id } });
    console.log(`Created owner account ${username} (${user.id})`);
  } else {
    console.log(`Owner account ${username} already exists (${user.id})`);
  }
  const userId = user.id;

  // 2. Backfill userId on all orphaned rows.
  const tables = [
    "trainingBlock", "workoutSession", "personalRecord", "bodyMeasurement",
    "progressPhoto", "nutritionLog", "recoveryLog", "goal", "notification",
    "coachBrief", "substitutionEvent", "whoopCycle", "whoopRecovery",
    "whoopSleep", "whoopWorkout",
  ] as const;
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (prisma[t] as any).updateMany({
      where: { userId: null },
      data: { userId },
    });
    console.log(`  ${t}: ${count} rows claimed`);
  }

  // 3. Singletons -> owner rows. activeProgramId from the old isActive flag.
  const activeProgram = await prisma.program.findFirst({ where: { isActive: true } });
  await prisma.appSettings.updateMany({
    where: { userId: null },
    data: { userId, activeProgramId: activeProgram?.id ?? null },
  });
  await prisma.whoopConnection.updateMany({ where: { userId: null }, data: { userId } });

  // 4. Favorites -> UserExercisePref.
  const favorites = await prisma.exercise.findMany({ where: { isFavorite: true } });
  for (const ex of favorites) {
    await prisma.userExercisePref.upsert({
      where: { userId_exerciseId: { userId, exerciseId: ex.id } },
      update: { isFavorite: true },
      create: { userId, exerciseId: ex.id, isFavorite: true },
    });
  }
  console.log(`  favorites migrated: ${favorites.length}`);

  // 5. Report anything left unclaimed (should be zero everywhere).
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const left = await (prisma[t] as any).count({ where: { userId: null } });
    if (left > 0) console.warn(`  WARNING: ${t} still has ${left} unowned rows`);
  }
  console.log("Migration complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add npm script**

In `package.json` scripts: `"db:migrate-users": "tsx prisma/migrate-multi-user.ts"`.

- [ ] **Step 3: Run it**

```bash
MIGRATE_USERNAME=majid MIGRATE_PASSWORD=$(openssl rand -base64 12) npm run db:migrate-users
```

**IMPORTANT:** Echo the generated password to the console output so the human can record it — print it in the run output (e.g. run `PW=$(openssl rand -base64 12); echo "owner password: $PW"; MIGRATE_USERNAME=majid MIGRATE_PASSWORD=$PW npm run db:migrate-users`). Expected output: owner created, per-table claim counts matching existing data, `favorites migrated: N`, no WARNING lines, `Migration complete.`

- [ ] **Step 4: Verify with sqlite**

```bash
sqlite3 prisma/dev.db "SELECT count(*) FROM WorkoutSession WHERE userId IS NULL; SELECT count(*) FROM AppSettings WHERE userId IS NULL;"
```

Expected: `0` and `0`.

- [ ] **Step 5: Build, test, commit**

```bash
npm run build && npm test
git add -A && git commit -m "feat: one-time multi-user migration script; claim existing data for owner"
```

---

### Task 4: Session helpers, login/signup pages, proxy, layout gating

**Files:**
- Create: `lib/session.ts`
- Create: `app/login/page.tsx`
- Create: `app/signup/page.tsx`
- Create: `components/auth/AuthForm.tsx`
- Create: `proxy.ts` (project root)
- Modify: `app/layout.tsx`
- Modify: `components/layout/Sidebar.tsx` (user row + sign-out)

**Interfaces:**
- Consumes: `auth` from Task 1.
- Produces: `requireUserId(): Promise<string>` and `getSessionUser(): Promise<{ id: string; username: string | null; name: string } | null>` from `@/lib/session` — **every later task uses `requireUserId()`**. Redirects to `/login` when unauthenticated.

- [ ] **Step 1: Create `lib/session.ts`**

```ts
/**
 * Server-side session helpers. requireUserId() is THE auth gate for the data
 * layer — every function in lib/queries/* and lib/actions/* calls it first.
 */
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireUserId(): Promise<string> {
  return (await requireUser()).id;
}
```

If `server-only` isn't already a dependency, drop that import line rather than adding the package.

- [ ] **Step 2: Create `components/auth/AuthForm.tsx`** (shared login/signup client form)

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({
            name: username,
            username,
            email: `${username.toLowerCase()}@tracker.local`,
            password,
          })
        : await authClient.signIn.username({ username, password });
    if (res.error) {
      setError(res.error.message ?? "Something went wrong.");
      setPending(false);
      return;
    }
    // Full navigation so the root layout re-renders with the session.
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <Dumbbell className="size-6 text-accent" strokeWidth={2} />
          <span className="font-display text-lg font-semibold text-text tracking-tight">TRACKER</span>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-sm border border-border bg-bg-subtle p-6">
          <h1 className="font-display text-base font-semibold text-text">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-xs font-medium text-text-3">Username</label>
            <input
              id="username" value={username} onChange={(e) => setUsername(e.target.value)}
              required minLength={3} maxLength={30} autoComplete="username"
              pattern="[a-zA-Z0-9_.]+" title="Letters, numbers, underscores and dots only"
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-text-3">Password</label>
            <input
              id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={8} maxLength={128}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit" disabled={pending}
            className="w-full rounded-sm bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "…" : mode === "login" ? "Sign in" : "Sign up"}
          </button>
          <p className="text-xs text-text-3">
            {mode === "login" ? (
              <>No account? <Link className="text-accent" href="/signup">Sign up</Link></>
            ) : (
              <>Have an account? <Link className="text-accent" href="/login">Sign in</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
```

Match styling to existing tokens (`bg-surface`, `text-text`, `border-border`, `RING` pattern from `components/layout/Sidebar.tsx`) — adjust class names if any token above doesn't exist in `app/globals.css`.

- [ ] **Step 3: Create the two pages**

`app/login/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  return <AuthForm mode="login" />;
}
```

`app/signup/page.tsx` — identical but `mode="signup"` and title `"Sign up"`.

- [ ] **Step 4: Create `proxy.ts`** (optimistic redirect; real enforcement lives in the data layer)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const isAuthPage =
    request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup";
  const hasSession = Boolean(getSessionCookie(request));
  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except auth API, static assets, and files with extensions.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|photos/|.*\\..*).*)"],
};
```

Verify `getSessionCookie` import path against `node_modules/better-auth` exports (`better-auth/cookies`); if absent, check `node_modules/better-auth/package.json` exports map for the cookies subpath.

Note: `/api/whoop/*` and `/api/photos` are inside the matcher and will get redirects rather than 401s — acceptable; they get proper session checks in Tasks 9-10.

- [ ] **Step 5: Gate the root layout**

`app/layout.tsx` — render chrome only when signed in:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { grotesk, inter, mono } from "./fonts";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Tracker", template: "%s · Tracker" },
  description: "Hypertrophy training tracker — Program v1.0",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans">
        {user ? (
          <>
            <Sidebar username={user.displayUsername ?? user.username ?? user.name} />
            <main className="lg:pl-60">
              <div className="mx-auto max-w-7xl px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">
                {children}
              </div>
            </main>
            <MobileNav />
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
```

If `user.displayUsername` isn't on the inferred type, fall back to `user.name`.

- [ ] **Step 6: Add user row + sign-out to `components/layout/Sidebar.tsx`**

Sidebar takes a new prop `username: string`. Replace the footer block with:

```tsx
      <div className="space-y-2 p-3 border-t border-border-faint">
        <div className="rounded-sm bg-surface px-3 py-2 text-xs text-text-3">
          Block <span className="font-mono text-accent">1</span> · Week{" "}
          <span className="font-mono text-accent">1</span>
        </div>
        <div className="flex items-center justify-between rounded-sm px-3 py-1.5">
          <span className="truncate text-xs font-medium text-text-2">{username}</span>
          <button
            type="button"
            onClick={() => authClient.signOut().then(() => { window.location.href = "/login"; })}
            className={`text-xs text-text-3 hover:text-text-2 ${RING}`}
          >
            Sign out
          </button>
        </div>
      </div>
```

Add `import { authClient } from "@/lib/auth-client";` (Sidebar is already `"use client"`). Update the component signature: `export default function Sidebar({ username }: { username: string })`.

Also add a sign-out affordance to `components/layout/MobileNav.tsx` ONLY if it has an obvious place (e.g. an overflow/more item); otherwise skip — mobile users can sign out from a desktop-width window and this is a trusted-user app.

- [ ] **Step 7: Verify with the dev server**

```bash
npm run dev &   # then:
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
```

Expected: first prints `307 http://localhost:3000/login` (or 302), second `200`. Then sign in as the owner in a real check: POST via authClient is browser-side, so instead verify with:

```bash
curl -s -X POST http://localhost:3000/api/auth/sign-in/username \
  -H 'Content-Type: application/json' \
  -d '{"username":"majid","password":"<owner password from Task 3>"}' -i | head -20
```

Expected: `200` with `set-cookie: better-auth.session_token=...`. Kill the dev server.

- [ ] **Step 8: Build, test, commit**

```bash
npm run build && npm test
git add -A && git commit -m "feat: login/signup pages, session helpers, proxy redirect, layout gating"
```

---

### Task 5: Per-user provisioning on signup

**Files:**
- Create: `lib/provision.ts`
- Modify: `lib/auth.ts` (databaseHooks)
- Create: `tests/provision.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`.
- Produces: `provisionNewUser(userId: string): Promise<void>` — creates the user's `AppSettings` row (activeProgramId = first program) and `TrainingBlock` cycle 1 starting Monday of the current week. Exports `mondayOfCurrentWeek(now: Date): string` for testing.

- [ ] **Step 1: Write the failing test** `tests/provision.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mondayOfCurrentWeek } from "../lib/provision";

test("mondayOfCurrentWeek returns the ISO Monday for mid-week dates", () => {
  // Wed 2026-07-01 -> Mon 2026-06-29
  assert.equal(mondayOfCurrentWeek(new Date("2026-07-01T12:00:00")), "2026-06-29");
});

test("mondayOfCurrentWeek is identity on Mondays", () => {
  assert.equal(mondayOfCurrentWeek(new Date("2026-06-29T09:00:00")), "2026-06-29");
});

test("mondayOfCurrentWeek maps Sunday back to the preceding Monday", () => {
  // Sun 2026-07-05 -> Mon 2026-06-29
  assert.equal(mondayOfCurrentWeek(new Date("2026-07-05T20:00:00")), "2026-06-29");
});
```

- [ ] **Step 2: Run to verify failure**

`npm test` — Expected: FAIL, cannot find `../lib/provision`.

- [ ] **Step 3: Create `lib/provision.ts`**

First check `prisma/seed.ts` for its `isoWeekMondayOfToday()` helper and `lib/dates.ts` for existing date utilities — reuse the same date-formatting approach. Implementation:

```ts
/**
 * First-login provisioning: every new user gets an AppSettings row and a
 * TrainingBlock cycle 1 so the dashboard/workout pages work immediately.
 * Called from the Better Auth user.create.after database hook.
 */
import { prisma } from "@/lib/db";

/** YYYY-MM-DD of the Monday of `now`'s week (Mon-start weeks). */
export function mondayOfCurrentWeek(now: Date): string {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function provisionNewUser(userId: string): Promise<void> {
  const firstProgram = await prisma.program.findFirst({ orderBy: { createdAt: "asc" } });
  await prisma.appSettings.upsert({
    where: { userId },
    update: {},
    // Explicit id: the schema default is still "singleton" until Task 11's
    // phase-2 migration switches it to cuid(); without this the SECOND user's
    // create would collide with the owner's row.
    create: { id: crypto.randomUUID(), userId, activeProgramId: firstProgram?.id ?? null },
  });
  await prisma.trainingBlock.upsert({
    where: { userId_cycleNumber: { userId, cycleNumber: 1 } },
    update: {},
    create: { userId, cycleNumber: 1, startDate: mondayOfCurrentWeek(new Date()) },
  });
}
```

NOTE: `AppSettings.userId` is still `String?` until Task 11 — Prisma allows unique-where on nullable unique fields, so `upsert where { userId }` works. `crypto` is global in Node 20+, no import needed. The explicit id stays harmlessly after Task 11 makes the default `cuid()`.

- [ ] **Step 4: Run tests**

`npm test` — Expected: PASS (3 new tests + existing whoop tests).

- [ ] **Step 5: Wire the database hook in `lib/auth.ts`**

```ts
import { provisionNewUser } from "@/lib/provision";
// inside betterAuth({ ... }):
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await provisionNewUser(user.id);
        },
      },
    },
  },
```

- [ ] **Step 6: Verify end-to-end**

```bash
npx tsx scripts/verify-auth.ts
sqlite3 prisma/dev.db "SELECT userId, activeProgramId FROM AppSettings ORDER BY rowid DESC LIMIT 1; SELECT userId, cycleNumber, startDate FROM TrainingBlock ORDER BY rowid DESC LIMIT 1;"
```

Expected: the newest AppSettings + TrainingBlock rows belong to the just-created smoketest user, activeProgramId non-null, startDate = this week's Monday.

- [ ] **Step 7: Build, test, commit**

```bash
npm run build && npm test
git add -A && git commit -m "feat: provision AppSettings + TrainingBlock for new users on signup"
```

---

### Task 6: Scope queries, part 1 (workout, dashboard, programs, exercises, records)

**Files:**
- Modify: `lib/queries/workout.ts`, `lib/queries/dashboard.ts`, `lib/queries/programs.ts`, `lib/queries/exercises.ts`, `lib/queries/records.ts`

**Interfaces:**
- Consumes: `requireUserId()` from `@/lib/session` (Task 4); `UserExercisePref`, `AppSettings.activeProgramId` (Task 2).
- Produces: all exported signatures UNCHANGED (auth derived internally) — pages don't change. Two exceptions callers must know: none (verify with `npm run build`).

**The pattern** — first line of every exported query function:

```ts
const userId = await requireUserId();
```

Then add `userId` to every prisma `where`/`create` touching the 15 user-scoped models (`TrainingBlock`, `WorkoutSession`, `PersonalRecord`, `BodyMeasurement`, `ProgressPhoto`, `NutritionLog`, `RecoveryLog`, `Goal`, `Notification`, `CoachBrief`, `SubstitutionEvent`, `Whoop*`), `AppSettings`, `WhoopConnection`, `UserExercisePref`. Catalog models (`Exercise`, `Program`, `WorkoutTemplate`, `TemplateExercise`, `BlockOverride`, `ExerciseAlternative`) stay unscoped. Nested reads through a scoped parent (e.g. `SetLog` via `SessionExercise` via `WorkoutSession`) need no extra filter. Internal helper functions should take `userId: string` as their first parameter rather than calling `requireUserId()` again.

Fully worked example 1 — `getDeloadPct` in `lib/queries/workout.ts` (currently reads the singleton):

```ts
export async function getDeloadPct(): Promise<number> {
  const userId = await requireUserId();
  const settings = await prisma.appSettings.findUnique({ where: { userId } });
  return settings?.deloadWeightPct ?? 0.825;
}
```

Fully worked example 2 — active program resolution (replaces every `program.findFirst({ where: { isActive: true } })` and `program: { isActive: true }` construct):

```ts
const settings = await prisma.appSettings.findUnique({ where: { userId } });
const activeProgram = settings?.activeProgramId
  ? await prisma.program.findUnique({ where: { id: settings.activeProgramId } })
  : null;
```

(`WorkoutTemplate.isActive` is a DIFFERENT field — a template-level flag — leave it alone.)

- [ ] **Step 1: `lib/queries/workout.ts`** — scope every exported function (`getLatestBlock`, `getDeloadPct`, `getLatestRecoveryScore`, `planSlot`, `getProgramOverview`, `getWorkoutOverview`, `getSessionDetail`, `getHistory`). `getLatestBlock`: filter `trainingBlock` by `userId`. Replace `program.findFirst({ where: { isActive: true } })` (line ~295) with the activeProgramId pattern. `getSessionDetail(sessionId)`: fetch then verify `session.userId === userId`, return null on mismatch (ownership check, not just filter).

- [ ] **Step 2: `lib/queries/dashboard.ts`** — `getDashboardData`: scope AppSettings read (line ~216), replace `program: { isActive: true }` (line ~218) with activeProgramId pattern, scope all session/PR/notification/whoop reads.

- [ ] **Step 3: `lib/queries/programs.ts`** — `getPrograms`: drop `orderBy isActive` (field still exists but is dead); instead read the user's `activeProgramId` and return it so the page can badge the active program. If the current return type is `Program[]`, change to `{ programs: Program[]; activeProgramId: string | null }` and update the single caller `app/programs/page.tsx` (check `git grep -n getPrograms` for others). `getProgramWorkout` needs no user scoping (catalog) but still call `requireUserId()` first — every query enforces auth.

- [ ] **Step 4: `lib/queries/exercises.ts`** — `getExerciseLibrary` / `getExerciseDetail`: `isFavorite` now comes from `UserExercisePref`:

```ts
const prefs = await prisma.userExercisePref.findMany({ where: { userId } });
const favSet = new Set(prefs.filter((p) => p.isFavorite).map((p) => p.exerciseId));
// then: isFavorite: favSet.has(e.id)
```

Keep the `ExerciseListItem`/`ExerciseDetail` shapes unchanged. Scope the `personalRecords` reads in `getExerciseDetail` by `userId`.

- [ ] **Step 5: `lib/queries/records.ts`** — scope `personalRecord` reads by `userId`.

- [ ] **Step 6: Verify + commit**

```bash
npm run build && npm test
git grep -n "isActive: true" lib/queries/workout.ts lib/queries/dashboard.ts lib/queries/programs.ts
```

Expected: build passes; grep shows only `WorkoutTemplate.isActive` usages (template flag), zero `Program` ones.

```bash
git add -A && git commit -m "feat: scope workout/dashboard/programs/exercises/records queries by user"
```

---

### Task 7: Scope queries, part 2 (tracking, calendar, analytics, goals, effective-recovery, whoop status, notifications lib)

**Files:**
- Modify: `lib/queries/tracking.ts`, `lib/queries/calendar.ts`, `lib/queries/analytics.ts`, `lib/queries/goals.ts`, `lib/queries/effective-recovery.ts`, `lib/queries/whoop.ts`, `lib/notifications.ts`

**Interfaces:**
- Consumes: `requireUserId()` (Task 4).
- Produces: signatures unchanged EXCEPT `lib/notifications.ts` generator functions and `lib/queries/effective-recovery.ts` helpers, which may gain a `userId: string` first parameter when they are called from other lib code rather than directly from pages — keep exported page-facing signatures stable.

Same pattern as Task 6. Specifics:

- [ ] **Step 1: `lib/queries/tracking.ts`** — scope `bodyMeasurement`, `progressPhoto`, `nutritionLog`, `recoveryLog` reads; `getNutritionData` reads AppSettings — switch `{ id: "singleton" }` to `{ userId }`.

- [ ] **Step 2: `lib/queries/calendar.ts`** — scope session/measurement/photo/whoop reads; AppSettings reminder-day read (line ~113) → `{ userId }`.

- [ ] **Step 3: `lib/queries/analytics.ts`** — scope session/set/PR/measurement reads inside `getAnalyticsData`.

- [ ] **Step 4: `lib/queries/goals.ts`** — scope `goal` + any measurement/PR reads in `getGoalsPageData`.

- [ ] **Step 5: `lib/queries/effective-recovery.ts`** — `getEffectiveRecovery`, `getLatestEffectiveRecovery`, `getWhoopDayContext` read `RecoveryLog` + `Whoop*` tables. These are called BOTH from pages and from other lib code (check `git grep -n getEffectiveRecovery`). Refactor: each takes `userId: string` as first param; update all callers (some callers are in files touched by Tasks 6/8/9 — if a caller doesn't have `userId` yet, add `requireUserId()` there). Pure helpers `whoopSleepHours`/`toCoachWhoopContext` unchanged.

- [ ] **Step 6: `lib/queries/whoop.ts`** — `getWhoopStatus` / `maybeAutoSync`: scope `whoopConnection` by `{ userId }` instead of `{ id: "singleton" }`. If they call `lib/whoop/sync.ts` functions, pass `userId` through only if Task 10 has landed — otherwise leave the sync call itself untouched (Task 10 rewires it) and scope only the direct prisma reads in this file.

- [ ] **Step 7: `lib/notifications.ts`** — read the file first. Scope every `prisma.notification` create/read by `userId`; generator functions gain `userId: string` as first parameter; dedupe upserts switch from `where: { dedupeKey }` to `where: { userId_dedupeKey: { userId, dedupeKey } }`. Update callers (`git grep -n` each exported name).

- [ ] **Step 8: Verify + commit**

```bash
npm run build && npm test
git grep -n '"singleton"' lib/queries lib/notifications.ts
```

Expected: build passes; grep returns nothing in these files.

```bash
git add -A && git commit -m "feat: scope tracking/calendar/analytics/goals/recovery/notification queries by user"
```

---

### Task 8: Scope actions, part 1 (workout, programs, exercises, records, notifications)

**Files:**
- Modify: `lib/actions/workout.ts`, `lib/actions/programs.ts`, `lib/actions/exercises.ts`, `lib/actions/records.ts`, `lib/actions/notifications.ts`

**Interfaces:**
- Consumes: `requireUserId()` (Task 4).
- Produces: all exported action signatures UNCHANGED. `activateProgram` now writes `AppSettings.activeProgramId`. `toggleFavorite` writes `UserExercisePref`.

Same first-line pattern. Mutations on user-scoped rows must include ownership: `updateMany({ where: { id, userId }, ... })` or fetch-then-verify — never `update({ where: { id } })` alone on user-scoped models.

Fully worked example — `activateProgram` in `lib/actions/programs.ts`:

```ts
export async function activateProgram(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("programId") ?? "");
  if (!id) throw new Error("Program is required");
  await prisma.appSettings.update({ where: { userId }, data: { activeProgramId: id } });
  refresh();
}
```

Fully worked example — `toggleFavorite` in `lib/actions/exercises.ts`:

```ts
export async function toggleFavorite(exerciseId: string): Promise<void> {
  const userId = await requireUserId();
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return;
  const existing = await prisma.userExercisePref.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
  });
  await prisma.userExercisePref.upsert({
    where: { userId_exerciseId: { userId, exerciseId } },
    update: { isFavorite: !existing?.isFavorite },
    create: { userId, exerciseId, isFavorite: true },
  });
  revalidatePath("/exercises");
  revalidatePath(`/exercises/${exerciseId}`);
}
```

- [ ] **Step 1: `lib/actions/workout.ts`** — `startWorkout` (creates WorkoutSession → add `userId` to create; block lookup scoped), `logSet` (verify the session-exercise's session belongs to userId before writing), `finishWorkout`/`cancelWorkout` (ownership check on sessionId), `substituteExercise` (SubstitutionEvent create gets `userId`; note the template mutation itself is shared-catalog and stays global), `updateExerciseNotes` (ownership via session). PR creation inside finish flow gets `userId`.

- [ ] **Step 2: `lib/actions/programs.ts`** — all functions call `requireUserId()` first (catalog mutations are shared, so auth-gate only); `activateProgram` per the example; remove the old `isActive` transaction.

- [ ] **Step 3: `lib/actions/exercises.ts`** — `toggleFavorite` per example; `updateExercise`: keep catalog fields global but route the `isFavorite` checkbox to `UserExercisePref` (same upsert with explicit value `formData.get("isFavorite") === "on"`); `createExercise`/`substituteExercise` auth-gate + `userId` on SubstitutionEvent create.

- [ ] **Step 4: `lib/actions/records.ts`** — `markAllPrsSeen`: `updateMany({ where: { userId, seenByUser: false }, ... })`.

- [ ] **Step 5: `lib/actions/notifications.ts`** — `markNotificationRead`: `updateMany({ where: { id, userId }, data: { read: true } })`; `markAllNotificationsRead`: add `userId` to where.

- [ ] **Step 6: Verify + commit**

```bash
npm run build && npm test
git grep -n "requireUserId" lib/actions/workout.ts lib/actions/programs.ts lib/actions/exercises.ts lib/actions/records.ts lib/actions/notifications.ts | wc -l
```

Expected: build passes; count ≥ number of exported actions in those files (each calls it once).

```bash
git add -A && git commit -m "feat: scope workout/programs/exercises/records/notifications actions by user"
```

---

### Task 9: Scope actions, part 2 (tracking, goals, coach, photos API)

**Files:**
- Modify: `lib/actions/tracking.ts`, `lib/actions/goals.ts`, `lib/actions/set-coach.ts`, `lib/actions/dashboard-coach.ts`, `lib/ai/dashboard-coach.ts` (if it queries), `app/api/photos/route.ts`

**Interfaces:**
- Consumes: `requireUserId()` / `getSessionUser()` (Task 4).
- Produces: signatures unchanged. `POST /api/photos` returns 401 JSON when unauthenticated.

- [ ] **Step 1: `lib/actions/tracking.ts`** — `saveMeasurement`/`saveNutrition`/`saveRecovery`: upserts keyed by date become per-user — `where: { userId_date: { userId, date } }` (composite from Task 2), creates include `userId`. `deletePhoto`: fetch photo, verify `photo.userId === userId` before deleting file + row.

- [ ] **Step 2: `lib/actions/goals.ts`** — `saveGoal` upsert → `userId_type_measurementField` composite (nullable `measurementField` in a composite unique: Prisma disallows null in compound-unique `where` — if `measurementField` is null, use `findFirst({ where: { userId, type, measurementField: null } })` then create/update by id); `markGoalAchieved`/`deleteGoal`: `updateMany`/`deleteMany` with `{ id, userId }`.

- [ ] **Step 3: `lib/actions/set-coach.ts` + `lib/actions/dashboard-coach.ts`** — `askSetCoach(sessionExerciseId)`: load the session-exercise with its session, verify `session.userId === userId`. `getLatestCoachBrief`: filter `coachBrief` by `userId`. If `lib/ai/dashboard-coach.ts` or `lib/ai/set-coach-provider.ts` do their own prisma reads (check first), thread `userId` in as a parameter; CoachBrief creates get `userId`.

- [ ] **Step 4: `app/api/photos/route.ts`** — top of POST handler:

```ts
import { auth } from "@/lib/auth";

const session = await auth.api.getSession({ headers: request.headers });
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = session.user.id;
```

(Route handlers have the request — use `request.headers`, not `next/headers`.) ProgressPhoto upserts switch to the `userId_date_angle` composite and creates include `userId`. Match the file's existing error-response shape.

- [ ] **Step 5: Verify + commit**

```bash
npm run build && npm test
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/photos   # with dev server running
```

Expected: build passes; curl prints `401` (or `307` if proxy catches it first — then retry with `-H 'x-test: 1'`... if proxy intercepts, confirm the 401 by temporarily testing with the session cookie flow instead; what matters is: no unauthenticated write path).

```bash
git add -A && git commit -m "feat: scope tracking/goals/coach actions and photos API by user"
```

---

### Task 10: Per-user WHOOP connection and sync

**Files:**
- Modify: `lib/whoop/client.ts`, `lib/whoop/sync.ts`, `lib/actions/whoop.ts`, `lib/queries/whoop.ts` (sync call wiring), `app/api/whoop/auth/route.ts`, `app/api/whoop/callback/route.ts`

**Interfaces:**
- Consumes: `auth.api.getSession` / `requireUserId()`.
- Produces: `getConnection(userId: string)`, `syncWhoop(userId: string, opts?: { force?: boolean })` (preserve the existing opts shape — read the current signature first and keep everything except the added leading `userId`). All `Whoop*` row upserts include `userId` in BOTH create and update (self-heals rows synced before this task).

- [ ] **Step 1: `lib/whoop/client.ts`** — `getConnection(userId: string)` uses `where: { userId }`. `refreshTokens` keys updates by `where: { id: connection.id }` (row id, not singleton). Thread `userId`/connection through any internal helpers.

- [ ] **Step 2: `lib/whoop/sync.ts`** — `syncWhoop(userId, ...)`: connection lookups/updates by `userId` / `connection.id`; every `whoopCycle`/`whoopRecovery`/`whoopSleep`/`whoopWorkout` upsert adds `userId` to BOTH `create` and `update` payloads. WHOOP row ids are globally unique UUIDs from WHOOP's API, so the `@id` stays the natural key — two users syncing the SAME WHOOP account would fight over rows, which is fine (each person has their own WHOOP account).

- [ ] **Step 3: `lib/actions/whoop.ts`** — `syncWhoopNow`/`disconnectWhoop`: `requireUserId()`, pass to sync; disconnect deletes `where: { userId }`.

- [ ] **Step 4: `lib/queries/whoop.ts`** — wire `maybeAutoSync`/`getWhoopStatus` to pass `userId` into `syncWhoop`/`getConnection`.

- [ ] **Step 5: OAuth routes** — `app/api/whoop/auth/route.ts`: resolve session via `auth.api.getSession({ headers: request.headers })`, redirect to `/login` if none (before any WHOOP redirect). `app/api/whoop/callback/route.ts`: same session check; the `WhoopConnection` upsert becomes `upsert({ where: { userId }, update: {...tokens}, create: { userId, ...tokens } })` — plus explicit `id: crypto.randomUUID()` in create while the schema default is still `"singleton"` (Task 11 fixes the default). `syncWhoop({ force: true })` → `syncWhoop(userId, { force: true })`.

- [ ] **Step 6: Verify + commit**

```bash
npm run build && npm test
git grep -n '"singleton"' lib/ app/ | grep -v generated
```

Expected: build passes; grep output is EMPTY (no code references singletons anymore — schema defaults remain until Task 11).

```bash
git add -A && git commit -m "feat: per-user WHOOP connection, sync, and OAuth routes"
```

---

### Task 11: Schema phase 2 — required userId, drop legacy fields, update seed

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: all code now writes `userId` everywhere (Tasks 6-10) and the migration backfilled old rows (Task 3).
- Produces: final schema — `userId String` (required) everywhere; `Exercise.isFavorite` and `Program.isActive` GONE; singleton id defaults replaced with `cuid()`.

- [ ] **Step 1: Pre-flight — confirm no NULL userIds and no legacy-field references**

```bash
sqlite3 prisma/dev.db "SELECT 'WorkoutSession', count(*) FROM WorkoutSession WHERE userId IS NULL UNION ALL SELECT 'TrainingBlock', count(*) FROM TrainingBlock WHERE userId IS NULL UNION ALL SELECT 'AppSettings', count(*) FROM AppSettings WHERE userId IS NULL UNION ALL SELECT 'WhoopConnection', count(*) FROM WhoopConnection WHERE userId IS NULL;"
git grep -n "isFavorite" lib/ app/ components/ --and --not -e UserExercisePref | grep -v generated || true
git grep -rn "isActive" lib/ app/ | grep -i program | grep -v generated || true
```

Expected: all counts 0 (delete any leftover smoketest-user NULL rows only if counts are nonzero — investigate first); greps show no live reads of `Exercise.isFavorite` / `Program.isActive`. If verify-auth smoketest users left provisioned rows those HAVE userIds — fine.

- [ ] **Step 2: Schema edits**

- All 15 models: `userId String?` → `userId String`, `user User?` → `user User` (relation stays).
- `AppSettings` / `WhoopConnection`: `userId String? @unique` → `userId String @unique`; `id String @id @default("singleton")` → `id String @id @default(cuid())`.
- `Exercise`: delete the `isFavorite` line.
- `Program`: delete the `isActive` line.

- [ ] **Step 3: Push**

```bash
npx prisma db push && npx prisma generate
```

Expected: table rebuilds succeed (all rows have userId); a data-loss warning for dropping `Exercise.isFavorite` and `Program.isActive` is EXPECTED and fine (values already migrated to `UserExercisePref`/`activeProgramId`) — accept with `--accept-data-loss` if prompted. NO other drops should be listed; if push wants to drop anything else, STOP and investigate.

- [ ] **Step 4: Update `prisma/seed.ts`** (catalog-only seed)

- Delete the `AppSettings` singleton upsert (per-user now, created by provisioning).
- Delete the `TrainingBlock` upsert and the `isoWeekMondayOfToday` helper if now unused (per-user, from provisioning).
- Remove `isFavorite` from any exercise upsert payloads (field gone).
- Program upserts: remove `isActive: true` and the `updateMany({ data: { isActive: false } })` normalization.
- Update the final verification-summary block: drop the trainingBlock count lines.

- [ ] **Step 5: Prove seed idempotency against the live db**

```bash
npm run db:seed
```

Expected: completes cleanly, counts unchanged from pre-multi-user values (~33 exercises, 4 templates, ~28 slots).

- [ ] **Step 6: Build, test, commit**

```bash
npm run build && npm test
git add -A && git commit -m "feat: schema phase 2 - required userId, drop legacy flags, catalog-only seed"
```

---

### Task 12: End-to-end smoke test and docs

**Files:**
- Create: `scripts/smoke-multi-user.ts`
- Modify: `.env.example` (document all new vars), `README.md` (auth section)

**Interfaces:**
- Consumes: everything.
- Produces: scripted proof of data isolation between two users.

- [ ] **Step 1: Write `scripts/smoke-multi-user.ts`**

The script uses `auth.api` server-side plus prisma to prove isolation:

```ts
/** Proves per-user data isolation. Run: npx tsx scripts/smoke-multi-user.ts */
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";

async function main() {
  const uname = `isotest${process.pid}`;
  const password = "isolation-test-99";
  const res = await auth.api.signUpEmail({
    body: { name: uname, username: uname, email: `${uname}@tracker.local`, password },
  });
  const newUserId = res.user.id;

  // Provisioning fired?
  const settings = await prisma.appSettings.findUnique({ where: { userId: newUserId } });
  const block = await prisma.trainingBlock.findFirst({ where: { userId: newUserId } });
  if (!settings) throw new Error("no AppSettings provisioned");
  if (!block || block.cycleNumber !== 1) throw new Error("no TrainingBlock provisioned");

  // Isolation: brand-new user owns zero historical rows.
  const [sessions, prs, meas] = await Promise.all([
    prisma.workoutSession.count({ where: { userId: newUserId } }),
    prisma.personalRecord.count({ where: { userId: newUserId } }),
    prisma.bodyMeasurement.count({ where: { userId: newUserId } }),
  ]);
  if (sessions + prs + meas !== 0) throw new Error("new user sees pre-existing data!");

  // Owner still owns their history.
  const owner = await prisma.user.findFirst({ where: { username: "majid" } });
  if (!owner) throw new Error("owner account missing");
  const ownerSessions = await prisma.workoutSession.count({ where: { userId: owner.id } });
  console.log(`OK: new user isolated; owner retains ${ownerSessions} sessions.`);

  // Cleanup the test user (cascades wipe provisioned rows).
  await prisma.user.delete({ where: { id: newUserId } });
  console.log("OK: cleanup done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it**

```bash
npx tsx scripts/smoke-multi-user.ts
```

Expected: both `OK:` lines. Also clean up the `smoketest*` users left by earlier tasks' verify-auth runs:

```bash
sqlite3 prisma/dev.db "SELECT id, username FROM User WHERE username LIKE 'smoketest%';"
```

If any rows appear, delete them from the repo root (cascades remove their provisioned rows):

```bash
npx tsx --eval 'import("./lib/db").then(async ({ prisma }) => { const r = await prisma.user.deleteMany({ where: { username: { startsWith: "smoketest" } } }); console.log(`deleted ${r.count}`); await prisma.$disconnect(); })'
```

- [ ] **Step 3: Browser-level manual check (dev server)**

```bash
npm run dev
```

Checklist (report results, don't skip):
1. Visit `/` logged out → redirected to `/login`.
2. Sign in as owner → dashboard shows historical data; sidebar shows username.
3. `/exercises` → favorites match pre-migration stars.
4. `/programs` → previously active program badged active.
5. Sign out → back to `/login`; visiting `/history` redirects.
6. Sign up a second user → empty dashboard, no owner data anywhere; log a set or save a measurement; sign back in as owner → owner's data unchanged, no bleed-through.

- [ ] **Step 4: Docs**

`.env.example`: ensure `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` documented with comments. `README.md`: short "Accounts" section — signup at `/signup`, migration command for existing databases (`MIGRATE_USERNAME=... MIGRATE_PASSWORD=... npm run db:migrate-users` — note it only works on a database that was migrated through schema phase 1; fresh installs skip it).

- [ ] **Step 5: Final commit**

```bash
npm run build && npm test
git add -A && git commit -m "feat: multi-user smoke test and docs"
```
