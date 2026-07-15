import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the Capacitor iOS shell reach the dev server over the LAN.
  allowedDevOrigins: ["192.168.1.229"],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "capacitor://localhost" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization,Content-Type" },
          { key: "Access-Control-Expose-Headers", value: "set-auth-token" },
          { key: "Vary", value: "Origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
