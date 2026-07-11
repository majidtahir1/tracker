import type { CapacitorConfig } from "@capacitor/cli";

// The tracker is a server-rendered Next.js app, so the iOS shell loads the UI
// from a running server rather than bundled files. Defaults to production;
// for development run `CAP_DEV_SERVER=http://<mac-lan-ip>:3000 npx cap sync ios`
// to point the shell at your local dev server (cleartext allowed there only).
const devServer = process.env.CAP_DEV_SERVER;

const config: CapacitorConfig = {
  appId: "com.majidtahir.tracker",
  appName: "Tracker",
  webDir: "public",
  server: devServer
    ? { url: devServer, cleartext: true }
    : { url: "https://progression.fit" },
  ios: {
    contentInset: "always",
  },
};

export default config;
