# App Store submission — checklist & assets

Everything needed to submit Progression, in the order App Store Connect wants it.
Copy for every text field lives in [listing-copy.md](listing-copy.md);
screenshots in [screenshots-6.9/](screenshots-6.9/) (1320×2868, the required
6.9" size — Apple derives smaller sizes from it, upload in numeric order).

Where: https://appstoreconnect.apple.com → My Apps → Progression → iOS App → 1.0.

## Before submitting

- [ ] Populate the `demo` account on prod: 2–3 logged workouts + a body weight
      (empty demo account = Guideline 2.1 rejection risk).
- [ ] Confirm prod is healthy: `curl -s https://progression.fit/login -o /dev/null -w "%{http_code}"` → 200.
- [ ] Reset demo account AI consent (see rejection-2026-07-27-response.md) so
      the reviewer sees the consent prompt on the dashboard.
- [ ] The TestFlight build you tested is the one you attach — no re-archive.
- [ ] When uploading from Xcode, ALWAYS choose the "App Store Connect"
      distribution method — "TestFlight Internal Only" builds are permanently
      ineligible for App Store submission (they appear greyed out in the
      version page's Add Build picker; this bit us on builds 2–12).

## Version page (iOS App → 1.0)

- [ ] Screenshots → 6.9" tab → drag the five PNGs in order.
- [ ] Promotional Text, Description, Keywords, Support URL,
      Marketing URL (optional) — from listing-copy.md.
      Privacy Policy URL: https://progression.fit/privacy
- [ ] Build → ＋ → select the TestFlight build.
- [ ] App Review Information:
      - Sign-in required ✓ — username `demo`, password `demodemo`
      - Notes: the "App Review Information → Notes" block in listing-copy.md,
        PLUS this line (Google consent screen is still in Testing mode):
        "The WHOOP and Fitbit/Google Health connections are optional
        integrations that require a physical wearable device and a
        third-party account; the Google integration is additionally in a
        limited test rollout pending Google's API verification. All app
        functionality is fully testable without them."
        PLUS (added for build 18, 5.1.1/5.1.2 remediation):
        "AI coaching is optional and off by default. On first use the app
        presents a consent prompt disclosing the data sent and naming the
        recipient (MiniMax); declining keeps all features working without
        data sharing. The demo account is reset so you will see this prompt
        on the dashboard right after sign-in."
      - Contact phone + email.
- [ ] Version Release: choose manual or automatic.

## Left sidebar (one-time)

- [ ] App Privacy questionnaire. Collected, all "linked to user", none
      "used for tracking": Health & Fitness (workouts, wearable recovery/
      sleep), Photos or Videos (progress photos), User Content (measurements,
      notes), Identifiers (user account ID). No third-party ads.
- [ ] Pricing and Availability: Free ($0). Launch decision: free, no IAP in
      v1 — the future paywall boundary is the AI coach (see session notes,
      2026-07-16).
- [ ] General → App Information: name "Progression: Lifting Coach",
      subtitle, Health & Fitness category, age rating questionnaire
      (all "None" → 4+).

## Submit

- [ ] Version page → Add for Review → Submit to App Review.
      Typical turnaround 24–48 h. Rejections arrive in Resolution Center
      with a guideline number.

## Known follow-ups (not blockers)

- Google OAuth verification (Restricted health scopes): consent screen is in
  Testing — only allowlisted test users can connect Fitbit, refresh tokens
  expire every 7 days. Start verification in Google Cloud Console (OAuth
  consent screen → Publish app); lands around v1.1.
- v1.1 headline feature: Apple Health / HealthKit integration.
- Screenshot nit: 01-dashboard shows "PRs this block: 0" — retake from the
  populated demo account if it bothers you.
