export const POSTER_ASSET_NAMES = [
  "overview",
  "uk-politics",
  "us-iran-talks",
  "colombia-election",
  "russia-ukraine",
  "europe-heatwave",
  "ai-digital-sovereignty",
  "china-us-critical-minerals",
  "world-cup-ronaldo-record",
  "us-iran-war-powers",
  "europe-heatwave-drownings",
  "peru-election-fujimori-sanchez",
  "bolivia-democracy-protests",
  "spacex-bond-offering",
  "anthropic-claude-tag-slack",
  "us-spectrum-huawei-zte",
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
  "world-cup-colombia-uzbekistan",
  "us-iran-agreement-implementation",
  "ukraine-moscow-refinery-drone-strike",
  "apple-intel-us-chip-production",
  "noam-shazeer-openai",
  "china-ai-consumption-measures",
  "cuba-economic-reform",
  "uae-social-media-age-15",
  "spacex-ai-bond-offering",
  "anthropic-national-security",
  "world-cup-swiss-canada-colombia",
  "iran-inspections",
  "ukraine-crimea-power",
  "europe-omega-heatwave",
  "uk-burnham-transition",
  "meta-ai-model-review",
  "sk-hynix-nasdaq-listing",
  "qualcomm-bytedance-chip",
] as const;

export const posterNames: Record<string, string> = {
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
  "ai-governance-crossroads": "anthropic-national-security",
};

export function withBasePath(path: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (!basePath || /^https?:\/\//.test(path)) return path;
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

export const DEFAULT_POSTER_ASSET = withBasePath("/posters/default-poster.jpg");

export function resolvePosterName(slug: string) {
  return posterNames[slug] ?? slug;
}

export function getCosAsset(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_COS_BASE_URL?.replace(/\/$/, "");
  const relativePath = path.replace(/^\//, "");
  return baseUrl ? `${baseUrl}/${relativePath}` : withBasePath(`/${relativePath}`);
}

export function getArchivedPosterAsset(
  issueDate: string,
  slug: string,
  locale: "zh" | "en",
  variant: "original" | "thumbnail" = "original",
  cacheKey?: string | number,
) {
  const name = resolvePosterName(slug);
  const query = new URLSearchParams({ issueDate });
  if (variant === "thumbnail") query.set("variant", "thumbnail");
  if (cacheKey !== undefined) query.set("v", String(cacheKey));
  return posterApiPath(`/api/posters/${locale}/${name}/?${query.toString()}`);
}

export function getPosterAsset(
  slug: string,
  locale: "zh" | "en",
  variant: "original" | "thumbnail" = "original",
  cacheKey?: string | number,
) {
  const name = resolvePosterName(slug);
  const query = new URLSearchParams();
  if (variant === "thumbnail") query.set("variant", "thumbnail");
  if (cacheKey !== undefined) query.set("v", String(cacheKey));
  const suffix = query.size ? `?${query.toString()}` : "";
  return posterApiPath(`/api/posters/${locale}/${name}/${suffix}`);
}

function posterApiPath(path: string) {
  const origin = process.env.NEXT_PUBLIC_POSTER_API_ORIGIN?.replace(/\/$/, "");
  return origin ? `${origin}${path}` : withBasePath(path);
}
