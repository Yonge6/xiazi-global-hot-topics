import assert from "node:assert/strict";
import test from "node:test";

import {
  assertActivePublication,
  assertDatabasePointer,
  assertReviewerIdentity,
  requireStagingEnvironment,
} from "../lib/staging-rehearsal.mjs";

function env(overrides = {}) {
  return {
    RELEASE_ENVIRONMENT: "staging",
    RELEASE_V2_ENABLED: "true",
    STAGING_DIRECT_COS_ORIGIN: "true",
    STAGING_COS_BUCKET: "xiazi-release-v2-staging-1234567890",
    STAGING_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    STAGING_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    STAGING_WEB_URL: "https://xiazi-release-v2-web-staging.vercel.app",
    STAGING_REVIEWER_URL: "https://xiazi-release-v2-reviewer-staging.vercel.app",
    ...overrides,
  };
}

test("accepts only isolated Direct COS staging resources", () => {
  assert.equal(requireStagingEnvironment(env()).projectRef, "abcdefghijklmnopqrst");
});

for (const [name, overrides] of [
  ["production web", { STAGING_WEB_URL: "https://xiazishuo.com" }],
  ["retired host", { STAGING_WEB_URL: "https://pluto.hk" }],
  ["CDN", { STAGING_CDN_URL: "https://cdn.example.com" }],
  ["wrong bucket", { STAGING_COS_BUCKET: "production-assets" }],
  ["wrong Supabase ref", { STAGING_SUPABASE_URL: "https://otherprojectrefxxxxx.supabase.co" }],
]) {
  test(`rejects ${name}`, () => assert.throws(() => requireStagingEnvironment(env(overrides)), /STAGING_GUARD/));
}

test("requires exact reviewer deployment identity", () => {
  assert.doesNotThrow(() => assertReviewerIdentity(
    { status: "ok", protocolVersion: "v1" },
    {
      protocolVersion: "v1",
      semanticRulesetVersion: "semantic-v1",
      visualRulesetVersion: "visual-v1",
      provider: "openai",
      modelVersion: "gpt-4o-2024-11-20",
      deploymentVersion: "abc123",
    },
    "abc123",
  ));
});

test("validates the full active release proof", () => {
  const publication = {
    releaseId: "rel_20260721_aaaaaaaaaaaaaaaaaaaaaaaa",
    assetVersion: "rel_20260721_aaaaaaaaaaaaaaaaaaaaaaaa",
    dataSource: "supabase-release",
    publicationHealth: "healthy",
    stale: false,
    contentHash: "a".repeat(64),
    releaseSchemaVersion: "release-v2.1",
    deployedAt: "2026-07-20T10:00:00.000Z",
    topics: Array.from({ length: 9 }, () => ({})),
  };
  assert.doesNotThrow(() => assertActivePublication(publication, publication.releaseId));
  assert.throws(() => assertActivePublication({ ...publication, stale: true }, publication.releaseId));
  assert.doesNotThrow(() => assertDatabasePointer({
    metadata: {
      releaseId: publication.releaseId,
      dataSource: "supabase-release",
      publicationHealth: "healthy",
      stale: false,
    },
  }, publication.releaseId));
});
