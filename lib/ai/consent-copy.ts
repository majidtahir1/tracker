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
