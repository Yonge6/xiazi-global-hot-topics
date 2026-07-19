import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@xiazi/contracts", "@xiazi/domain"],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
