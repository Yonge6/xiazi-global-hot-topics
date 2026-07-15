import type { MetadataRoute } from "next";

import { PRODUCTION_ORIGIN } from "@/lib/site/domain";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${PRODUCTION_ORIGIN}/zh`, lastModified: new Date(), alternates: { languages: { "zh-CN": `${PRODUCTION_ORIGIN}/zh`, "en-US": `${PRODUCTION_ORIGIN}/en` } } },
    { url: `${PRODUCTION_ORIGIN}/en`, lastModified: new Date(), alternates: { languages: { "zh-CN": `${PRODUCTION_ORIGIN}/zh`, "en-US": `${PRODUCTION_ORIGIN}/en` } } },
  ];
}
