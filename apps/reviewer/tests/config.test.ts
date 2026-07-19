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

  it("requires explicit model and model-version configuration", () => {
    validEnvironment();
    vi.stubEnv("REVIEW_MODEL", "");
    expect(() => reviewerConfigFromEnv()).toThrow(/REVIEW_MODEL/);
  });
});
