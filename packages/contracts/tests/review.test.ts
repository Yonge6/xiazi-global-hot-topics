import { describe, expect, it } from "vitest";

import {
  REVIEW_PROTOCOL_VERSION,
  SEMANTIC_REVIEW_RULESET_VERSION,
  semanticReviewRequestSchema,
  visualReviewResponseSchema,
} from "../src";

const hash = "a".repeat(64);

describe("review protocol contracts", () => {
  it("accepts exactly four unique semantic claims", () => {
    const request = semanticReviewRequestSchema.parse({
      metadata: {
        protocolVersion: REVIEW_PROTOCOL_VERSION,
        rulesetVersion: SEMANTIC_REVIEW_RULESET_VERSION,
        requestId: "c690dce9-69df-4ca6-a112-7cc9f6a4a276",
        requestedAt: "2026-07-19T01:00:00Z",
        nonce: "abcdefghijklmnopqrstuvwx",
        inputHash: hash,
      },
      payload: {
        releaseCandidateId: "candidate-1",
        source: {
          sourceId: "source-1",
          topicId: "topic-1",
          finalUrl: "https://example.com/story",
          pageTitle: "Story",
          snapshotText: "Source evidence ".repeat(20),
          correctionMarkerDetected: false,
          retractionMarkerDetected: false,
          claims: [
            { field: "headlineFact", locale: "zh-CN", text: "中文标题事实" },
            { field: "intro", locale: "zh-CN", text: "中文介绍事实" },
            { field: "headlineFact", locale: "en-US", text: "English headline fact" },
            { field: "intro", locale: "en-US", text: "English introduction fact" },
          ],
        },
      },
    });
    expect(request.payload.source.claims).toHaveLength(4);
  });

  it("rejects duplicated semantic claim slots", () => {
    const base = [
      { field: "headlineFact", locale: "zh-CN", text: "中文标题事实" },
      { field: "intro", locale: "zh-CN", text: "中文介绍事实" },
      { field: "headlineFact", locale: "en-US", text: "English headline fact" },
      { field: "headlineFact", locale: "en-US", text: "Duplicated slot" },
    ];
    const result = semanticReviewRequestSchema.safeParse({
      metadata: {
        protocolVersion: REVIEW_PROTOCOL_VERSION,
        rulesetVersion: SEMANTIC_REVIEW_RULESET_VERSION,
        requestId: "c690dce9-69df-4ca6-a112-7cc9f6a4a276",
        requestedAt: "2026-07-19T01:00:00Z",
        nonce: "abcdefghijklmnopqrstuvwx",
        inputHash: hash,
      },
      payload: {
        releaseCandidateId: "candidate-1",
        source: {
          sourceId: "source-1",
          topicId: "topic-1",
          finalUrl: "https://example.com/story",
          pageTitle: "Story",
          snapshotText: "Source evidence ".repeat(20),
          correctionMarkerDetected: false,
          retractionMarkerDetected: false,
          claims: base,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects visual results with duplicate comparison pairs", () => {
    const reviews = Array.from({ length: 18 }, (_, index) => ({
      topicId: `topic-${Math.floor(index / 2) + 1}`,
      locale: index % 2 === 0 ? "zh" : "en",
      ocrText: "Validated OCR text",
      detectedNumber: Math.floor(index / 2) + 1,
      detectedLanguage: index % 2 === 0 ? "zh" : "en",
      titleMatches: true,
      dateMatches: true,
      siteMatches: true,
      themeMatches: true,
      xiaziMatches: true,
      doudoulongMatches: true,
      nearDuplicate: false,
      needsHumanReview: false,
      rationale: "Validated",
    }));
    const comparisons = Array.from({ length: 153 }, () => ({
      leftTopicId: "topic-1",
      leftLocale: "zh",
      rightTopicId: "topic-1",
      rightLocale: "en",
      semanticSimilarity: 0.7,
      sameTheme: true,
      nearDuplicate: false,
      needsHumanReview: false,
      rationale: "Duplicate pair for negative test",
    }));
    const result = visualReviewResponseSchema.safeParse({
      metadata: {
        protocolVersion: REVIEW_PROTOCOL_VERSION,
        rulesetVersion: "visual-2026-07-19.1",
        provider: "test",
        model: "test-model",
        modelVersion: "test-model-v1",
        requestId: "c690dce9-69df-4ca6-a112-7cc9f6a4a276",
        inputHash: hash,
        reviewedAt: "2026-07-19T01:00:00Z",
        durationMs: 1,
      },
      result: { assetBatchId: "batch-1", reviews, comparisons },
    });
    expect(result.success).toBe(false);
  });
});
