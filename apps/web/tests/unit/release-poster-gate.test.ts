import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { verifyReleasePosters } from "@/server/releases/poster-gate";
import { parseIssue, type PosterCandidate } from "@xiazi/contracts";
import { publicationReleaseId } from "@xiazi/domain";
import { contentChecksum } from "@/server/content-sync/issue-bundle";

const issueValue = structuredClone(currentIssue);
issueValue.issueDate = "2026-07-19";
issueValue.slug = "2026-07-19";
issueValue.beijingTimestamp = "2026-07-19T05:00:00+08:00";
issueValue.gmtTimestamp = "2026-07-18T21:00:00Z";
const issue = parseIssue(issueValue);
const releaseId = publicationReleaseId(issue.issueDate, contentChecksum(issue));
const candidates: PosterCandidate[] = issue.topics.flatMap((topic) => (["zh", "en"] as const).map((locale) => ({
  topicId: topic.id,
  locale,
  url: `http://localhost/releases/${releaseId}/${locale}/${topic.slug}.png`,
})));
const buffers = new Map<string, Buffer>();

beforeAll(async () => {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    buffers.set(candidate.url, await sharp({
      create: {
        width: 800,
        height: 1600,
        channels: 3,
        background: { r: (index * 31) % 255, g: (index * 61) % 255, b: (index * 97) % 255 },
      },
    }).png({ compressionLevel: 0 }).toBuffer());
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

const reviewer = vi.fn(async (input: {
  locale: "zh" | "en";
  expectedNumber: number;
  expectedTitle: string;
}) => ({
  ocrText: `${input.expectedTitle} ${"validated poster copy ".repeat(8)}`,
  detectedNumber: input.expectedNumber,
  detectedLanguage: input.locale,
  titleMatches: true,
  dateMatches: true,
  siteMatches: true,
  themeMatches: true,
  xiaziMatches: true,
  doudoulongMatches: true,
  provider: "vision-test",
  model: "vision-v1",
}));

describe("release poster gate", () => {
  it("validates all 18 exact slots with deterministic and vision checks", async () => {
    const checks = await verifyReleasePosters(issue, releaseId, candidates, {
      fetchImpl: posterFetch(),
      reviewer,
      now: () => new Date("2026-07-19T00:20:00Z"),
    });

    expect(checks).toHaveLength(18);
    expect(new Set(checks.map((item) => item.contentHash)).size).toBe(18);
    expect(checks.every((item) => item.xiaziMatches && item.doudoulongMatches)).toBe(true);
  });

  it("rejects a manifest missing one locale/topic slot", async () => {
    await expect(verifyReleasePosters(issue, releaseId, candidates.slice(1), {
      fetchImpl: posterFetch(), reviewer,
    })).rejects.toThrow(/18_RELEASE_SLOTS/);
  });

  it("rejects duplicate poster bytes", async () => {
    const duplicateMap = new Map(buffers);
    duplicateMap.set(candidates[1].url, buffers.get(candidates[0].url)!);
    await expect(verifyReleasePosters(issue, releaseId, candidates, {
      fetchImpl: posterFetch(duplicateMap), reviewer,
    })).rejects.toThrow(/POSTER_DUPLICATE/);
  });

  it("fails when the vision reviewer cannot confirm an IP character", async () => {
    await expect(verifyReleasePosters(issue, releaseId, candidates, {
      fetchImpl: posterFetch(),
      reviewer: vi.fn(async (input) => ({
        ...(await reviewer(input)),
        xiaziMatches: false,
      })),
    })).rejects.toThrow(/xiazi/);
  });
});
