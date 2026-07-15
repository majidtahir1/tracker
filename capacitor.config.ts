import type { CapacitorConfig } from "@capacitor/cli";

// Production ships the Vite UI from webDir. CAP_DEV_SERVER remains available
// for optional live-reload work; normal simulator builds also use the bundled
// UI and bake in a local API URL through `npm run ios:sync:simulator`.
const devServer = process.env.CAP_DEV_SERVER;

// Keep the WHOOP OAuth flow inside the webview (where the session lives).
// Google is deliberately NOT listed: Google blocks OAuth in embedded
// webviews, so that flow opens externally and completes session-less via the
// DB-backed OAuth state (lib/oauth-state.ts) + the public /connected page.
const OAUTH_HOSTS = ["api.prod.whoop.com", "*.whoop.com"];

const config: CapacitorConfig = {
  appId: "fit.progression.app",
  appName: "Tracker",
  webDir: "dist-mobile",
  server: devServer
    ? { url: devServer, cleartext: true, allowNavigation: OAUTH_HOSTS }
    : undefined,
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
