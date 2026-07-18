import type { Issue, SourceSnapshot } from "@xiazi/contracts";

import { sha256 } from "./release-hash";

const correctionPattern = /(?:this (?:story|article|report) has been (?:updated|corrected)|correction:|updated to correct|更正|撤稿|撤回)/i;
const retractionPattern = /(?:this (?:story|article|paper) has been retracted|retraction notice|撤稿声明|已撤稿)/i;

export type SourceSemanticReview = {
  supportsClaim: boolean;
  correctionStatus: "clear" | "corrected" | "retracted";
  rationale: string;
  provider: string;
  model?: string;
};

export type SourceSemanticReviewer = (input: {
  url: string;
  title: string;
  snapshotText: string;
  expectedClaims: { zh: string; en: string };
  correctionMarkerDetected: boolean;
}) => Promise<SourceSemanticReview>;

type SourceGateOptions = {
  fetchImpl?: typeof fetch;
  reviewer?: SourceSemanticReviewer;
  now?: () => Date;
  timeoutMs?: number;
};

function privateHostname(hostname: string) {
  const value = hostname.toLowerCase();
  return value === "localhost"
    || value === "::1"
    || /^127\./.test(value)
    || /^10\./.test(value)
    || /^192\.168\./.test(value)
    || /^169\.254\./.test(value)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(value)
    || value.endsWith(".local");
}

export function assertSafeSourceUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`SOURCE_URL_REQUIRES_HTTPS:${value}`);
  if (url.username || url.password || privateHostname(url.hostname)) throw new Error(`SOURCE_URL_NOT_PUBLIC:${value}`);
  if (url.hostname === "chatgpt.com" || url.hostname.endsWith(".chatgpt.com")) {
    throw new Error(`CHATGPT_SHARE_LINK_FORBIDDEN:${value}`);
  }
  return url;
}

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
    if (typeof detail.supportsClaim !== "boolean"
      || !["clear", "corrected", "retracted"].includes(String(detail.correctionStatus))
      || typeof detail.rationale !== "string"
      || typeof detail.provider !== "string") {
      throw new Error("SOURCE_SEMANTIC_REVIEW_INVALID");
    }
    return detail as SourceSemanticReview;
  };
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "xiazishuo-release-source-gate/2.0" },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyReleaseSources(issue: Issue, options: SourceGateOptions = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const reviewer = options.reviewer || reviewServiceFromEnv(fetchImpl);
  const now = options.now || (() => new Date());
  const timeoutMs = options.timeoutMs || 20_000;
  const snapshots: SourceSnapshot[] = [];

  for (const topic of issue.topics) {
    for (const source of topic.sources) {
      assertSafeSourceUrl(source.url);
      const response = await fetchWithTimeout(fetchImpl, source.url, timeoutMs);
      if (!response.ok) throw new Error(`SOURCE_FETCH_FAILED:${source.id}:${response.status}`);
      const finalUrl = response.url || source.url;
      assertSafeSourceUrl(finalUrl);
      const html = await response.text();
      if (html.length < 200) throw new Error(`SOURCE_BODY_TOO_SMALL:${source.id}`);
      const snapshotText = normalizeText(html).slice(0, 120_000);
      if (snapshotText.length < 120) throw new Error(`SOURCE_TEXT_TOO_SMALL:${source.id}`);
      const correctionMarkerDetected = correctionPattern.test(snapshotText);
      const review = await reviewer({
        url: finalUrl,
        title: htmlTitle(html) || source.title,
        snapshotText,
        expectedClaims: {
          zh: topic.localizations["zh-CN"].headlineFact,
          en: topic.localizations["en-US"].headlineFact,
        },
        correctionMarkerDetected,
      });
      if (retractionPattern.test(snapshotText) || review.correctionStatus === "retracted") {
        throw new Error(`SOURCE_RETRACTED:${source.id}`);
      }
      if (correctionMarkerDetected && review.correctionStatus === "clear") {
        throw new Error(`SOURCE_CORRECTION_REVIEW_MISMATCH:${source.id}`);
      }
      if (!review.supportsClaim) throw new Error(`SOURCE_DOES_NOT_SUPPORT_CLAIM:${source.id}`);

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
        supportsClaim: review.supportsClaim,
        reviewProvider: review.provider,
        ...(review.model ? { reviewModel: review.model } : {}),
        rationale: review.rationale,
      });
    }
  }

  if (snapshots.length < 8) throw new Error("INSUFFICIENT_SOURCE_SNAPSHOTS");
  return snapshots;
}
