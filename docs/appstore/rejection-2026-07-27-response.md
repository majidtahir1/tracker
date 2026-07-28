# Rejection response — 5.1.1(i) / 5.1.2(i) (submission 73ad0730, reviewed 2026-07-27)

## What Apple objected to

The app shares data with a third-party AI service (MiniMax) without in-app
disclosure of what is sent and to whom, and without asking permission first.

## What changed in build 19

- Just-in-time consent prompt before any AI surface activates (dashboard coach
  card and AI program builder, iOS and web). It names MiniMax, itemizes the data
  sent, states what is never sent, and offers Allow / Not now. AI coaching stays
  off by default; declining keeps all coaching on-server deterministic with no
  data shared.
- Privacy policy AI section expanded: itemizes categories sent to MiniMax,
  including program-builder intake (display name, goals, injury/limitation
  notes), and states permission is requested in-app before any sharing.
- Fixed: login username is no longer ever included in AI requests, matching the
  policy's promise.

## Deployment order (server first — see tracker-prod-setup notes)

1. Deploy the server (privacy policy, consent APIs, new schema column
   `AppSettings.aiConsentDecidedAt` — run the prisma push/migration step on
   prod).
2. Reset the review account so the reviewer sees the prompt:
   ```sql
   UPDATE AppSettings SET aiConsentDecidedAt = NULL, aiDataSharingEnabled = 0
   WHERE userId = (SELECT id FROM user WHERE username = 'demo');
   ```
3. `npm run ios:sync` (bakes https://progression.fit — never the simulator
   variant), archive and upload build 19 (distribution method: App Store
   Connect, never TestFlight Internal Only), attach to version 1.0, submit.

## Resolution Center reply (paste)

Thank you for the review. Progression's AI coaching is an optional feature that
is OFF by default; no user data is sent to any AI service until the user
explicitly opts in. In build 19 we have made this explicit in the app:

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
