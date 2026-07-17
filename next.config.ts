import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bull", "ioredis", "twilio"],
  experimental: {},
  logging: {
    fetches: { fullUrl: false },
  },
};

export default nextConfig;
