export type ReviewerConfig = {
  bearerSecret: string;
  hmacSecret: string;
  provider: string;
  model: string;
  modelVersion: string;
  providerApiKey: string;
  providerBaseUrl: string;
  providerTimeoutMs: number;
  maxConcurrency: number;
  maxBodyBytes: number;
  deploymentVersion: string;
  allowedAssetOrigins: string[];
  replayStoreUrl?: string;
  replayStoreToken?: string;
  replayStoreProvider: "redis-rest" | "supabase";
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`REVIEWER_CONFIG_MISSING:${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || String(fallback), 10);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`REVIEWER_CONFIG_INVALID:${name}`);
  return value;
}

export function reviewerConfigFromEnv(): ReviewerConfig {
  if (process.env.NODE_ENV === "production" && process.env.REVIEW_PROVIDER_NAME === "mock") {
    throw new Error("REVIEWER_MOCK_FORBIDDEN_IN_PRODUCTION");
  }
  const bearerSecret = required("REVIEW_BEARER_SECRET");
  const hmacSecret = required("REVIEW_HMAC_SECRET");
  if (bearerSecret.length < 32 || hmacSecret.length < 32) throw new Error("REVIEWER_SECRET_TOO_SHORT");
  const replayStoreProvider = process.env.REVIEW_REPLAY_STORE_PROVIDER || "redis-rest";
  if (replayStoreProvider !== "redis-rest" && replayStoreProvider !== "supabase") {
    throw new Error("REVIEWER_CONFIG_INVALID:REVIEW_REPLAY_STORE_PROVIDER");
  }
  const config: ReviewerConfig = {
    bearerSecret,
    hmacSecret,
    provider: required("REVIEW_PROVIDER_NAME"),
    model: required("REVIEW_MODEL"),
    modelVersion: required("REVIEW_MODEL_VERSION"),
    providerApiKey: required("OPENAI_API_KEY"),
    providerBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    providerTimeoutMs: positiveInteger("REVIEW_PROVIDER_TIMEOUT_MS", 90_000),
    maxConcurrency: positiveInteger("REVIEW_MAX_CONCURRENCY", 2),
    maxBodyBytes: positiveInteger("REVIEW_MAX_BODY_BYTES", 700_000),
    deploymentVersion: process.env.REVIEW_DEPLOYMENT_VERSION || "local",
    allowedAssetOrigins: (process.env.REVIEW_ALLOWED_ASSET_ORIGINS || "https://xiazishuo.com")
      .split(",")
      .map((value) => new URL(value.trim()).origin),
    replayStoreUrl: process.env.REVIEW_REPLAY_STORE_URL,
    replayStoreToken: process.env.REVIEW_REPLAY_STORE_TOKEN,
    replayStoreProvider,
  };
  const providerUrl = new URL(config.providerBaseUrl);
  if (process.env.NODE_ENV === "production" && providerUrl.protocol !== "https:") {
    throw new Error("REVIEWER_PROVIDER_HTTPS_REQUIRED");
  }
  if (process.env.NODE_ENV === "production" && (!config.replayStoreUrl || !config.replayStoreToken)) {
    throw new Error("REVIEWER_DURABLE_REPLAY_STORE_REQUIRED");
  }
  if (process.env.NODE_ENV === "production" && config.allowedAssetOrigins.length === 0) {
    throw new Error("REVIEWER_ASSET_ORIGIN_REQUIRED");
  }
  return config;
}
