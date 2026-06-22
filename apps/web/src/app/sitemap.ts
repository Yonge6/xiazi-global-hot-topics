import type { MetadataRoute } from "next";

import { productConfig } from "@xiazi/config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = productConfig.siteUrl;
  return [
    { url: `${baseUrl}/zh`, lastModified: new Date(), alternates: { languages: { "zh-CN": `${baseUrl}/zh`, "en-US": `${baseUrl}/en` } } },
    { url: `${baseUrl}/en`, lastModified: new Date(), alternates: { languages: { "zh-CN": `${baseUrl}/zh`, "en-US": `${baseUrl}/en` } } },
  ];
}
