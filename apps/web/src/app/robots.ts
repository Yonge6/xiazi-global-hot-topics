import type { MetadataRoute } from "next";

import { productConfig } from "@/config/product";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = productConfig.siteUrl;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/admin/", "/zh/admin/", "/en/admin/"] },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
