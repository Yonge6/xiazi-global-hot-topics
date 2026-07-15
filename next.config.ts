import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const productionSiteUrl = "https://xiazishuo.com";
const retiredHost = ["pluto", "hk"].join(".");
const configuredPublicUrls = [
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_POSTER_API_ORIGIN,
].filter((value): value is string => Boolean(value));

for (const configuredUrl of configuredPublicUrls) {
  const hostname = new URL(configuredUrl).hostname.toLowerCase();
  if (hostname === retiredHost || hostname.endsWith(`.${retiredHost}`)) {
    throw new Error(`Retired production domain is not allowed: ${hostname}`);
  }
}

const isCustomRootDomain = (process.env.NEXT_PUBLIC_SITE_URL || productionSiteUrl).includes("xiazishuo.com");
const githubPagesBasePath = isCustomRootDomain ? "" : process.env.GITHUB_PAGES_BASE_PATH || "/xiazi-global-hot-topics";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: true,
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? githubPagesBasePath : "",
  assetPrefix: isGitHubPages ? githubPagesBasePath : "",
  env: {
    NEXT_PUBLIC_BASE_PATH: isGitHubPages ? githubPagesBasePath : "",
    NEXT_PUBLIC_SITE_URL: productionSiteUrl,
  },
  async headers() {
    return [
      {
        source: "/posters/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
