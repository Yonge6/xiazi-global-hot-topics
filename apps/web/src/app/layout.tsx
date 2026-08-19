import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

import { AdsenseLoader } from "@/components/adsense-loader";
import { productConfig } from "@xiazi/config";

const themeBootScript = `
  (function () {
    try {
      var saved = localStorage.getItem("xiazishuo-theme");
      var theme = saved === "light" || saved === "dark"
        ? saved
        : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {}
  })();
`;

export const metadata: Metadata = {
  metadataBase: new URL(productConfig.siteUrl),
  title: {
    default: "虾子曰全球热点海报",
    template: "%s | 虾子曰",
  },
  description: "用 9 个全球热点、18 张双语海报，把复杂世界讲清楚。",
  other: {
    "google-adsense-account": "ca-pub-7149426538357694",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const posterOrigin = process.env.NEXT_PUBLIC_COS_BASE_URL
    ?? productConfig.siteUrl;

  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="dns-prefetch" href={posterOrigin} />
        <link rel="preconnect" href={posterOrigin} crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <AdsenseLoader />
        <Script src="/analytics.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
