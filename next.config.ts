import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: true,
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? "/vilesaint" : "",
  assetPrefix: isGitHubPages ? "/vilesaint" : "",
  async headers() {
    return [
      {
        source: "/posters/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
