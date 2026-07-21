import { afterEach, describe, expect, it, vi } from "vitest";

import { reviewerConfigFromEnv } from "@/server/config";

function validEnvironment() {
  vi.stubEnv("REVIEW_BEARER_SECRET", "bearer-secret-with-at-least-thirty-two-characters");
  vi.stubEnv("REVIEW_HMAC_SECRET", "signing-secret-with-at-least-thirty-two-characters");
  vi.stubEnv("REVIEW_PROVIDER_NAME", "openai");
  vi.stubEnv("REVIEW_MODEL", "version-locked-model");
  vi.stubEnv("REVIEW_MODEL_VERSION", "version-locked-model-snapshot");
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
}

afterEach(() => vi.unstubAllEnvs());

describe("reviewer production configuration", () => {
  it("forbids a production mock reviewer", () => {
    validEnvironment();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REVIEW_PROVIDER_NAME", "mock");
    expect(() => reviewerConfigFromEnv()).toThrow(/MOCK_FORBIDDEN/);
  });

  it("requires a durable replay store in production", () => {
    validEnvironment();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => reviewerConfigFromEnv()).toThrow(/DURABLE_REPLAY_STORE_REQUIRED/);
  });

  it("accepts an explicit Supabase durable replay store", () => {
    validEnvironment();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REVIEW_REPLAY_STORE_PROVIDER", "supabase");
    vi.stubEnv("REVIEW_REPLAY_STORE_URL", "https://staging-project.supabase.co");
    vi.stubEnv("REVIEW_REPLAY_STORE_TOKEN", "staging-service-role-test-token");
    expect(reviewerConfigFromEnv().replayStoreProvider).toBe("supabase");
  });

  it("rejects unknown replay store providers", () => {
    validEnvironment();
    vi.stubEnv("REVIEW_REPLAY_STORE_PROVIDER", "memory");
    expect(() => reviewerConfigFromEnv()).toThrow(/REVIEW_REPLAY_STORE_PROVIDER/);
  });

  it("allows the controlled fault provider only in staging", () => {
    validEnvironment();
    vi.stubEnv("REVIEW_PROVIDER_NAME", "staging-fault-fixture");
    vi.stubEnv("OPENAI_BASE_URL", "https://web-staging.example/api/staging/openai-fixture");
    expect(() => reviewerConfigFromEnv()).toThrow("REVIEWER_FAULT_PROVIDER_STAGING_ONLY");
    vi.stubEnv("REVIEW_ENVIRONMENT", "staging");
    expect(reviewerConfigFromEnv().provider).toBe("staging-fault-fixture");
  });

  it("requires explicit model and model-version configuration", () => {
    validEnvironment();
    vi.stubEnv("REVIEW_MODEL", "");
    expect(() => reviewerConfigFromEnv()).toThrow(/REVIEW_MODEL/);
  });
});
