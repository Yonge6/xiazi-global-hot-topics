import type { Metadata } from "next";

import { PRODUCTION_ORIGIN } from "@/lib/site/domain";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_ORIGIN),
  title: {
    default: "虾子曰全球热点海报",
    template: "%s | 虾子曰",
  },
  description: "用 9 个全球热点、18 张双语海报，把复杂世界讲清楚。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const posterOrigin = process.env.NEXT_PUBLIC_COS_BASE_URL;

  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <head>
        {posterOrigin ? (
          <>
            <link rel="dns-prefetch" href={posterOrigin} />
            <link rel="preconnect" href={posterOrigin} crossOrigin="anonymous" />
          </>
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
