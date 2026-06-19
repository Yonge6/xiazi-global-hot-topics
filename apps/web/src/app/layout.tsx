import type { Metadata } from "next";
import "./globals.css";

import { productConfig } from "@xiazi/config";

export const metadata: Metadata = {
  metadataBase: new URL(productConfig.siteUrl),
  title: {
    default: "虾子曰全球热点海报",
    template: "%s | 虾子曰",
  },
  description: "用 9 个全球热点、18 张双语海报，把复杂世界讲清楚。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const posterOrigin = process.env.NEXT_PUBLIC_COS_BASE_URL
    ?? "https://vilesaint-posters-1258992379.cos-website.ap-hongkong.myqcloud.com";

  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <head>
        <link rel="dns-prefetch" href={posterOrigin} />
        <link rel="preconnect" href={posterOrigin} crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
