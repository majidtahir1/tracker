import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the Capacitor iOS shell reach the dev server over the LAN.
  allowedDevOrigins: ["192.168.1.229"],
};

export default nextConfig;
