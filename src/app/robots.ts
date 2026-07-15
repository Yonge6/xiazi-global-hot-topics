import type { MetadataRoute } from "next";

import { PRODUCTION_ORIGIN } from "@/lib/site/domain";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/admin/", "/zh/admin/", "/en/admin/"] },
    sitemap: `${PRODUCTION_ORIGIN}/sitemap.xml`,
  };
}
