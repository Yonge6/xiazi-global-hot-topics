import sharp from "sharp";

import type { Issue, PosterCandidate, PosterCheck } from "@xiazi/contracts";

import { sha256 } from "./release-hash";

export type PosterVisionReview = {
  ocrText: string;
  detectedNumber: number;
  detectedLanguage: "zh" | "en";
  titleMatches: boolean;
  dateMatches: boolean;
  siteMatches: boolean;
  themeMatches: boolean;
  xiaziMatches: boolean;
  doudoulongMatches: boolean;
  provider: string;
  model?: string;
};

export type PosterVisionReviewer = (input: {
  url: string;
  topicId: string;
  locale: "zh" | "en";
  expectedNumber: number;
  expectedTitle: string;
  expectedDate: string;
  expectedSite: "xiazishuo.com";
}) => Promise<PosterVisionReview>;

type PosterGateOptions = {
  fetchImpl?: typeof fetch;
  reviewer?: PosterVisionReviewer;
  now?: () => Date;
  maxBytes?: number;
};

function reviewerFromEnv(fetchImpl: typeof fetch): PosterVisionReviewer {
  return async (input) => {
    const endpoint = process.env.POSTER_VISION_REVIEW_URL;
    const secret = process.env.RELEASE_REVIEW_SECRET;
    if (!endpoint || !secret) throw new Error("POSTER_VISION_REVIEW_UNAVAILABLE");
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`POSTER_VISION_REVIEW_FAILED:${response.status}`);
    const detail = await response.json() as Partial<PosterVisionReview>;
    const booleans = [
      detail.titleMatches,
      detail.dateMatches,
      detail.siteMatches,
      detail.themeMatches,
      detail.xiaziMatches,
      detail.doudoulongMatches,
    ];
    if (typeof detail.ocrText !== "string"
      || !Number.isInteger(detail.detectedNumber)
      || !["zh", "en"].includes(String(detail.detectedLanguage))
      || booleans.some((value) => typeof value !== "boolean")
      || typeof detail.provider !== "string") {
      throw new Error("POSTER_VISION_REVIEW_INVALID");
    }
    return detail as PosterVisionReview;
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

function assertImmutablePosterUrl(value: string, releaseId: string) {
  const url = new URL(value);
  if (!allowedPosterOrigins().has(url.origin)) throw new Error(`POSTER_ORIGIN_NOT_ALLOWED:${url.origin}`);
  if (!url.pathname.includes(`/releases/${releaseId}/`)) throw new Error(`POSTER_PATH_NOT_IMMUTABLE:${value}`);
}

function expectedCandidates(issue: Issue) {
  return issue.topics.flatMap((topic) => [
    `${topic.id}:zh`,
    `${topic.id}:en`,
  ]).sort();
}

function assertVisionReview(review: PosterVisionReview, expectedRank: number, expectedLocale: "zh" | "en", topicId: string) {
  const failures: string[] = [];
  if (review.detectedNumber !== expectedRank) failures.push("number");
  if (review.detectedLanguage !== expectedLocale) failures.push("language");
  if (!review.titleMatches) failures.push("title");
  if (!review.dateMatches) failures.push("date");
  if (!review.siteMatches) failures.push("site");
  if (!review.themeMatches) failures.push("theme");
  if (!review.xiaziMatches) failures.push("xiazi");
  if (!review.doudoulongMatches) failures.push("doudoulong");
  if (failures.length) throw new Error(`POSTER_VISION_GATE_FAILED:${topicId}:${expectedLocale}:${failures.join(",")}`);
}

export async function verifyReleasePosters(
  issue: Issue,
  releaseId: string,
  candidates: PosterCandidate[],
  options: PosterGateOptions = {},
) {
  const actual = candidates.map((item) => `${item.topicId}:${item.locale}`).sort();
  const expected = expectedCandidates(issue);
  if (actual.join("|") !== expected.join("|")) throw new Error("POSTER_MANIFEST_MUST_MATCH_18_RELEASE_SLOTS");

  const fetchImpl = options.fetchImpl || fetch;
  const reviewer = options.reviewer || reviewerFromEnv(fetchImpl);
  const now = options.now || (() => new Date());
  const maxBytes = options.maxBytes || 10 * 1024 * 1024;
  const hashes = new Map<string, string>();
  const checks: PosterCheck[] = [];

  for (const candidate of candidates) {
    assertImmutablePosterUrl(candidate.url, releaseId);
    const topic = issue.topics.find((item) => item.id === candidate.topicId);
    if (!topic) throw new Error(`POSTER_TOPIC_NOT_FOUND:${candidate.topicId}`);
    const response = await fetchImpl(candidate.url, { cache: "no-store", redirect: "follow" });
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
    const duplicateOf = hashes.get(contentHash);
    if (duplicateOf) throw new Error(`POSTER_DUPLICATE:${candidate.topicId}:${candidate.locale}:${duplicateOf}`);
    hashes.set(contentHash, `${candidate.topicId}:${candidate.locale}`);

    const expectedTitle = topic.localizations[candidate.locale === "zh" ? "zh-CN" : "en-US"].headlineFact;
    const review = await reviewer({
      url: candidate.url,
      topicId: candidate.topicId,
      locale: candidate.locale,
      expectedNumber: topic.rank,
      expectedTitle,
      expectedDate: issue.issueDate,
      expectedSite: "xiazishuo.com",
    });
    assertVisionReview(review, topic.rank, candidate.locale, candidate.topicId);
    if (review.ocrText.trim().length < 40) throw new Error(`POSTER_OCR_TOO_SMALL:${candidate.topicId}:${candidate.locale}`);

    checks.push({
      topicId: candidate.topicId,
      locale: candidate.locale,
      url: candidate.url,
      contentHash,
      width: metadata.width,
      height: metadata.height,
      format: "png",
      ocrTextHash: sha256(review.ocrText.trim()),
      detectedNumber: review.detectedNumber,
      detectedLanguage: review.detectedLanguage,
      titleMatches: review.titleMatches,
      dateMatches: review.dateMatches,
      siteMatches: review.siteMatches,
      themeMatches: review.themeMatches,
      xiaziMatches: review.xiaziMatches,
      doudoulongMatches: review.doudoulongMatches,
      reviewProvider: review.provider,
      ...(review.model ? { reviewModel: review.model } : {}),
      checkedAt: now().toISOString(),
    });
  }

  if (checks.length !== 18) throw new Error("EXPECTED_18_POSTER_CHECKS");
  return checks;
}
