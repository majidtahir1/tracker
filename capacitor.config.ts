import type { CapacitorConfig } from "@capacitor/cli";

// The tracker is a server-rendered Next.js app, so the iOS shell loads the UI
// from a running server rather than bundled files. Defaults to production;
// for development run `CAP_DEV_SERVER=http://<mac-lan-ip>:3000 npx cap sync ios`
// to point the shell at your local dev server (cleartext allowed there only).
const devServer = process.env.CAP_DEV_SERVER;

// Keep the WHOOP OAuth flow inside the webview (where the session lives).
// Google is deliberately NOT listed: Google blocks OAuth in embedded
// webviews, so that flow opens externally and completes session-less via the
// DB-backed OAuth state (lib/oauth-state.ts) + the public /connected page.
const OAUTH_HOSTS = ["api.prod.whoop.com", "*.whoop.com"];

const config: CapacitorConfig = {
  appId: "fit.progression.app",
  appName: "Tracker",
  webDir: "public",
  server: devServer
    ? { url: devServer, cleartext: true, allowNavigation: OAUTH_HOSTS }
    : { url: "https://progression.fit", allowNavigation: OAUTH_HOSTS },
  ios: {
    contentInset: "always",
  },
  plugins: {
    // Show pushes as banners even while the app is foregrounded — iOS
    // suppresses them by default when the app is on screen.
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
