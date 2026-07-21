import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const configuredSiteHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://xiazishuo.com").hostname.toLowerCase();
  } catch {
    return "";
  }
})();
const isXiaziDomain = configuredSiteHostname === "xiazishuo.com"
  || configuredSiteHostname.endsWith(".xiazishuo.com");
const githubPagesBasePath = isXiaziDomain ? "" : process.env.GITHUB_PAGES_BASE_PATH || "/xiazi-global-hot-topics";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@xiazi/api-client", "@xiazi/config", "@xiazi/contracts", "@xiazi/domain"],
  images: {
    unoptimized: true,
  },
  outputFileTracingExcludes: {
    "/*": ["./public/**/*"],
  },
  outputFileTracingIncludes: {
    "/*": ["./data/**/*"],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: true,
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? githubPagesBasePath : "",
  assetPrefix: isGitHubPages ? githubPagesBasePath : "",
  env: {
    NEXT_PUBLIC_BASE_PATH: isGitHubPages ? githubPagesBasePath : "",
    NEXT_PUBLIC_POSTER_API_ORIGIN: isGitHubPages ? "https://xiazishuo.com" : "",
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
