import { describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { verifyReleaseSources } from "@/server/releases/source-gate";
import { parseIssue } from "@xiazi/contracts";

function futureIssue() {
  const value = structuredClone(currentIssue);
  value.issueDate = "2026-07-19";
  value.slug = "2026-07-19";
  value.beijingTimestamp = "2026-07-19T05:00:00+08:00";
  value.gmtTimestamp = "2026-07-18T21:00:00Z";
  value.topics.forEach((topic, index) => {
    topic.sources.forEach((source, sourceIndex) => {
      source.url = `https://news.example.com/story-${index + 1}-${sourceIndex + 1}`;
    });
  });
  return parseIssue(value);
}

function html(extra = "") {
  return `<html><head><title>Verified source title</title></head><body>${"Evidence supporting the reported claim. ".repeat(20)}${extra}</body></html>`;
}

describe("release source gate", () => {
  it("stores fresh source snapshots and semantic review evidence", async () => {
    const fetchImpl = vi.fn(async () => new Response(html(), { status: 200 }));
    const reviewer = vi.fn(async () => ({
      supportsClaim: true,
      correctionStatus: "clear" as const,
      rationale: "The current source text supports both localized factual headlines.",
      provider: "review-test",
      model: "semantic-v1",
    }));
    const snapshots = await verifyReleaseSources(futureIssue(), {
      fetchImpl: fetchImpl as typeof fetch,
      reviewer,
      now: () => new Date("2026-07-19T00:10:00Z"),
    });

    expect(snapshots.length).toBeGreaterThanOrEqual(8);
    expect(snapshots.every((item) => item.contentHash.length === 64)).toBe(true);
    expect(snapshots.every((item) => item.fetchedAt === "2026-07-19T00:10:00.000Z")).toBe(true);
    expect(reviewer).toHaveBeenCalled();
  });

  it("blocks fixed ChatGPT share links before any network request", async () => {
    const issue = futureIssue();
    issue.topics[0].sources[0].url = "https://chatgpt.com/share/fixed-link";
    const fetchImpl = vi.fn();

    await expect(verifyReleaseSources(issue, {
      fetchImpl: fetchImpl as typeof fetch,
      reviewer: vi.fn(),
    })).rejects.toThrow(/CHATGPT_SHARE_LINK_FORBIDDEN/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when a correction marker is ignored by the reviewer", async () => {
    await expect(verifyReleaseSources(futureIssue(), {
      fetchImpl: vi.fn(async () => new Response(html(" This story has been updated to correct the decision."), { status: 200 })) as typeof fetch,
      reviewer: vi.fn(async () => ({
        supportsClaim: true,
        correctionStatus: "clear" as const,
        rationale: "Incorrectly ignored correction.",
        provider: "review-test",
      })),
    })).rejects.toThrow(/SOURCE_CORRECTION_REVIEW_MISMATCH/);
  });

  it("fails closed when current source text does not support the claim", async () => {
    await expect(verifyReleaseSources(futureIssue(), {
      fetchImpl: vi.fn(async () => new Response(html(), { status: 200 })) as typeof fetch,
      reviewer: vi.fn(async () => ({
        supportsClaim: false,
        correctionStatus: "clear" as const,
        rationale: "The key conclusion is not present.",
        provider: "review-test",
      })),
    })).rejects.toThrow(/SOURCE_DOES_NOT_SUPPORT_CLAIM/);
  });
});
