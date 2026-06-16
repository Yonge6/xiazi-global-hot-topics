import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pluto.hk";
  return [
    { url: `${baseUrl}/zh`, lastModified: new Date(), alternates: { languages: { "zh-CN": `${baseUrl}/zh`, "en-US": `${baseUrl}/en` } } },
    { url: `${baseUrl}/en`, lastModified: new Date(), alternates: { languages: { "zh-CN": `${baseUrl}/zh`, "en-US": `${baseUrl}/en` } } },
  ];
}
