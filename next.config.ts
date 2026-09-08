import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud / browser previews often hit 127.0.0.1 while `next dev` binds localhost.
  // Without this, Next 16 blocks /_next/* and the client never hydrates.
  allowedDevOrigins: ["127.0.0.1", "localhost", "172.30.0.2"],
};

export default nextConfig;
