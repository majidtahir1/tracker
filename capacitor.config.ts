import type { CapacitorConfig } from "@capacitor/cli";

// The tracker is a server-rendered Next.js app, so the iOS shell loads the UI
// from a running server rather than bundled files. During development, point
// `server.url` at your Mac's LAN IP running `npm run dev`; for a standalone
// build, point it at your hosted deployment (https) and remove `cleartext`.
const config: CapacitorConfig = {
  appId: "com.majidtahir.tracker",
  appName: "Tracker",
  webDir: "public",
  server: {
    url: "http://192.168.1.229:3000",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
