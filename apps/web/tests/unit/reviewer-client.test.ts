import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REVIEW_PROTOCOL_VERSION,
  SEMANTIC_REVIEW_RULESET_VERSION,
  type SemanticReviewPayload,
} from "@xiazi/contracts";
import { requestSemanticReview } from "@/server/releases/reviewer-client";

const payload: SemanticReviewPayload = {
  releaseCandidateId: "candidate-1",
  source: {
    sourceId: "source-1",
    topicId: "topic-1",
    finalUrl: "https://news.example.com/story",
    pageTitle: "Story",
    snapshotText: "Verified source snapshot evidence. ".repeat(20),
    correctionMarkerDetected: false,
    retractionMarkerDetected: false,
    claims: [
      { field: "headlineFact", locale: "zh-CN", text: "中文事实标题" },
      { field: "intro", locale: "zh-CN", text: "中文事实介绍" },
      { field: "headlineFact", locale: "en-US", text: "English factual headline" },
      { field: "intro", locale: "en-US", text: "English factual introduction" },
    ],
  },
};

describe("reviewer client", () => {
  beforeEach(() => {
    vi.stubEnv("SOURCE_SEMANTIC_REVIEW_URL", "https://reviewer.example.com/api/review/semantic");
    vi.stubEnv("RELEASE_REVIEW_BEARER_SECRET", "bearer-secret-with-at-least-thirty-two-characters");
    vi.stubEnv("RELEASE_REVIEW_SIGNING_SECRET", "signing-secret-with-at-least-thirty-two-characters");
    vi.stubEnv("RELEASE_REVIEW_TIMEOUT_MS", "1000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("signs the request and accepts only an identity-matched response", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      expect(init?.headers).toMatchObject({
        Authorization: expect.stringMatching(/^Bearer /),
        "X-Xiazi-Review-Signature": expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      return Response.json({
        metadata: {
          protocolVersion: REVIEW_PROTOCOL_VERSION,
          rulesetVersion: SEMANTIC_REVIEW_RULESET_VERSION,
          provider: "reviewer-test",
          model: "test-model",
          modelVersion: "test-model-v1",
          requestId: request.metadata.requestId,
          inputHash: request.metadata.inputHash,
          reviewedAt: "2026-07-19T01:00:00Z",
          durationMs: 12,
        },
        result: {
          sourceId: payload.source.sourceId,
          topicId: payload.source.topicId,
          correctionStatus: "clear",
          rationale: "All claims supported.",
          claimResults: payload.source.claims.map((claim) => ({
            ...claim,
            status: "supported",
            rationale: "Supported by the source.",
            evidenceExcerpt: "Verified source snapshot evidence.",
          })),
        },
      });
    }));
    const result = await requestSemanticReview(payload);
    expect(result.result.claimResults).toHaveLength(4);
  });

  it.each([401, 403, 500])("fails closed on reviewer HTTP %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("failed", { status })));
    await expect(requestSemanticReview(payload)).rejects.toThrow(`SOURCE_SEMANTIC_REVIEW_FAILED:${status}`);
  });

  it("fails closed on malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json", { status: 200 })));
    await expect(requestSemanticReview(payload)).rejects.toThrow(/MALFORMED_JSON/);
  });

  it("fails closed when the reviewer echoes a different input hash", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      return Response.json({
        metadata: {
          protocolVersion: REVIEW_PROTOCOL_VERSION,
          rulesetVersion: SEMANTIC_REVIEW_RULESET_VERSION,
          provider: "reviewer-test",
          model: "test-model",
          modelVersion: "test-model-v1",
          requestId: request.metadata.requestId,
          inputHash: "f".repeat(64),
          reviewedAt: "2026-07-19T01:00:00Z",
          durationMs: 12,
        },
        result: {
          sourceId: payload.source.sourceId,
          topicId: payload.source.topicId,
          correctionStatus: "clear",
          rationale: "All claims supported.",
          claimResults: payload.source.claims.map((claim) => ({
            ...claim,
            status: "supported",
            rationale: "Supported.",
            evidenceLocator: "paragraph 1",
          })),
        },
      });
    }));
    await expect(requestSemanticReview(payload)).rejects.toThrow(/IDENTITY_MISMATCH/);
  });

  it("fails closed on timeout", async () => {
    vi.stubEnv("RELEASE_REVIEW_TIMEOUT_MS", "5");
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    await expect(requestSemanticReview(payload)).rejects.toThrow(/TIMEOUT/);
  });
});
