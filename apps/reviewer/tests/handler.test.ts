import { describe, expect, it, vi } from "vitest";

import {
  REVIEW_PROTOCOL_VERSION,
  SEMANTIC_REVIEW_RULESET_VERSION,
  VISUAL_REVIEW_RULESET_VERSION,
  type SemanticReviewPayload,
  type VisualReviewPayload,
} from "@xiazi/contracts";
import { reviewInputHash, signReviewRequest } from "@xiazi/domain";

import type { ReviewerConfig } from "@/server/config";
import { handleReviewRequest } from "@/server/handler";
import type { ReviewerProvider } from "@/server/provider";
import { MemoryReplayStore } from "@/server/replay-store";

const bearerSecret = "review-bearer-secret-with-more-than-32-characters";
const hmacSecret = "review-hmac-secret-with-more-than-32-characters";
const now = () => new Date("2026-07-19T01:00:00.000Z");
const config: ReviewerConfig = {
  bearerSecret,
  hmacSecret,
  provider: "test-provider",
  model: "test-model",
  modelVersion: "test-model-2026-07-19",
  providerApiKey: "test-only-key",
  providerBaseUrl: "https://provider.example.com/v1",
  providerTimeoutMs: 1_000,
  maxConcurrency: 2,
  maxBodyBytes: 700_000,
  deploymentVersion: "test-sha",
  allowedAssetOrigins: ["https://assets.example.com"],
};

const semanticPayload: SemanticReviewPayload = {
  releaseCandidateId: "candidate-2026-07-20",
  source: {
    sourceId: "source-1",
    topicId: "topic-1",
    finalUrl: "https://news.example.com/story",
    pageTitle: "Verified story",
    snapshotText: "Evidence in the source snapshot. ".repeat(20),
    correctionMarkerDetected: false,
    retractionMarkerDetected: false,
    claims: [
      { field: "headlineFact", locale: "zh-CN", text: "中文标题事实" },
      { field: "intro", locale: "zh-CN", text: "中文介绍事实" },
      { field: "headlineFact", locale: "en-US", text: "English headline fact" },
      { field: "intro", locale: "en-US", text: "English introduction fact" },
    ],
  },
};

function semanticResult(payload = semanticPayload) {
  return {
    sourceId: payload.source.sourceId,
    topicId: payload.source.topicId,
    correctionStatus: payload.source.retractionMarkerDetected
      ? "retracted"
      : payload.source.correctionMarkerDetected ? "corrected" : "clear",
    rationale: "All exact claims were reviewed against the supplied snapshot.",
    claimResults: payload.source.claims.map((claim) => ({
      ...claim,
      status: "supported",
      rationale: "The supplied source supports this exact claim.",
      evidenceExcerpt: "Evidence in the source snapshot.",
    })),
  };
}

const posters = Array.from({ length: 18 }, (_, index) => ({
  url: `https://assets.example.com/release-assets/batch-1/${index}.png`,
  topicId: `topic-${Math.floor(index / 2) + 1}`,
  locale: (index % 2 === 0 ? "zh" : "en") as "zh" | "en",
  expectedNumber: Math.floor(index / 2) + 1,
  expectedTitle: `Expected title ${index}`,
  expectedDate: "2026-07-20",
  expectedSite: "xiazishuo.com" as const,
}));

const visualPayload: VisualReviewPayload = { assetBatchId: "batch-1", posters };

function visualResult(payload = visualPayload) {
  const reviews = payload.posters.map((poster) => ({
    topicId: poster.topicId,
    locale: poster.locale,
    ocrText: `${poster.expectedTitle} xiazishuo.com validated OCR text`,
    detectedNumber: poster.expectedNumber,
    detectedLanguage: poster.locale,
    titleMatches: true,
    dateMatches: true,
    siteMatches: true,
    themeMatches: true,
    xiaziMatches: true,
    doudoulongMatches: true,
    nearDuplicate: false,
    needsHumanReview: false,
    rationale: "All visual requirements match.",
  }));
  const comparisons = [];
  for (let left = 0; left < payload.posters.length; left += 1) {
    for (let right = left + 1; right < payload.posters.length; right += 1) {
      const sameTheme = payload.posters[left].topicId === payload.posters[right].topicId;
      comparisons.push({
        leftTopicId: payload.posters[left].topicId,
        leftLocale: payload.posters[left].locale,
        rightTopicId: payload.posters[right].topicId,
        rightLocale: payload.posters[right].locale,
        semanticSimilarity: sameTheme ? 0.75 : 0.2,
        sameTheme,
        nearDuplicate: false,
        needsHumanReview: false,
        rationale: sameTheme ? "Same bilingual topic." : "Distinct topics.",
      });
    }
  }
  return { assetBatchId: payload.assetBatchId, reviews, comparisons };
}

function provider(overrides: Partial<ReviewerProvider> = {}): ReviewerProvider {
  return {
    semantic: vi.fn(async (payload) => semanticResult(payload)),
    visual: vi.fn(async (payload) => visualResult(payload)),
    ...overrides,
  };
}

async function signedRequest(kind: "semantic" | "visual", payload: SemanticReviewPayload | VisualReviewPayload, options: {
  nonce?: string;
  inputHash?: string;
  bearer?: string;
} = {}) {
  const requestedAt = now().toISOString();
  const nonce = options.nonce || crypto.randomUUID().replaceAll("-", "");
  const body = {
    metadata: {
      protocolVersion: REVIEW_PROTOCOL_VERSION,
      rulesetVersion: kind === "semantic" ? SEMANTIC_REVIEW_RULESET_VERSION : VISUAL_REVIEW_RULESET_VERSION,
      requestId: crypto.randomUUID(),
      requestedAt,
      nonce,
      inputHash: options.inputHash || await reviewInputHash(payload),
    },
    payload,
  };
  const rawBody = JSON.stringify(body);
  const path = `/api/review/${kind}`;
  const signature = await signReviewRequest(hmacSecret, { timestamp: requestedAt, nonce, method: "POST", path, rawBody });
  return new Request(`https://reviewer.example.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.bearer || bearerSecret}`,
      "X-Xiazi-Review-Timestamp": requestedAt,
      "X-Xiazi-Review-Nonce": nonce,
      "X-Xiazi-Review-Signature": signature,
    },
    body: rawBody,
  });
}

function dependencies(customProvider = provider(), replayStore = new MemoryReplayStore()) {
  return { config, provider: customProvider, replayStore, now };
}

describe("reviewer service", () => {
  it("returns a versioned semantic response with the exact input hash", async () => {
    const request = await signedRequest("semantic", semanticPayload);
    const response = await handleReviewRequest(request, "semantic", dependencies());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.metadata.protocolVersion).toBe(REVIEW_PROTOCOL_VERSION);
    expect(body.metadata.inputHash).toBe(await reviewInputHash(semanticPayload));
    expect(body.result.claimResults).toHaveLength(4);
  });

  it.each([
    ["missing claim", (result: ReturnType<typeof semanticResult>) => { result.claimResults.pop(); }],
    ["replaced claim text", (result: ReturnType<typeof semanticResult>) => { result.claimResults[0].text = "replaced"; }],
    ["duplicate claim", (result: ReturnType<typeof semanticResult>) => { result.claimResults[3] = { ...result.claimResults[0] }; }],
  ])("fails closed for %s", async (_label, mutate) => {
    const result = semanticResult();
    mutate(result);
    const response = await handleReviewRequest(
      await signedRequest("semantic", semanticPayload),
      "semantic",
      dependencies(provider({ semantic: vi.fn(async () => result) })),
    );
    expect(response.status).toBe(422);
  });

  it("fails when a correction marker is ignored", async () => {
    const payload = structuredClone(semanticPayload);
    payload.source.correctionMarkerDetected = true;
    const result = semanticResult(payload);
    result.correctionStatus = "clear";
    const response = await handleReviewRequest(
      await signedRequest("semantic", payload),
      "semantic",
      dependencies(provider({ semantic: vi.fn(async () => result) })),
    );
    expect(response.status).toBe(422);
  });

  it("fails when a retraction marker is ignored", async () => {
    const payload = structuredClone(semanticPayload);
    payload.source.retractionMarkerDetected = true;
    const result = semanticResult(payload);
    result.correctionStatus = "clear";
    const response = await handleReviewRequest(
      await signedRequest("semantic", payload),
      "semantic",
      dependencies(provider({ semantic: vi.fn(async () => result) })),
    );
    expect(response.status).toBe(422);
  });

  it("rejects an input hash mismatch", async () => {
    const response = await handleReviewRequest(
      await signedRequest("semantic", semanticPayload, { inputHash: "b".repeat(64) }),
      "semantic",
      dependencies(),
    );
    expect(response.status).toBe(422);
  });

  it("rejects invalid bearer authentication", async () => {
    const response = await handleReviewRequest(
      await signedRequest("semantic", semanticPayload, { bearer: "x".repeat(40) }),
      "semantic",
      dependencies(),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a request body above the configured byte limit", async () => {
    const request = await signedRequest("semantic", semanticPayload);
    const response = await handleReviewRequest(request, "semantic", {
      ...dependencies(),
      config: { ...config, maxBodyBytes: 100 },
    });
    expect(response.status).toBe(413);
  });

  it("rejects a replayed nonce", async () => {
    const store = new MemoryReplayStore();
    const nonce = "same-nonce-abcdefghijklmnop";
    const first = await handleReviewRequest(
      await signedRequest("semantic", semanticPayload, { nonce }),
      "semantic",
      dependencies(provider(), store),
    );
    const second = await handleReviewRequest(
      await signedRequest("semantic", semanticPayload, { nonce }),
      "semantic",
      dependencies(provider(), store),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(403);
  });

  it("fails closed when the provider times out", async () => {
    const response = await handleReviewRequest(
      await signedRequest("semantic", semanticPayload),
      "semantic",
      dependencies(provider({ semantic: vi.fn(async () => { throw new Error("REVIEW_PROVIDER_TIMEOUT"); }) })),
    );
    expect(response.status).toBe(503);
  });

  it("enforces the configured concurrency limit", async () => {
    let releaseFirst: (() => void) | undefined;
    const blockingProvider = provider({
      semantic: vi.fn(async (payload) => {
        await new Promise<void>((resolve) => { releaseFirst = resolve; });
        return semanticResult(payload);
      }),
    });
    const limited = { ...config, maxConcurrency: 1 };
    const first = handleReviewRequest(
      await signedRequest("semantic", semanticPayload),
      "semantic",
      { config: limited, provider: blockingProvider, replayStore: new MemoryReplayStore(), now },
    );
    await vi.waitFor(() => expect(blockingProvider.semantic).toHaveBeenCalledTimes(1));
    const second = await handleReviewRequest(
      await signedRequest("semantic", semanticPayload),
      "semantic",
      { config: limited, provider: blockingProvider, replayStore: new MemoryReplayStore(), now },
    );
    expect(second.status).toBe(429);
    releaseFirst?.();
    expect((await first).status).toBe(200);
  });

  it("returns a complete 18-poster and 153-pair visual review", async () => {
    const response = await handleReviewRequest(
      await signedRequest("visual", visualPayload),
      "visual",
      dependencies(),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result.reviews).toHaveLength(18);
    expect(body.result.comparisons).toHaveLength(153);
  });

  it.each([
    ["missing poster", (result: ReturnType<typeof visualResult>) => { result.reviews.pop(); }],
    ["missing comparison", (result: ReturnType<typeof visualResult>) => { result.comparisons.pop(); }],
    ["duplicate comparison", (result: ReturnType<typeof visualResult>) => { result.comparisons[152] = { ...result.comparisons[0] }; }],
    ["unknown slot", (result: ReturnType<typeof visualResult>) => { result.reviews[0].topicId = "unknown"; }],
  ])("fails closed for visual response with %s", async (_label, mutate) => {
    const result = visualResult();
    mutate(result);
    const response = await handleReviewRequest(
      await signedRequest("visual", visualPayload),
      "visual",
      dependencies(provider({ visual: vi.fn(async () => result) })),
    );
    expect(response.status).toBe(422);
  });
});
