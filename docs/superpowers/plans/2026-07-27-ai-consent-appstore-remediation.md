# AI Consent App Store Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the App Store 5.1.1(i)/5.1.2(i) rejection by adding a user-facing just-in-time consent prompt before any AI surface activates, fixing two false disclosures (username sent to MiniMax; injuries free-text undisclosed), updating the privacy policy, and drafting the Resolution Center reply.

**Architecture:** Consent remains a single server-enforced flag (`AppSettings.aiDataSharingEnabled`, checked by `hasAiDataConsent()` at every AI call site — unchanged). We add `aiConsentDecidedAt` so the UI can distinguish "never asked" from "declined", and surface an inline consent prompt at the two places a user (or App Review) first meets the AI coach: the dashboard coach-brief card and the AI program builder entry (web + iOS). The onboarding "Build it with the AI coach" path needs no wizard change — it routes into the program builder, which now presents consent inline. Ask Coach and exercise recaps stay server-gated (deterministic fallback until consent), so no data ever leaves without opt-in.

**Tech Stack:** Next.js 16.2.10 (App Router, server actions), React 19, Prisma 7 + SQLite, Capacitor 8 mobile app (Vite + React in `mobile/`), `node:test` via `tsx --test`.

## Global Constraints

- **This is NOT the Next.js you know** (AGENTS.md): if unsure about an API, read `node_modules/next/dist/docs/` before writing code.
- The AI provider is **MiniMax** — name it verbatim in all user-facing disclosure copy.
- Consent default stays **off** (`aiDataSharingEnabled Boolean @default(false)`); server-side `hasAiDataConsent()` gating at all five call sites must not be weakened.
- Never send the login `username` to MiniMax — display name (`user.name`) or the literal `"athlete"` only.
- Tests: `npm test` runs `TZ=America/New_York tsx --test tests/*.test.ts`; test files use `import test from "node:test"` + `import assert from "node:assert/strict"`.
- Mobile code cannot import from `lib/` (separate Vite project) — mobile consent copy is mirrored inline and must stay consistent with `lib/ai/consent-copy.ts`.
- Verification commands: `npm test`, `npm run build`, `npm run mobile:typecheck`.
- Work on branch `fix/ai-consent-appstore` off `main`. Commit at the end of every task.

---

### Task 1: Consent decision state (`aiConsentDecidedAt`) + pure upsert helper

**Files:**
- Modify: `prisma/schema.prisma:749-751` (AppSettings block)
- Modify: `lib/ai/consent.ts`
- Modify: `lib/actions/settings.ts:30-48` (`updateAiDataConsent`)
- Modify: `app/api/mobile/settings/route.ts:35-48` (aiConsent action)
- Test: `tests/ai-consent.test.ts` (create)

**Interfaces:**
- Produces: `aiConsentUpdate(enabled: boolean, now: string): { aiDataSharingEnabled: boolean; aiDataConsentAt: string | null; aiConsentDecidedAt: string }` exported from `lib/ai/consent.ts`. New nullable column `AppSettings.aiConsentDecidedAt: String?` — `null` means "never decided" (UI shows consent prompt); non-null means the user has made a choice (the flag holds it).
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/ai-consent.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/ai-consent.test.ts`
Expected: FAIL — `aiConsentUpdate` is not exported.

- [ ] **Step 3: Implement**

In `prisma/schema.prisma`, after `aiDataConsentAt        String?` (line 751) add:

```prisma
  /// ISO datetime of the user's most recent allow/decline decision on the AI
  /// consent prompt; null = never asked, UI shows the just-in-time prompt.
  aiConsentDecidedAt     String?
```

Run `npm run db:push` (dev SQLite) and `npx prisma generate`.

In `lib/ai/consent.ts` add below `hasAiDataConsent`:

```typescript
/** Upsert payload for an explicit allow/decline decision on the consent prompt. */
export function aiConsentUpdate(enabled: boolean, now: string) {
  return {
    aiDataSharingEnabled: enabled,
    aiDataConsentAt: enabled ? now : null,
    aiConsentDecidedAt: now,
  };
}
```

In `lib/actions/settings.ts` replace the body of `updateAiDataConsent` to use it (import `aiConsentUpdate` from `@/lib/ai/consent`):

```typescript
export async function updateAiDataConsent(enabled: boolean): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const data = aiConsentUpdate(Boolean(enabled), new Date().toISOString());
  await prisma.appSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}
```

In `app/api/mobile/settings/route.ts` replace the aiConsent upsert (lines 36-47) the same way (import `aiConsentUpdate` from `@/lib/ai/consent`):

```typescript
  const enabled = body.enabled === true;
  const data = aiConsentUpdate(enabled, new Date().toISOString());
  await prisma.appSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });
  return Response.json({ data: { enabled } });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test tests/ai-consent.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/ai/consent.ts lib/actions/settings.ts app/api/mobile/settings/route.ts tests/ai-consent.test.ts
git commit -m "feat(consent): track explicit AI consent decisions with aiConsentDecidedAt"
```

---

### Task 2: Never send the login username to MiniMax

**Files:**
- Modify: `lib/ai/program-builder.ts` (add helper near `intakePrompt`, ~line 227)
- Modify: `lib/actions/program-builder.ts:87-90`
- Test: `tests/program-builder.test.ts` (append)

**Interfaces:**
- Produces: `athleteDisplayName(name: string | null | undefined): string` exported from `lib/ai/program-builder.ts` — returns the trimmed display name, or `"athlete"` when absent. The login username is never a fallback.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

Append to `tests/program-builder.test.ts`:

```typescript
import { athleteDisplayName } from "../lib/ai/program-builder";

test("athleteDisplayName uses the display name when present", () => {
  assert.equal(athleteDisplayName("  Majid "), "Majid");
});

test("athleteDisplayName never falls back to a login username", () => {
  assert.equal(athleteDisplayName(null), "athlete");
  assert.equal(athleteDisplayName(undefined), "athlete");
  assert.equal(athleteDisplayName("   "), "athlete");
});
```

(`import test from "node:test"` and `assert` already exist at the top of the file; extend the existing import from `../lib/ai/program-builder` instead of adding a duplicate import statement.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/program-builder.test.ts`
Expected: FAIL — `athleteDisplayName` is not exported.

- [ ] **Step 3: Implement**

In `lib/ai/program-builder.ts`, above `intakePrompt`:

```typescript
/**
 * Privacy: the prompt gets the display name only — the privacy policy promises
 * MiniMax never receives the login username, so it must not be a fallback here.
 */
export function athleteDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed || "athlete";
}
```

In `lib/actions/program-builder.ts` replace lines 88-90:

```typescript
  if (history.length === 0) {
    const athleteName = athleteDisplayName(user.name);
    history.push({ role: "user", content: intakePrompt(input.intake, list, athleteName) });
```

Add `athleteDisplayName` to the existing import from `@/lib/ai/program-builder` in that file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test tests/program-builder.test.ts`
Expected: PASS (all, including the 3 new).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/program-builder.ts lib/actions/program-builder.ts tests/program-builder.test.ts
git commit -m "fix(privacy): never send the login username to MiniMax"
```

---

### Task 3: Shared consent copy module + web `AiConsentPrompt` component

**Files:**
- Create: `lib/ai/consent-copy.ts`
- Create: `components/ai/AiConsentPrompt.tsx`
- Test: `tests/ai-consent.test.ts` (append)

**Interfaces:**
- Produces: `AI_CONSENT_COPY` from `lib/ai/consent-copy.ts`:
  ```typescript
  export const AI_CONSENT_COPY: {
    title: string;      // "Turn on AI coaching?"
    intro: string;
    sends: string[];    // bullet list of what is sent
    recipient: string;  // names MiniMax, notes Settings + privacy policy
    allow: string;      // "Allow AI coaching"
    decline: string;    // "Not now"
  };
  ```
- Produces: `<AiConsentPrompt onDecided={(enabled: boolean) => void} />` — client component from `components/ai/AiConsentPrompt.tsx`; renders the disclosure and two buttons, persists the decision via `updateAiDataConsent`, then calls `onDecided(enabled)`.
- Consumes: `updateAiDataConsent` (Task 1 keeps its signature).

- [ ] **Step 1: Write the failing test**

Append to `tests/ai-consent.test.ts` — these assertions are the compliance contract for 5.1.2(i) (disclose what, disclose who, revocability):

```typescript
import { AI_CONSENT_COPY } from "../lib/ai/consent-copy";

test("consent copy names the recipient and discloses all data categories sent", () => {
  const all = [AI_CONSENT_COPY.intro, ...AI_CONSENT_COPY.sends, AI_CONSENT_COPY.recipient].join(" ");
  assert.match(all, /MiniMax/);
  assert.match(all, /workout/i);
  assert.match(all, /recovery|sleep/i);
  assert.match(all, /injur/i);       // program-builder intake free text
  assert.match(all, /display name/i); // program-builder greeting name
  assert.match(all, /Settings/);      // where to change the decision
});

test("consent copy states what is never sent", () => {
  const all = [AI_CONSENT_COPY.intro, ...AI_CONSENT_COPY.sends, AI_CONSENT_COPY.recipient].join(" ");
  assert.match(all, /username|photos|tokens/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/ai-consent.test.ts`
Expected: FAIL — cannot find module `../lib/ai/consent-copy`.

- [ ] **Step 3: Implement the copy module**

Create `lib/ai/consent-copy.ts`:

```typescript
/**
 * Single source of truth for AI-consent disclosure copy (App Store guideline
 * 5.1.2(i): disclose what is sent, to whom, and obtain permission first).
 * mobile/src/App.tsx mirrors this text inline — keep them in sync.
 */
export const AI_CONSENT_COPY = {
  title: "Turn on AI coaching?",
  intro:
    "Progression can generate personalized coaching by sending some of your training data to MiniMax, our AI service provider.",
  sends: [
    "Workout details: exercises, sets, weights, reps, effort, and PRs",
    "Recovery and sleep metrics from WHOOP or Google Health, if connected",
    "When you use the AI program builder: your display name, goals, equipment, and any injury or limitation notes you type",
  ],
  recipient:
    "This data goes only to MiniMax and only to generate your coaching. Your login username, password, progress photos, body measurements, nutrition entries, and wearable access tokens are never sent. You can change this anytime in Settings → Privacy; details are in the privacy policy.",
  allow: "Allow AI coaching",
  decline: "Not now",
} as const;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test tests/ai-consent.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the component**

Create `components/ai/AiConsentPrompt.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { updateAiDataConsent } from "@/lib/actions/settings";
import { AI_CONSENT_COPY as COPY } from "@/lib/ai/consent-copy";

/** Just-in-time AI consent: disclose what is sent and to whom, then ask. */
export default function AiConsentPrompt({ onDecided }: { onDecided: (enabled: boolean) => void }) {
  const [pending, startTransition] = useTransition();

  function decide(enabled: boolean) {
    startTransition(async () => {
      await updateAiDataConsent(enabled);
      onDecided(enabled);
    });
  }

  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-text">
        <Sparkles className="size-4" strokeWidth={2} />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-text">{COPY.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-2">{COPY.intro}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-text-2">
          {COPY.sends.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="mt-2 text-xs leading-5 text-text-3">{COPY.recipient}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide(true)}
            className="inline-flex h-9 items-center justify-center rounded-sm bg-accent px-4 text-xs font-semibold text-accent-text transition-colors hover:bg-accent/90 disabled:opacity-40"
          >
            {COPY.allow}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide(false)}
            className="inline-flex h-9 items-center justify-center rounded-sm border border-border px-4 text-xs font-semibold text-text-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            {COPY.decline}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (component not yet mounted anywhere — that's Tasks 4-5).

- [ ] **Step 7: Commit**

```bash
git add lib/ai/consent-copy.ts components/ai/AiConsentPrompt.tsx tests/ai-consent.test.ts
git commit -m "feat(consent): shared disclosure copy and just-in-time consent prompt component"
```

---

### Task 4: Web dashboard — consent prompt in the coach-brief card

**Files:**
- Modify: `app/page.tsx:31-35, 66`
- Modify: `components/dashboard/CoachBriefCard.tsx`

**Interfaces:**
- Consumes: `AiConsentPrompt` (Task 3), `aiConsentDecidedAt` column (Task 1).
- Produces: `CoachBriefCard` now takes `{ consentUndecided: boolean }`.

- [ ] **Step 1: Pass consent state from the dashboard page**

In `app/page.tsx` line 32, extend the select:

```typescript
    prisma.appSettings.findUnique({
      where: { userId },
      select: { onboardedAt: true, aiConsentDecidedAt: true },
    }),
```

Line 66: `<CoachBriefCard consentUndecided={settings?.aiConsentDecidedAt == null} />`

(A missing AppSettings row means the user has never decided — `undefined == null` is intentionally true.)

- [ ] **Step 2: Render the prompt in CoachBriefCard**

Replace `components/dashboard/CoachBriefCard.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import AiConsentPrompt from "@/components/ai/AiConsentPrompt";
import { getLatestCoachBrief } from "@/lib/actions/dashboard-coach";
import type { CoachBriefData } from "@/lib/ai/dashboard-coach";

export default function CoachBriefCard({ consentUndecided }: { consentUndecided: boolean }) {
  const [needsConsent, setNeedsConsent] = useState(consentUndecided);
  const [brief, setBrief] = useState<CoachBriefData | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (needsConsent) return;
    let active = true;
    getLatestCoachBrief().then((value) => { if (active) { setBrief(value); setLoaded(true); } });
    return () => { active = false; };
  }, [needsConsent]);
  if (needsConsent) return <Card className="border-accent-border bg-accent-muted p-5">
    <AiConsentPrompt onDecided={() => setNeedsConsent(false)} />
  </Card>;
  if (loaded && !brief) return null;
  return <Card className="border-accent-border bg-accent-muted p-5">
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-text"><Sparkles className="size-4" strokeWidth={2}/></span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Coach brief</p>
        {!loaded ? <p className="mt-2 text-sm text-text-3">Checking in…</p> : <><h2 className="mt-1 text-lg font-semibold text-text">{brief?.headline}</h2><p className="mt-2 text-sm leading-relaxed text-text-2">{brief?.message}</p><p className="mt-2 text-sm font-medium text-text">{brief?.encouragement}</p>{brief?.source === "deterministic" && <p className="mt-2 text-[11px] text-text-faint">Local coaching fallback</p>}</>}
      </div>
    </div>
  </Card>;
}
```

(After either decision the card proceeds to fetch the brief — a decline gets the server-side deterministic brief, which shares nothing.)

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: build succeeds. Then `npm run dev`, sign in as a fresh user (or `sqlite3 prisma/dev.db "UPDATE AppSettings SET aiConsentDecidedAt = NULL, aiDataSharingEnabled = 0"` for an existing dev user), load `/`: the dashboard shows "Turn on AI coaching?" with Allow / Not now; either choice swaps in the coach brief and does not reappear on reload.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/dashboard/CoachBriefCard.tsx
git commit -m "feat(consent): dashboard coach card asks for AI consent before first brief"
```

---

### Task 5: Web program builder — inline consent gate (also fixes the onboarding dead-end)

**Files:**
- Modify: `app/programs/new/page.tsx`
- Modify: `components/programs/ProgramBuilder.tsx` (props, ~line 190; render gate before the intake form, ~line 328)

**Interfaces:**
- Consumes: `AiConsentPrompt` (Task 3), `hasAiDataConsent` + `aiConsentDecidedAt` (Task 1).
- Produces: `ProgramBuilder` props become `{ aiConfigured: boolean; consentGranted: boolean }`.

Note: the onboarding wizard's "Build it with the AI coach" choice routes to `/programs/new` (`DESTINATIONS.ai`), so this gate is exactly the inline onboarding consent step — no wizard changes needed.

- [ ] **Step 1: Pass consent from the page**

Replace `app/programs/new/page.tsx` body:

```tsx
import PageHeader from "@/components/ui/PageHeader";
import ProgramBuilder from "@/components/programs/ProgramBuilder";
import { requireUserId } from "@/lib/session";
import { hasAiDataConsent } from "@/lib/ai/consent";

export const metadata = { title: "AI Program Builder" };
export const dynamic = "force-dynamic";

export default async function NewProgramPage() {
  const userId = await requireUserId();
  const aiConfigured = Boolean(process.env.MINIMAX_API_KEY);
  const consentGranted = await hasAiDataConsent(userId);
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Program Builder"
        subtitle="Answer a few questions and Mo, your AI strength coach, drafts a program — then refine it in chat until it fits."
      />
      <ProgramBuilder aiConfigured={aiConfigured} consentGranted={consentGranted} />
    </div>
  );
}
```

- [ ] **Step 2: Gate the builder**

In `components/programs/ProgramBuilder.tsx`:
- Add imports: `AiConsentPrompt` from `@/components/ai/AiConsentPrompt`, `Link` from `next/link`.
- Change the component signature to accept the new prop and add state (next to the existing `useState` block, ~line 200):

```tsx
export default function ProgramBuilder({ aiConfigured, consentGranted }: { aiConfigured: boolean; consentGranted: boolean }) {
  const [granted, setGranted] = useState(consentGranted);
  const [declined, setDeclined] = useState(false);
```

- Directly after the existing `if (!aiConfigured) { ... }` block (~line 313), add:

```tsx
  if (!granted) {
    return (
      <Card className="max-w-2xl border-accent-border bg-accent-muted p-6">
        {declined ? (
          <div className="text-sm leading-relaxed text-text-2">
            <p>
              The program builder generates your plan with AI coaching, which is currently off, so
              it can&apos;t run. You can turn it on any time in{" "}
              <Link href="/settings" className="font-medium text-accent">Settings → Privacy</Link>, or{" "}
              <Link href="/programs" className="font-medium text-accent">build a program yourself</Link>.
            </p>
            <button
              type="button"
              onClick={() => setDeclined(false)}
              className="mt-3 text-xs font-semibold text-accent"
            >
              Review AI coaching again
            </button>
          </div>
        ) : (
          <AiConsentPrompt onDecided={(enabled) => (enabled ? setGranted(true) : setDeclined(true))} />
        )}
      </Card>
    );
  }
```

The server action `runBuilderTurn` keeps its own `hasAiDataConsent` check unchanged — the UI gate is presentation; enforcement stays server-side.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: success (this also catches any other `<ProgramBuilder>` call sites missing the new required prop — fix them the same way if the build errors).
Then in `npm run dev` with consent reset: `/programs/new` shows the consent prompt; Allow reveals the intake form; Not now shows the declined panel with Settings and Programs links.

- [ ] **Step 4: Commit**

```bash
git add app/programs/new/page.tsx components/programs/ProgramBuilder.tsx
git commit -m "feat(consent): program builder presents inline AI consent instead of a dead-end error"
```

---

### Task 6: Truthful disclosure copy — settings card + privacy policy

**Files:**
- Modify: `components/settings/AiDataConsentCard.tsx:21-26`
- Modify: `app/privacy/page.tsx:12, 28-30`

**Interfaces:**
- Consumes: `AI_CONSENT_COPY` (Task 3).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Settings card reuses the shared copy**

In `components/settings/AiDataConsentCard.tsx`, import `AI_CONSENT_COPY as COPY` from `@/lib/ai/consent-copy` and replace the description `<p>` block (lines 21-26) with:

```tsx
        <p className="mt-1 text-xs leading-5 text-text-3">{COPY.intro}</p>
        <ul className="mt-1 list-disc pl-4 text-xs leading-5 text-text-3">
          {COPY.sends.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="mt-1 text-xs leading-5 text-text-3">
          {COPY.recipient} When off, coaching uses calculations performed by Progression without
          sharing data.
        </p>
```

- [ ] **Step 2: Privacy policy — accurate AI processing section**

In `app/privacy/page.tsx`:
- Line 12: `<p className="mt-2 text-sm text-text-3">Effective July 27, 2026</p>`
- Replace the "AI processing" section paragraph (line 29) with:

```tsx
          <p className="mt-2">AI coaching is optional and off by default. Progression asks for your permission in the app before any data is shared. When you explicitly enable it, the following is sent to MiniMax, our AI service provider, to generate coaching responses: your workout details (exercises, sets, weights, reps, effort, and records), recovery and sleep metrics from connected wearables, and — when you use the AI program builder — your display name and the goals, equipment, and any injury or limitation notes you enter. MiniMax does not receive your login username, password, progress photos, body measurements, nutrition entries, or wearable authorization tokens, and this data is used only to generate your coaching. Disabling AI processing in Settings stops future disclosures and uses Progression&apos;s on-server calculations instead.</p>
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds. Visually confirm `/privacy` and `/settings` render the new copy in `npm run dev`.

- [ ] **Step 4: Commit**

```bash
git add components/settings/AiDataConsentCard.tsx app/privacy/page.tsx
git commit -m "fix(privacy): disclose program-builder name and injury notes; align settings copy"
```

---

### Task 7: iOS app — consent prompt on dashboard and program builder

**Files:**
- Modify: `app/api/mobile/data/[section]/route.ts` ("dashboard" case ~line 47, "programs" case ~line 131)
- Modify: `mobile/src/App.tsx` (DashboardScreen ~line 280-292, ProgramsScreen builder-locked panel ~line 527, SettingsScreen toggle description ~line 697)

**Interfaces:**
- Consumes: `aiConsentUpdate`-stamping mobile settings route (Task 1 — the existing `POST /api/mobile/settings {action:"aiConsent", enabled}` API is unchanged).
- Produces: dashboard section payload gains `aiConsentUndecided: boolean`; programs section payload keeps `aiConsent` and gains `aiConsentUndecided: boolean`.

- [ ] **Step 1: Extend the data sections**

In `app/api/mobile/data/[section]/route.ts`, "dashboard" case:

```typescript
    case "dashboard": {
      const [dashboard, coachBrief, settings] = await Promise.all([
        getDashboardData(),
        getLatestCoachBrief(),
        prisma.appSettings.findUnique({
          where: { userId: session.user.id },
          select: { aiConsentDecidedAt: true },
        }),
      ]);
      data = { ...dashboard, coachBrief, aiConsentUndecided: settings?.aiConsentDecidedAt == null };
      break;
    }
```

"programs" case — replace the `hasAiDataConsent` call with a settings read so both flags come from one query:

```typescript
    case "programs": {
      const [programs, settings] = await Promise.all([
        getPrograms(),
        prisma.appSettings.findUnique({
          where: { userId: session.user.id },
          select: { aiDataSharingEnabled: true, aiConsentDecidedAt: true },
        }),
      ]);
      data = {
        ...programs,
        aiConsent: settings?.aiDataSharingEnabled === true,
        aiConsentUndecided: settings?.aiConsentDecidedAt == null,
        aiConfigured: Boolean(process.env.MINIMAX_API_KEY),
      };
      break;
    }
```

(Remove the now-unused `hasAiDataConsent` import if nothing else in the file uses it.)

- [ ] **Step 2: Add a shared mobile consent panel and use it in DashboardScreen**

In `mobile/src/App.tsx`, add near `RecapBanner` (~line 347) — copy mirrors `lib/ai/consent-copy.ts` (mobile cannot import from `lib/`):

```tsx
// Mirrors lib/ai/consent-copy.ts — keep the disclosure text in sync.
const AI_CONSENT = {
  title: "Turn on AI coaching?",
  intro: "Progression can generate personalized coaching by sending some of your training data to MiniMax, our AI service provider.",
  sends: [
    "Workout details: exercises, sets, weights, reps, effort, and PRs",
    "Recovery and sleep metrics from WHOOP or Google Health, if connected",
    "When you use the AI program builder: your display name, goals, equipment, and any injury or limitation notes you type",
  ],
  recipient: "This data goes only to MiniMax and only to generate your coaching. Your login username, password, progress photos, body measurements, nutrition entries, and wearable access tokens are never sent. You can change this anytime in Settings; details are in the privacy policy.",
};

function AiConsentPanel({ onDecided }: { onDecided: (enabled: boolean) => Promise<void> }) {
  const [pending, setPending] = useState(false);
  async function decide(enabled: boolean) {
    setPending(true);
    try {
      await post("/api/mobile/settings", { action: "aiConsent", enabled });
      await onDecided(enabled);
    } finally { setPending(false); }
  }
  return <section className="panel coach-card">
    <div className="coach-label"><Bot size={17} /><span>AI coaching</span></div>
    <h2>{AI_CONSENT.title}</h2>
    <p>{AI_CONSENT.intro}</p>
    <ul className="consent-list">{AI_CONSENT.sends.map((line) => <li key={line}>{line}</li>)}</ul>
    <small className="consent-fine">{AI_CONSENT.recipient}</small>
    <button className="button primary full" disabled={pending} onClick={() => void decide(true)}>Allow AI coaching</button>
    <button className="button secondary full" disabled={pending} onClick={() => void decide(false)}>Not now</button>
  </section>;
}
```

In `DashboardScreen`, replace the coach-brief section (lines 285-290) with:

```tsx
      {d.aiConsentUndecided ? <AiConsentPanel onDecided={() => state.reload()} />
        : d.coachBrief && <section className="panel coach-card">
        <div className="coach-label"><Bot size={17} /><span>{d.coachBrief.source === "minimax" ? "AI daily coach" : "Daily coach"}</span></div>
        <h2>{d.coachBrief.headline}</h2>
        <p>{d.coachBrief.message}</p>
        <blockquote>{d.coachBrief.encouragement}</blockquote>
      </section>}
```

Add to `mobile/src/styles.css`:

```css
.consent-list { margin: 10px 0 0; padding-left: 20px; display: grid; gap: 6px; }
.consent-list li { font-size: 14px; color: var(--text-2, inherit); }
.consent-fine { display: block; margin: 10px 0 12px; opacity: 0.75; line-height: 1.5; }
```

(Check `styles.css` for the actual text-secondary custom property name and reuse it instead of `--text-2` if it differs.)

- [ ] **Step 3: Program builder entry — inline allow instead of "Open Settings"**

In `ProgramsScreen` (line 527), replace the `!d?.aiConsent` builder-locked panel with:

```tsx
    {!d?.aiConsent ? <div className="panel builder-locked">
        <AiConsentPanel onDecided={async (enabled) => { await state.reload(); if (!enabled) setBuilding(false); }} />
        <button className="button secondary full" onClick={() => setBuilding(false)}>Back to programs</button>
      </div>
```

(The `!d?.aiConfigured` branch and the rest of the chain stay as they are.)

- [ ] **Step 4: Settings toggle description**

In `SettingsScreen` (line 697), update the `SettingToggle` description to match the disclosure:

```tsx
<SettingToggle label="AI coaching" description="Send workout details, connected recovery or sleep metrics, and program-builder intake (display name, goals, injury notes) to MiniMax for personalized coaching. Never sent: login username, password, photos, measurements, or tokens." checked={d.settings?.aiDataSharingEnabled === true} onChange={setConsent} />
```

- [ ] **Step 5: Verify**

Run: `npm run mobile:typecheck`
Expected: clean. Then `npm run mobile:build`
Expected: builds.

- [ ] **Step 6: Commit**

```bash
git add app/api/mobile/data/\[section\]/route.ts mobile/src/App.tsx mobile/src/styles.css
git commit -m "feat(consent): iOS dashboard and program builder present the AI consent prompt inline"
```

---

### Task 8: Full verification + simulator smoke test

**Files:**
- No new files; runs verification.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Full test suite and builds**

Run: `npm test && npm run build && npm run mobile:typecheck`
Expected: all pass.

- [ ] **Step 2: Simulator smoke test of the consent flow**

Per the iOS build workflow (memory: `tracker-ios-build-workflow.md`): `npm run ios:sync:simulator`, run the API with `npm run mobile:api`, launch the simulator build, sign in with a user whose `aiConsentDecidedAt` is NULL, and verify:
- Dashboard shows the consent panel; "Not now" replaces it with the deterministic daily coach; the panel does not return on reload.
- Programs → AI builder shows the consent panel when consent is off; "Allow AI coaching" opens the intake form.
- Settings toggle reflects the choice and flipping it works.

Reset between checks with: `sqlite3 prisma/dev.db "UPDATE AppSettings SET aiConsentDecidedAt = NULL, aiDataSharingEnabled = 0"` (dev DB only).

- [ ] **Step 3: Commit any fixes found**

```bash
git add -A && git commit -m "fix(consent): smoke-test fixes"   # only if changes were needed
```

---

### Task 9: Resolution Center reply, App Review notes, and deployment checklist

**Files:**
- Create: `docs/appstore/rejection-2026-07-27-response.md`
- Modify: `docs/appstore/SUBMISSION.md` (App Review Information notes)

**Interfaces:**
- Consumes: nothing — documentation of the finished work.

- [ ] **Step 1: Write the response document**

Create `docs/appstore/rejection-2026-07-27-response.md`:

```markdown
# Rejection response — 5.1.1(i) / 5.1.2(i) (submission 73ad0730, reviewed 2026-07-27)

## What Apple objected to
The app shares data with a third-party AI service (MiniMax) without in-app
disclosure of what is sent and to whom, and without asking permission first.

## What changed in build 18
- Just-in-time consent prompt before any AI surface activates (dashboard coach
  card and AI program builder, iOS and web). It names MiniMax, itemizes the data
  sent, states what is never sent, and offers Allow / Not now. AI coaching stays
  off by default; declining keeps all coaching on-device/on-server deterministic
  with no data shared.
- Privacy policy AI section expanded: itemizes categories sent to MiniMax,
  including program-builder intake (display name, goals, injury/limitation
  notes), and states permission is requested in-app before any sharing.
- Fixed: login username is no longer ever included in AI requests, matching the
  policy's promise.

## Deployment order (server first — memory: tracker-prod-setup)
1. Deploy the server (privacy policy, consent APIs, schema column
   `aiConsentDecidedAt` — run the prisma push/migration step on prod).
2. Reset the review account so the reviewer sees the prompt:
   `UPDATE AppSettings SET aiConsentDecidedAt = NULL, aiDataSharingEnabled = 0
    WHERE userId = (SELECT id FROM user WHERE username = 'demo');`
3. Archive and upload build 18 (distribution method: App Store Connect, never
   TestFlight Internal Only), attach to version 1.0, submit.

## Resolution Center reply (paste)
Thank you for the review. Progression's AI coaching is an optional feature that
is OFF by default; no user data is sent to any AI service until the user
explicitly opts in. In build 18 we have made this explicit in the app:

1. Before any AI feature first activates (the dashboard coach brief, or the AI
   program builder), the app now presents a consent prompt that discloses
   exactly what data would be sent (workout details; connected wearable
   recovery/sleep metrics; and, for the program builder, the user's display
   name and any injury notes they enter), identifies the recipient (MiniMax,
   our AI service provider), and asks for permission with Allow / Not now.
   Declining keeps all coaching fully functional using Progression's own
   deterministic calculations, with no data shared.
2. The same disclosure appears in Settings → Permissions, where the choice can
   be changed at any time.
3. Our privacy policy (https://progression.fit/privacy) has been updated to
   itemize the data categories shared with MiniMax, how they are collected, and
   their sole use (generating coaching responses).

To observe the flow with the demo review account (demo / demodemo): the consent
prompt appears on the dashboard immediately after sign-in, and again at
Programs → AI program builder if not yet accepted. No other third-party AI
services are used.
```

- [ ] **Step 2: Update SUBMISSION.md review notes**

In `docs/appstore/SUBMISSION.md`, in the "App Review Information" bullet, append to the Notes block:

```markdown
        PLUS (added for build 18, 5.1.1/5.1.2 remediation):
        "AI coaching is optional and off by default. On first use the app
        presents a consent prompt disclosing the data sent and naming the
        recipient (MiniMax); declining keeps all features working without
        data sharing. The demo account is reset so you will see this prompt
        on the dashboard right after sign-in."
```

Also add to "Before submitting": `- [ ] Reset demo account AI consent (see rejection-2026-07-27-response.md) so the reviewer sees the prompt.`

- [ ] **Step 3: Commit**

```bash
git add docs/appstore/
git commit -m "docs(appstore): 5.1.1/5.1.2 rejection response, review notes, deploy checklist"
```

---

## Out of scope (deliberately)

- **Ask Coach / exercise recap prompts:** these stay server-gated — without consent they use deterministic fallbacks and share nothing, which is compliant. The dashboard prompt is the app's landing surface, so every user (and the reviewer) meets the consent ask before any AI surface can matter.
- **Push-notification daily brief:** already consent-gated inside `buildDailyBrief`; no change.
- **Prod deployment itself** (server deploy, demo-account SQL, Xcode archive/upload): operational steps documented in Task 9's checklist, executed by the user or a follow-up session — not automatable from this repo.

## Self-review notes

- Spec coverage: consent modal web (Tasks 3-5) + mobile (Task 7); onboarding consent (Task 5 web via `/programs/new` routing, Task 7 mobile via ProgramsScreen — both entry paths from the wizards land on these gates); username fix (Task 2); consent-card + privacy-policy copy (Task 6); demo account + Resolution Center reply (Task 9). ✓
- Type consistency: `aiConsentUpdate(enabled, now)` (Tasks 1, 7 consume via API route unchanged); `AI_CONSENT_COPY` shape used in Tasks 3, 6; `AiConsentPrompt({ onDecided })` used in Tasks 4, 5; `ProgramBuilder({ aiConfigured, consentGranted })` produced/consumed in Task 5; payload flags `aiConsentUndecided` produced and consumed in Task 7. ✓
