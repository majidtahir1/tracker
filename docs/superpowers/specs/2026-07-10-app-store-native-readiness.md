# iOS App Store Readiness — Guideline 4.2 & Native Surface — Design

**Date:** 2026-07-10
**Status:** Plan (not started). Prerequisite for a smooth App Store review.

## The problem

Today the iOS app is a Capacitor WKWebView whose `server.url` points at the
hosted web app. It bundles no real content and has **zero native functionality
and no offline capability**. Apple **Guideline 4.2 (Minimum Functionality)**
routinely rejects "a website bundled in a shell." Guideline **4.2.3** also
discourages apps that are unusable without a network connection.

Goal: add enough genuine native capability and resilience that the app reads as a
real app, not a web wrapper — and fix the things reviewers poke at.

## What Apple looks for (and our gaps)

| Reviewer concern | Current state | Plan |
|---|---|---|
| Native device features | none | Push (APNs), Camera, Haptics via Capacitor plugins |
| Works offline / degrades gracefully | blank screen when server down | offline fallback screen + cache last dashboard |
| Not just Safari-in-a-box | pure remote URL | native chrome: splash, app icon, status-bar theming, share |
| Privacy (health data) | photos served unauthenticated | privacy policy + authenticated media (see migration spec B) |
| Account deletion (Guideline 5.1.1(v)) | signup only | in-app "delete my account" flow |

## Scope — native features to add

Prioritized; ship the top items before first submission.

### 1. Push notifications (APNs) — highest value
- There is already a **disabled stub**: `lib/notifications.ts` →
  `NOTIFICATIONS_ENABLED = false` ("hidden until the iOS app lands with real push
  support"; commit `f6ac504`). This feature was designed for; wire it up.
- Add `@capacitor/push-notifications`, register for APNs, send the device token
  to the server (new table/route), and deliver via APNs (token-based auth key
  from Apple Developer). Server side: a small APNs sender in `lib/notifications`.
- Gives a concrete native capability + a re-engagement channel. Flip
  `NOTIFICATIONS_ENABLED` on behind an env/feature check.

### 2. Camera for progress photos
- Replace the web file-input with `@capacitor/camera` so users capture/pick
  photos natively. Pairs with migration spec B (authenticated upload/storage).

### 3. Offline resilience (Guideline 4.2.3)
- Detect no-connectivity (`@capacitor/network`) and show a branded offline screen
  instead of a blank webview.
- Optionally cache the last-rendered dashboard (service worker / Capacitor
  Preferences) so the app opens to *something* offline.

### 4. Native polish
- Real **app icon** + **launch/splash** (current `ios/App/App/public` has stale
  create-next-app placeholders).
- `@capacitor/status-bar` + `@capacitor/haptics`; respect the light/dark theme in
  the native status bar (ties into the theme work just shipped).
- Share/export a workout summary via the native share sheet.

### 5. Account & privacy compliance
- **Account deletion** in-app (Apple 5.1.1(v)) — a settings action that deletes
  the user and their data (the multi-user data model already scopes rows per
  user, so a cascade delete is feasible).
- **Privacy policy** URL + App Privacy nutrition labels (this app handles health
  data + WHOOP — declare it accurately).
- Fix **unauthenticated photo access** (migration spec B / DEPLOYMENT §2) before
  health imagery is public.

## Non-native but review-blocking

- **HTTPS only** — `server.url` must be `https://` with no `cleartext` (covered
  in DEPLOYMENT §5.1). App Transport Security will otherwise block it.
- **Stable production backend** — reviewers will exercise the live server; it must
  be up and seeded. Point at the home-lab prod domain, not a laptop.

## Rollout

1. Ship the hosted backend (DEPLOYMENT.md) so the app has a real server.
2. Implement features 1–4 (each its own `writing-plans` plan + branch). Feature 1
   (push) and 4 (icon/splash/offline screen) are the minimum to meaningfully
   reduce 4.2 risk.
3. Add account deletion + privacy policy (feature 5).
4. TestFlight internal build → fix review feedback → submit.

## Risk / reality check

Even with these, 4.2 is judgment-based; the single biggest lever is **≥1 real
native capability the web app can't provide** (push is the cleanest) plus **not
breaking when offline**. Budget for at least one rejection round and be ready to
cite the native features in the review notes.

## Out of scope

- Rewriting the app as fully native (SwiftUI) — the Capacitor approach is fine
  once it has real native features.
- Android/Play Store (separate track; Capacitor already scaffolds it if wanted).
