import type {
  FactualClaim,
  FactualClaimReview,
  Issue,
  SourceSnapshot,
} from "@xiazi/contracts";

import { sha256 } from "./release-hash";
import { assertSafeSourceUrl, fetchSafeSource, type SafeSourceResponse } from "./safe-source-fetch";

const correctionPattern = /(?:this (?:story|article|report) has been (?:updated|corrected)|correction:|updated to correct|更正|撤稿|撤回)/i;
const retractionPattern = /(?:this (?:story|article|paper) has been retracted|retraction notice|撤稿声明|已撤稿)/i;

export type SourceSemanticReview = {
  claimResults: FactualClaimReview[];
  correctionStatus: "clear" | "corrected" | "retracted";
  rationale: string;
  provider: string;
  model?: string;
};

export type SourceSemanticReviewer = (input: {
  url: string;
  title: string;
  snapshotText: string;
  claims: FactualClaim[];
  correctionMarkerDetected: boolean;
}) => Promise<SourceSemanticReview>;

type SourceGateOptions = {
  fetchImpl?: typeof fetch;
  sourceFetcher?: (url: string, options: { timeoutMs: number; maxBytes: number }) => Promise<SafeSourceResponse>;
  reviewer?: SourceSemanticReviewer;
  now?: () => Date;
  timeoutMs?: number;
  maxBytes?: number;
};

function htmlTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return normalizeText(match?.[1] || "").slice(0, 500);
}

function normalizeText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function reviewServiceFromEnv(fetchImpl: typeof fetch): SourceSemanticReviewer {
  return async (input) => {
    const endpoint = process.env.SOURCE_SEMANTIC_REVIEW_URL;
    const secret = process.env.RELEASE_REVIEW_SECRET;
    if (!endpoint || !secret) throw new Error("SOURCE_SEMANTIC_REVIEW_UNAVAILABLE");
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`SOURCE_SEMANTIC_REVIEW_FAILED:${response.status}`);
    const detail = await response.json() as Partial<SourceSemanticReview>;
    if (!Array.isArray(detail.claimResults)
      || !["clear", "corrected", "retracted"].includes(String(detail.correctionStatus))
      || typeof detail.rationale !== "string"
      || typeof detail.provider !== "string") {
      throw new Error("SOURCE_SEMANTIC_REVIEW_INVALID");
    }
    return detail as SourceSemanticReview;
  };
}

function factualClaims(issue: Issue, topicId: string): FactualClaim[] {
  const topic = issue.topics.find((item) => item.id === topicId);
  if (!topic) throw new Error(`SOURCE_TOPIC_NOT_FOUND:${topicId}`);
  return (["zh-CN", "en-US"] as const).flatMap((locale) => (["headlineFact", "intro"] as const).map((field) => ({
    field,
    locale,
    text: topic.localizations[locale][field],
  })));
}

function assertCompleteClaimReview(sourceId: string, expected: FactualClaim[], actual: FactualClaimReview[]) {
  if (actual.length !== expected.length) throw new Error(`SOURCE_CLAIM_REVIEW_INCOMPLETE:${sourceId}`);
  const byKey = new Map(actual.map((claim) => [`${claim.field}:${claim.locale}`, claim]));
  for (const claim of expected) {
    const reviewed = byKey.get(`${claim.field}:${claim.locale}`);
    if (!reviewed
      || reviewed.text !== claim.text
      || !["supported", "unsupported", "uncertain"].includes(reviewed.status)
      || typeof reviewed.rationale !== "string"
      || !reviewed.rationale.trim()) {
      throw new Error(`SOURCE_CLAIM_REVIEW_INVALID:${sourceId}:${claim.field}:${claim.locale}`);
    }
    if (reviewed.status !== "supported") {
      throw new Error(`SOURCE_CLAIM_NOT_SUPPORTED:${sourceId}:${claim.field}:${claim.locale}:${reviewed.status}`);
    }
  }
}

export async function verifyReleaseSources(issue: Issue, options: SourceGateOptions = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const reviewer = options.reviewer || reviewServiceFromEnv(fetchImpl);
  const sourceFetcher = options.sourceFetcher || ((url, limits) => fetchSafeSource(url, limits));
  const now = options.now || (() => new Date());
  const timeoutMs = options.timeoutMs || 20_000;
  const maxBytes = options.maxBytes || 500_000;
  const snapshots: SourceSnapshot[] = [];

  for (const topic of issue.topics) {
    for (const source of topic.sources) {
      assertSafeSourceUrl(source.url);
      const response = await sourceFetcher(source.url, { timeoutMs, maxBytes });
      if (response.status < 200 || response.status >= 400) throw new Error(`SOURCE_FETCH_FAILED:${source.id}:${response.status}`);
      const finalUrl = response.finalUrl;
      assertSafeSourceUrl(finalUrl);
      const html = response.body;
      if (html.length < 200) throw new Error(`SOURCE_BODY_TOO_SMALL:${source.id}`);
      const snapshotText = normalizeText(html);
      if (snapshotText.length < 120) throw new Error(`SOURCE_TEXT_TOO_SMALL:${source.id}`);
      const correctionMarkerDetected = correctionPattern.test(snapshotText);
      const claims = factualClaims(issue, topic.id);
      const review = await reviewer({
        url: finalUrl,
        title: htmlTitle(html) || source.title,
        snapshotText,
        claims,
        correctionMarkerDetected,
      });
      if (retractionPattern.test(snapshotText) || review.correctionStatus === "retracted") {
        throw new Error(`SOURCE_RETRACTED:${source.id}`);
      }
      if (correctionMarkerDetected && review.correctionStatus === "clear") {
        throw new Error(`SOURCE_CORRECTION_REVIEW_MISMATCH:${source.id}`);
      }
      assertCompleteClaimReview(source.id, claims, review.claimResults);

      snapshots.push({
        sourceId: source.id,
        topicId: topic.id,
        url: source.url,
        finalUrl,
        fetchedAt: now().toISOString(),
        httpStatus: response.status,
        title: htmlTitle(html) || source.title,
        contentHash: sha256(snapshotText),
        snapshotText,
        correctionStatus: review.correctionStatus,
        supportsClaim: true,
        claimResults: review.claimResults,
        reviewProvider: review.provider,
        ...(review.model ? { reviewModel: review.model } : {}),
        rationale: review.rationale,
      });
    }
  }

  if (snapshots.length < 8) throw new Error("INSUFFICIENT_SOURCE_SNAPSHOTS");
  return snapshots;
}
