export const POSTER_ASSET_NAMES = [
  "ai-governance",
  "supply-chain",
  "climate-adaptation",
  "space-orbit",
  "public-health",
  "world-cup",
  "cultural-heritage",
  "clean-energy",
  "high-seas",
  "world-cup-iran-new-zealand",
  "world-cup-france-senegal",
  "spacex-acquires-anysphere",
  "boj-rate-hike",
  "china-retail-sales-decline",
  "eu-us-trade-agreement",
  "g7-russia-sanctions",
  "us-iran-peace-signing",
  "softbank-openai-cybersecurity",
  "yum-sells-pizza-hut",
  "world-cup-messi-record",
  "us-iran-mou-signed",
  "fed-warsh-rate-signal",
  "g7-critical-minerals-alliance",
  "paramount-wbd-china-clearance",
  "china-employment-five-year-plan",
  "ai-drone-wingmen-production",
  "congo-ebola-response-strained",
  "un-hunger-hotspots-warning",
] as const;

export const posterNames: Record<string, string> = {
  "ai-governance-crossroads": "ai-governance",
  "trade-routes-rewired": "supply-chain",
  "climate-adaptation-city": "climate-adaptation",
  "space-economy-orbit": "space-orbit",
  "global-health-readiness": "public-health",
  "world-cup-global-stage": "world-cup",
  "culture-restoration-digital": "cultural-heritage",
  "energy-transition-grid": "clean-energy",
  "ocean-treaty-action": "high-seas",
  "world-cup-iran-new-zealand": "world-cup-iran-new-zealand",
  "spacex-acquires-anysphere": "spacex-acquires-anysphere",
  "boj-rate-hike": "boj-rate-hike",
  "china-retail-sales-decline": "china-retail-sales-decline",
  "eu-us-trade-agreement": "eu-us-trade-agreement",
  "g7-russia-sanctions": "g7-russia-sanctions",
  "us-iran-peace-signing": "us-iran-peace-signing",
  "softbank-openai-cybersecurity": "softbank-openai-cybersecurity",
  "yum-sells-pizza-hut": "yum-sells-pizza-hut",
};

export const DEFAULT_POSTER_ASSET = "/posters/default-poster.jpg";

export function resolvePosterName(slug: string) {
  return posterNames[slug] ?? slug;
}

export function getCosAsset(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_COS_BASE_URL?.replace(/\/$/, "");
  const relativePath = path.replace(/^\//, "");
  return baseUrl ? `${baseUrl}/${relativePath}` : `/${relativePath}`;
}

export function getArchivedPosterAsset(
  issueDate: string,
  slug: string,
  locale: "zh" | "en",
  variant: "original" | "thumbnail" = "original",
  cacheKey?: string | number,
) {
  const name = resolvePosterName(slug);
  const extension = variant === "thumbnail" ? "webp" : "png";
  const folder = variant === "thumbnail" ? "thumb/" : "";
  const query = cacheKey === undefined ? "" : `?v=${encodeURIComponent(String(cacheKey))}`;
  return `/archive/${issueDate}/posters/${folder}${locale}/${name}.${extension}${query}`;
}

export function getPosterAsset(
  slug: string,
  locale: "zh" | "en",
  variant: "original" | "thumbnail" = "original",
  cacheKey?: string | number,
) {
  const name = resolvePosterName(slug);
  const extension = variant === "thumbnail" ? "webp" : "png";
  const path = variant === "thumbnail"
    ? `/posters/thumb/${locale}/${name}.${extension}`
    : `/posters/${locale}/${name}.${extension}`;
  const query = new URLSearchParams();
  if (cacheKey !== undefined) query.set("v", String(cacheKey));
  const suffix = query.size ? `?${query.toString()}` : "";
  return `${path}${suffix}`;
}
