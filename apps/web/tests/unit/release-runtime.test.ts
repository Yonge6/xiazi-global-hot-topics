import { describe, expect, it } from "vitest";

import { releaseApprovalMode, releaseReviewDecision } from "@/server/releases/release-runtime";

describe("release runtime policy", () => {
  it("defaults to enforced review and human approval", () => {
    expect(releaseReviewDecision({ NODE_ENV: "production" })).toEqual({
      reviewStatus: "passed",
      reviewPassed: true,
      reviewWaived: false,
    });
    expect(releaseApprovalMode({ NODE_ENV: "production" })).toBe("human");
  });

  it("requires a complete, production-only waiver record", () => {
    expect(() => releaseReviewDecision({
      NODE_ENV: "production",
      RELEASE_ENVIRONMENT: "staging",
      RELEASE_REVIEW_MODE: "waived",
      RELEASE_REVIEW_WAIVER_ID: "owner-risk-acceptance-2026-07",
      RELEASE_REVIEW_WAIVER_REASON: "Owner explicitly accepts reviewer risk for launch",
      RELEASE_REVIEW_WAIVER_CONFIGURED_BY: "project-owner",
      RELEASE_REVIEW_WAIVER_CONFIGURED_AT: "2026-07-21T02:00:00.000Z",
    })).toThrow("RELEASE_REVIEW_WAIVER_PRODUCTION_ONLY");
    expect(() => releaseReviewDecision({
      NODE_ENV: "test",
      RELEASE_REVIEW_MODE: "waived",
    })).toThrow("RELEASE_REVIEW_WAIVER_INCOMPLETE");
  });

  it("records waived as not passed without fictional reviewer data", () => {
    expect(releaseReviewDecision({
      NODE_ENV: "test",
      RELEASE_REVIEW_MODE: "waived",
      RELEASE_REVIEW_WAIVER_ID: "owner-risk-acceptance-2026-07",
      RELEASE_REVIEW_WAIVER_REASON: "Owner explicitly accepts reviewer risk for launch",
      RELEASE_REVIEW_WAIVER_CONFIGURED_BY: "project-owner",
      RELEASE_REVIEW_WAIVER_CONFIGURED_AT: "2026-07-21T02:00:00.000Z",
    })).toEqual({
      reviewStatus: "waived",
      reviewPassed: false,
      reviewWaived: true,
      waiverId: "owner-risk-acceptance-2026-07",
      waiverReason: "Owner explicitly accepts reviewer risk for launch",
      configuredBy: "project-owner",
      configuredAt: "2026-07-21T02:00:00.000Z",
    });
  });

  it("requires an explicit production marker for automatic approval", () => {
    expect(() => releaseApprovalMode({
      NODE_ENV: "production",
      RELEASE_ENVIRONMENT: "staging",
      RELEASE_APPROVAL_MODE: "automatic",
    })).toThrow("RELEASE_AUTOMATIC_APPROVAL_PRODUCTION_ONLY");
    expect(releaseApprovalMode({
      NODE_ENV: "test",
      RELEASE_APPROVAL_MODE: "automatic",
    })).toBe("automatic");
  });
});
