import sharp from "sharp";

import type { Issue, PosterCandidate, PosterCheck, PublicationReviewDecision } from "@xiazi/contracts";
import { assertImmutableAssetUrl } from "@xiazi/domain";

import { sha256, stableHash } from "./release-hash";
import { requestVisualReview } from "./reviewer-client";

export type PosterVisionReview = {
  topicId: string;
  locale: "zh" | "en";
  ocrText: string;
  detectedNumber: number;
  detectedLanguage: "zh" | "en";
  titleMatches: boolean;
  dateMatches: boolean;
  siteMatches: boolean;
  themeMatches: boolean;
  xiaziMatches: boolean;
  doudoulongMatches: boolean;
  nearDuplicate: boolean;
  needsHumanReview: boolean;
  rationale: string;
};

export type PosterPairComparison = {
  leftTopicId: string;
  leftLocale: "zh" | "en";
  rightTopicId: string;
  rightLocale: "zh" | "en";
  semanticSimilarity: number;
  sameTheme: boolean;
  nearDuplicate: boolean;
  needsHumanReview: boolean;
  rationale: string;
};

export type PosterBatchVisionReview = {
  reviews: PosterVisionReview[];
  comparisons: PosterPairComparison[];
  provider: string;
  model?: string;
  modelVersion?: string;
  protocolVersion?: string;
  rulesetVersion?: string;
  requestId?: string;
  inputHash?: string;
  reviewedAt?: string;
  durationMs?: number;
};

export type PosterBatchVisionReviewer = (input: {
  assetBatchId: string;
  posters: Array<{
    url: string;
    topicId: string;
    locale: "zh" | "en";
    expectedNumber: number;
    expectedTitle: string;
    expectedDate: string;
    expectedSite: "xiazishuo.com";
  }>;
}) => Promise<PosterBatchVisionReview>;

type PosterGateOptions = {
  fetchImpl?: typeof fetch;
  reviewer?: PosterBatchVisionReviewer;
  now?: () => Date;
  maxBytes?: number;
  perceptualDistanceThreshold?: number;
  semanticSimilarityThreshold?: number;
  reviewDecision?: PublicationReviewDecision;
};

type PreparedPoster = {
  candidate: PosterCandidate;
  contentHash: string;
  perceptualHash: string;
  width: number;
  height: number;
};

export type PosterImageCheck = Omit<PosterCheck,
  | "sizeBytes"
  | "contentType"
  | "storageProvider"
  | "storageVersionId"
  | "etag"
  | "storageCreatedAt"
  | "uploaderVersion"
>;

function reviewerFromEnv(): PosterBatchVisionReviewer {
  return async (input) => {
    const response = await requestVisualReview(input);
    return {
      reviews: response.result.reviews,
      comparisons: response.result.comparisons,
      provider: response.metadata.provider,
      model: response.metadata.model,
      modelVersion: response.metadata.modelVersion,
      protocolVersion: response.metadata.protocolVersion,
      rulesetVersion: response.metadata.rulesetVersion,
      requestId: response.metadata.requestId,
      inputHash: response.metadata.inputHash,
      reviewedAt: response.metadata.reviewedAt,
      durationMs: response.metadata.durationMs,
    };
  };
}

function allowedPosterOrigins() {
  const origins = new Set(["https://xiazishuo.com"]);
  for (const value of [process.env.NEXT_PUBLIC_COS_BASE_URL, ...(process.env.RELEASE_ASSET_ORIGINS || "").split(",")]) {
    if (!value) continue;
    try {
      origins.add(new URL(value.trim()).origin);
    } catch {
      // Invalid configured origins are ignored and will not become trusted.
    }
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost");
    origins.add("http://127.0.0.1");
  }
  return origins;
}

function assertImmutablePosterUrl(value: string, assetBatchId: string) {
  try {
    assertImmutableAssetUrl(value, assetBatchId, allowedPosterOrigins());
  } catch (error) {
    throw new Error(`POSTER_PATH_NOT_IMMUTABLE:${error instanceof Error ? error.message : value}`);
  }
}

function slotKey(topicId: string, locale: "zh" | "en") {
  return `${topicId}:${locale}`;
}

function pairKey(
  leftTopicId: string,
  leftLocale: "zh" | "en",
  rightTopicId: string,
  rightLocale: "zh" | "en",
) {
  return [slotKey(leftTopicId, leftLocale), slotKey(rightTopicId, rightLocale)].sort().join("|");
}

function expectedCandidates(issue: Issue) {
  return issue.topics.flatMap((topic) => [slotKey(topic.id, "zh"), slotKey(topic.id, "en")]).sort();
}

function expectedPairKeys(candidates: PosterCandidate[]) {
  const keys = new Set<string>();
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      keys.add(pairKey(
        candidates[left].topicId,
        candidates[left].locale,
        candidates[right].topicId,
        candidates[right].locale,
      ));
    }
  }
  return keys;
}

function assertVisionReview(review: PosterVisionReview, expectedRank: number, expectedLocale: "zh" | "en", topicId: string) {
  const failures: string[] = [];
  if (review.topicId !== topicId) failures.push("topic");
  if (review.locale !== expectedLocale) failures.push("locale");
  if (review.detectedNumber !== expectedRank) failures.push("number");
  if (review.detectedLanguage !== expectedLocale) failures.push("language");
  if (!review.titleMatches) failures.push("title");
  if (!review.dateMatches) failures.push("date");
  if (!review.siteMatches) failures.push("site");
  if (!review.themeMatches) failures.push("theme");
  if (!review.xiaziMatches) failures.push("xiazi");
  if (!review.doudoulongMatches) failures.push("doudoulong");
  if (review.nearDuplicate) failures.push("nearDuplicate");
  if (review.needsHumanReview) failures.push("humanReview");
  if (!review.rationale.trim()) failures.push("rationale");
  if (failures.length) throw new Error(`POSTER_VISION_GATE_FAILED:${topicId}:${expectedLocale}:${failures.join(",")}`);
}

async function differenceHash(buffer: Buffer) {
  const pixels = await sharp(buffer).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer();
  let bits = BigInt(0);
  let offset = BigInt(0);
  const one = BigInt(1);
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      if (pixels[row * 9 + column] > pixels[row * 9 + column + 1]) bits |= one << offset;
      offset += one;
    }
  }
  return bits.toString(16).padStart(16, "0");
}

export function perceptualHashDistance(left: string, right: string) {
  let difference = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  const zero = BigInt(0);
  const one = BigInt(1);
  while (difference !== zero) {
    count += Number(difference & one);
    difference >>= one;
  }
  return count;
}

function assertBatchReview(
  review: PosterBatchVisionReview,
  candidates: PosterCandidate[],
  semanticSimilarityThreshold: number,
) {
  const expectedSlots = new Set(candidates.map((candidate) => slotKey(candidate.topicId, candidate.locale)));
  const actualSlots = new Set(review.reviews.map((item) => slotKey(item.topicId, item.locale)));
  if (review.reviews.length !== expectedSlots.size
    || actualSlots.size !== expectedSlots.size
    || [...expectedSlots].some((key) => !actualSlots.has(key))) {
    throw new Error("POSTER_BATCH_REVIEWS_INCOMPLETE");
  }

  const expectedPairs = expectedPairKeys(candidates);
  const comparisons = new Map<string, PosterPairComparison>();
  for (const comparison of review.comparisons) {
    const key = pairKey(
      comparison.leftTopicId,
      comparison.leftLocale,
      comparison.rightTopicId,
      comparison.rightLocale,
    );
    if (comparisons.has(key)
      || !expectedPairs.has(key)
      || !Number.isFinite(comparison.semanticSimilarity)
      || comparison.semanticSimilarity < 0
      || comparison.semanticSimilarity > 1
      || typeof comparison.sameTheme !== "boolean"
      || typeof comparison.nearDuplicate !== "boolean"
      || typeof comparison.needsHumanReview !== "boolean"
      || typeof comparison.rationale !== "string") {
      throw new Error(`POSTER_BATCH_COMPARISON_INVALID:${key}`);
    }
    comparisons.set(key, comparison);
  }
  if (comparisons.size !== expectedPairs.size) throw new Error("POSTER_BATCH_COMPARISONS_INCOMPLETE");

  for (const comparison of comparisons.values()) {
    const sameTopic = comparison.leftTopicId === comparison.rightTopicId;
    if (sameTopic && !comparison.sameTheme) {
      throw new Error(`POSTER_CROSS_LOCALE_THEME_MISMATCH:${comparison.leftTopicId}`);
    }
    if (!sameTopic && (comparison.nearDuplicate
      || comparison.needsHumanReview
      || comparison.semanticSimilarity >= semanticSimilarityThreshold)) {
      throw new Error(`POSTER_VISUAL_SIMILARITY_REVIEW_REQUIRED:${pairKey(
        comparison.leftTopicId,
        comparison.leftLocale,
        comparison.rightTopicId,
        comparison.rightLocale,
      )}`);
    }
  }
  return comparisons;
}

export async function verifyReleasePosters(
  issue: Issue,
  assetBatchId: string,
  candidates: PosterCandidate[],
  options: PosterGateOptions = {},
) {
  const reviewDecision = options.reviewDecision || { reviewStatus: "passed", reviewPassed: true, reviewWaived: false };
  const actual = candidates.map((item) => slotKey(item.topicId, item.locale)).sort();
  const expected = expectedCandidates(issue);
  if (actual.join("|") !== expected.join("|")) throw new Error("POSTER_MANIFEST_MUST_MATCH_18_RELEASE_SLOTS");
  if (reviewDecision.reviewWaived && !assetBatchId.includes(issue.issueDate.replaceAll("-", ""))) {
    throw new Error("POSTER_MANIFEST_DATE_IDENTITY_MISMATCH");
  }

  const fetchImpl = options.fetchImpl || fetch;
  const reviewer = reviewDecision.reviewWaived ? null : options.reviewer || reviewerFromEnv();
  const now = options.now || (() => new Date());
  const maxBytes = options.maxBytes || 10 * 1024 * 1024;
  const perceptualDistanceThreshold = options.perceptualDistanceThreshold ?? 4;
  const semanticSimilarityThreshold = options.semanticSimilarityThreshold ?? 0.9;
  const exactHashes = new Map<string, string>();
  const prepared: PreparedPoster[] = [];

  for (const candidate of candidates) {
    assertImmutablePosterUrl(candidate.url, assetBatchId);
    const topic = issue.topics.find((item) => item.id === candidate.topicId);
    if (!topic) throw new Error(`POSTER_TOPIC_NOT_FOUND:${candidate.topicId}`);
    const response = await fetchImpl(candidate.url, { cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error(`POSTER_FETCH_FAILED:${candidate.topicId}:${candidate.locale}:${response.status}`);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxBytes) throw new Error(`POSTER_TOO_LARGE:${candidate.topicId}:${candidate.locale}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 10_000 || buffer.length > maxBytes) throw new Error(`POSTER_SIZE_INVALID:${candidate.topicId}:${candidate.locale}`);
    const metadata = await sharp(buffer).metadata();
    if (metadata.format !== "png") throw new Error(`POSTER_FORMAT_INVALID:${candidate.topicId}:${candidate.locale}`);
    if (!metadata.width || !metadata.height || metadata.width < 800 || metadata.height < 1600 || metadata.width * 2 !== metadata.height) {
      throw new Error(`POSTER_DIMENSIONS_INVALID:${candidate.topicId}:${candidate.locale}:${metadata.width}x${metadata.height}`);
    }
    const contentHash = sha256(buffer);
    const duplicateOf = exactHashes.get(contentHash);
    if (duplicateOf) throw new Error(`POSTER_DUPLICATE:${candidate.topicId}:${candidate.locale}:${duplicateOf}`);
    exactHashes.set(contentHash, slotKey(candidate.topicId, candidate.locale));
    prepared.push({
      candidate,
      contentHash,
      perceptualHash: await differenceHash(buffer),
      width: metadata.width,
      height: metadata.height,
    });
  }

  for (let left = 0; left < prepared.length; left += 1) {
    for (let right = left + 1; right < prepared.length; right += 1) {
      if (prepared[left].candidate.topicId === prepared[right].candidate.topicId) continue;
      const distance = perceptualHashDistance(prepared[left].perceptualHash, prepared[right].perceptualHash);
      if (distance <= perceptualDistanceThreshold) {
        throw new Error(`POSTER_PERCEPTUAL_DUPLICATE:${slotKey(
          prepared[left].candidate.topicId,
          prepared[left].candidate.locale,
        )}:${slotKey(prepared[right].candidate.topicId, prepared[right].candidate.locale)}:${distance}`);
      }
    }
  }

  if (reviewDecision.reviewWaived) {
    const batchComparisonHash = stableHash({
      verificationMethod: "deterministic-manifest",
      issueDate: issue.issueDate,
      assetBatchId,
      posters: prepared.map((item) => ({
        topicId: item.candidate.topicId,
        locale: item.candidate.locale,
        contentHash: item.contentHash,
        perceptualHash: item.perceptualHash,
      })),
    });
    const checks: PosterImageCheck[] = prepared.map(({ candidate, ...image }) => {
      const topic = issue.topics.find((item) => item.id === candidate.topicId)!;
      return {
        topicId: candidate.topicId,
        locale: candidate.locale,
        url: candidate.url,
        contentHash: image.contentHash,
        perceptualHash: image.perceptualHash,
        width: image.width,
        height: image.height,
        format: "png",
        verificationMethod: "deterministic-manifest",
        manifestNumber: topic.rank,
        manifestLanguage: candidate.locale,
        manifestIssueDate: issue.issueDate,
        manifestSite: "xiazishuo.com",
        ocrPerformed: false,
        semanticComparisonPerformed: false,
        ocrTextHash: sha256("review-waived:no-ocr"),
        detectedNumber: topic.rank,
        detectedLanguage: candidate.locale,
        titleMatches: false,
        dateMatches: false,
        siteMatches: false,
        themeMatches: false,
        xiaziMatches: false,
        doudoulongMatches: false,
        crossLocaleThemeMatches: false,
        maxDistinctTopicSimilarity: 0,
        batchComparisonHash,
        reviewStatus: "waived",
        reviewProvider: "none",
        checkedAt: now().toISOString(),
      };
    });
    if (checks.length !== 18) throw new Error("EXPECTED_18_POSTER_CHECKS");
    return checks;
  }

  const batchInput = {
    assetBatchId,
    posters: candidates.map((candidate) => {
      const topic = issue.topics.find((item) => item.id === candidate.topicId)!;
      return {
        url: candidate.url,
        topicId: candidate.topicId,
        locale: candidate.locale,
        expectedNumber: topic.rank,
        expectedTitle: topic.localizations[candidate.locale === "zh" ? "zh-CN" : "en-US"].headlineFact,
        expectedDate: issue.issueDate,
        expectedSite: "xiazishuo.com" as const,
      };
    }),
  };
  const batchReview = await reviewer!(batchInput);
  const comparisons = assertBatchReview(batchReview, candidates, semanticSimilarityThreshold);
  const batchComparisonHash = stableHash({
    provider: batchReview.provider,
    model: batchReview.model || null,
    modelVersion: batchReview.modelVersion || null,
    protocolVersion: batchReview.protocolVersion || null,
    rulesetVersion: batchReview.rulesetVersion || null,
    requestId: batchReview.requestId || null,
    inputHash: batchReview.inputHash || null,
    comparisons: batchReview.comparisons,
  });
  const reviewBySlot = new Map(batchReview.reviews.map((item) => [slotKey(item.topicId, item.locale), item]));

  const checks: PosterImageCheck[] = prepared.map(({ candidate, ...image }) => {
    const topic = issue.topics.find((item) => item.id === candidate.topicId)!;
    const review = reviewBySlot.get(slotKey(candidate.topicId, candidate.locale));
    if (!review) throw new Error(`POSTER_REVIEW_NOT_FOUND:${slotKey(candidate.topicId, candidate.locale)}`);
    assertVisionReview(review, topic.rank, candidate.locale, candidate.topicId);
    if (review.ocrText.trim().length < 40) throw new Error(`POSTER_OCR_TOO_SMALL:${candidate.topicId}:${candidate.locale}`);
    const sameTopicComparison = comparisons.get(pairKey(candidate.topicId, "zh", candidate.topicId, "en"));
    if (!sameTopicComparison) throw new Error(`POSTER_CROSS_LOCALE_COMPARISON_MISSING:${candidate.topicId}`);
    const maxDistinctTopicSimilarity = Math.max(0, ...[...comparisons.values()]
      .filter((item) => item.leftTopicId !== item.rightTopicId
        && (item.leftTopicId === candidate.topicId || item.rightTopicId === candidate.topicId))
      .map((item) => item.semanticSimilarity));
    return {
      topicId: candidate.topicId,
      locale: candidate.locale,
      url: candidate.url,
      contentHash: image.contentHash,
      perceptualHash: image.perceptualHash,
      width: image.width,
      height: image.height,
      format: "png" as const,
      verificationMethod: "reviewer" as const,
      manifestNumber: topic.rank,
      manifestLanguage: candidate.locale,
      manifestIssueDate: issue.issueDate,
      manifestSite: "xiazishuo.com" as const,
      ocrPerformed: true,
      semanticComparisonPerformed: true,
      ocrTextHash: sha256(review.ocrText.trim()),
      detectedNumber: review.detectedNumber,
      detectedLanguage: review.detectedLanguage,
      titleMatches: review.titleMatches,
      dateMatches: review.dateMatches,
      siteMatches: review.siteMatches,
      themeMatches: review.themeMatches,
      xiaziMatches: review.xiaziMatches,
      doudoulongMatches: review.doudoulongMatches,
      crossLocaleThemeMatches: sameTopicComparison.sameTheme,
      maxDistinctTopicSimilarity,
      batchComparisonHash,
      reviewStatus: "passed" as const,
      reviewProvider: batchReview.provider,
      ...(batchReview.model ? { reviewModel: batchReview.model } : {}),
      ...(batchReview.modelVersion ? { reviewModelVersion: batchReview.modelVersion } : {}),
      ...(batchReview.protocolVersion ? { reviewProtocolVersion: batchReview.protocolVersion } : {}),
      ...(batchReview.rulesetVersion ? { reviewRulesetVersion: batchReview.rulesetVersion } : {}),
      ...(batchReview.requestId ? { reviewRequestId: batchReview.requestId } : {}),
      ...(batchReview.inputHash ? { reviewInputHash: batchReview.inputHash } : {}),
      ...(batchReview.reviewedAt ? { reviewedAt: batchReview.reviewedAt } : {}),
      ...(typeof batchReview.durationMs === "number" ? { reviewDurationMs: batchReview.durationMs } : {}),
      checkedAt: now().toISOString(),
    };
  });

  if (checks.length !== 18) throw new Error("EXPECTED_18_POSTER_CHECKS");
  return checks;
}
