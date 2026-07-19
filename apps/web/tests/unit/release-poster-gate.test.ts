import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import {
  verifyReleasePosters,
  type PosterBatchVisionReviewer,
  type PosterPairComparison,
} from "@/server/releases/poster-gate";
import { parseIssue, type PosterCandidate } from "@xiazi/contracts";

const issueValue = structuredClone(currentIssue);
issueValue.issueDate = "2026-07-19";
issueValue.slug = "2026-07-19";
issueValue.beijingTimestamp = "2026-07-19T05:00:00+08:00";
issueValue.gmtTimestamp = "2026-07-18T21:00:00Z";
const issue = parseIssue(issueValue);
const assetBatchId = "asset_20260719_primary";
const posterGateTimeout = 20_000;
const candidates: PosterCandidate[] = issue.topics.flatMap((topic) => (["zh", "en"] as const).map((locale) => ({
  topicId: topic.id,
  locale,
  url: `http://localhost/release-assets/${assetBatchId}/${locale}/${topic.slug}.png`,
})));
const buffers = new Map<string, Buffer>();

beforeAll(async () => {
  for (let index = 0; index < candidates.length; index += 1) {
    const accentX = 40 + ((index * 97) % 650);
    const accentY = 80 + ((index * 137) % 1300);
    const svg = Buffer.from(`<svg width="800" height="1600" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="1600" fill="rgb(${(index * 31) % 255},${(index * 61) % 255},${(index * 97) % 255})"/>
      <rect x="${accentX}" y="${accentY}" width="${80 + index * 7}" height="${180 + index * 11}" fill="white"/>
      <circle cx="${760 - accentX}" cy="${1500 - accentY / 2}" r="${25 + index * 4}" fill="black"/>
      <path d="M 0 ${100 + index * 70} L 800 ${1500 - index * 55}" stroke="white" stroke-width="${8 + index}"/>
    </svg>`);
    buffers.set(candidates[index].url, await sharp(svg).png({ compressionLevel: 0 }).toBuffer());
  }
});

function posterFetch(map = buffers) {
  return vi.fn(async (input: string | URL | Request) => {
    const buffer = map.get(String(input));
    if (!buffer) return new Response("not found", { status: 404 });
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: { "content-length": String(buffer.length), "content-type": "image/png" },
    });
  }) as typeof fetch;
}

function comparisonPairs(posters: Array<{ topicId: string; locale: "zh" | "en" }>) {
  const comparisons: PosterPairComparison[] = [];
  for (let left = 0; left < posters.length; left += 1) {
    for (let right = left + 1; right < posters.length; right += 1) {
      const sameTopic = posters[left].topicId === posters[right].topicId;
      comparisons.push({
        leftTopicId: posters[left].topicId,
        leftLocale: posters[left].locale,
        rightTopicId: posters[right].topicId,
        rightLocale: posters[right].locale,
        semanticSimilarity: sameTopic ? 0.75 : 0.2,
        sameTheme: sameTopic,
        nearDuplicate: false,
        needsHumanReview: false,
        rationale: sameTopic ? "Bilingual pair depicts the same news theme." : "Distinct news composition.",
      });
    }
  }
  return comparisons;
}

const reviewer: PosterBatchVisionReviewer = async ({ posters }) => ({
  reviews: posters.map((poster) => ({
    topicId: poster.topicId,
    locale: poster.locale,
    ocrText: `${poster.expectedTitle} ${"validated poster copy ".repeat(8)}`,
    detectedNumber: poster.expectedNumber,
    detectedLanguage: poster.locale,
    titleMatches: true,
    dateMatches: true,
    siteMatches: true,
    themeMatches: true,
    xiaziMatches: true,
    doudoulongMatches: true,
  })),
  comparisons: comparisonPairs(posters),
  provider: "vision-test",
  model: "vision-batch-v2",
});

describe("release poster gate", () => {
  it("validates all 18 slots with OCR, IP, perceptual and batch similarity evidence", async () => {
    const checks = await verifyReleasePosters(issue, assetBatchId, candidates, {
      fetchImpl: posterFetch(),
      reviewer,
      now: () => new Date("2026-07-19T00:20:00Z"),
    });

    expect(checks).toHaveLength(18);
    expect(new Set(checks.map((item) => item.contentHash)).size).toBe(18);
    expect(checks.every((item) => /^[0-9a-f]{16}$/.test(item.perceptualHash))).toBe(true);
    expect(checks.every((item) => item.crossLocaleThemeMatches)).toBe(true);
    expect(new Set(checks.map((item) => item.batchComparisonHash)).size).toBe(1);
  }, posterGateTimeout);

  it("rejects a manifest missing one locale/topic slot", async () => {
    await expect(verifyReleasePosters(issue, assetBatchId, candidates.slice(1), {
      fetchImpl: posterFetch(), reviewer,
    })).rejects.toThrow(/18_RELEASE_SLOTS/);
  });

  it("rejects duplicate poster bytes", async () => {
    const duplicateMap = new Map(buffers);
    duplicateMap.set(candidates[1].url, buffers.get(candidates[0].url)!);
    await expect(verifyReleasePosters(issue, assetBatchId, candidates, {
      fetchImpl: posterFetch(duplicateMap), reviewer,
    })).rejects.toThrow(/POSTER_DUPLICATE/);
  }, posterGateTimeout);

  it("rejects a re-encoded copy using perceptual hash even when file SHA differs", async () => {
    const duplicateMap = new Map(buffers);
    duplicateMap.set(candidates[2].url, await sharp(buffers.get(candidates[0].url)!).png({ compressionLevel: 9 }).toBuffer());
    await expect(verifyReleasePosters(issue, assetBatchId, candidates, {
      fetchImpl: posterFetch(duplicateMap), reviewer,
    })).rejects.toThrow(/POSTER_PERCEPTUAL_DUPLICATE/);
  }, posterGateTimeout);

  it("fails when the batch reviewer cannot confirm an IP character", async () => {
    await expect(verifyReleasePosters(issue, assetBatchId, candidates, {
      fetchImpl: posterFetch(),
      reviewer: async (input) => {
        const result = await reviewer(input);
        result.reviews[0].xiaziMatches = false;
        return result;
      },
    })).rejects.toThrow(/xiazi/);
  }, posterGateTimeout);

  it("fails closed when different topics exceed semantic similarity threshold", async () => {
    await expect(verifyReleasePosters(issue, assetBatchId, candidates, {
      fetchImpl: posterFetch(),
      reviewer: async (input) => {
        const result = await reviewer(input);
        const distinct = result.comparisons.find((item) => item.leftTopicId !== item.rightTopicId)!;
        distinct.semanticSimilarity = 0.96;
        distinct.needsHumanReview = true;
        return result;
      },
    })).rejects.toThrow(/POSTER_VISUAL_SIMILARITY_REVIEW_REQUIRED/);
  }, posterGateTimeout);

  it("requires Chinese and English posters for one topic to share the news theme", async () => {
    await expect(verifyReleasePosters(issue, assetBatchId, candidates, {
      fetchImpl: posterFetch(),
      reviewer: async (input) => {
        const result = await reviewer(input);
        const bilingual = result.comparisons.find((item) => item.leftTopicId === item.rightTopicId)!;
        bilingual.sameTheme = false;
        return result;
      },
    })).rejects.toThrow(/POSTER_CROSS_LOCALE_THEME_MISMATCH/);
  }, posterGateTimeout);

  it("rejects duplicate per-poster review entries even when every slot appears in the set", async () => {
    await expect(verifyReleasePosters(issue, assetBatchId, candidates, {
      fetchImpl: posterFetch(),
      reviewer: async (input) => {
        const result = await reviewer(input);
        result.reviews.push({ ...result.reviews[0] });
        return result;
      },
    })).rejects.toThrow(/POSTER_BATCH_REVIEWS_INCOMPLETE/);
  }, posterGateTimeout);
});
