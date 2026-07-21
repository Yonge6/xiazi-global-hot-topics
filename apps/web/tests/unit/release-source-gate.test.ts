import { describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { verifyReleaseSources, type SourceSemanticReviewer } from "@/server/releases/source-gate";
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

function sourceFetcher(extra = "") {
  return vi.fn(async (url: string) => ({
    status: 200,
    finalUrl: url,
    body: html(extra),
    headers: { "content-type": "text/html" },
  }));
}

const supportedReviewer: SourceSemanticReviewer = async (input) => ({
  claimResults: input.claims.map((claim) => ({
    ...claim,
    status: "supported" as const,
    rationale: "The fresh source snapshot supports this exact factual claim.",
  })),
  correctionStatus: "clear",
  rationale: "All headline and introduction facts are supported.",
  provider: "review-test",
  model: "semantic-v2",
});

describe("release source gate", () => {
  it("stores snapshots and verifies every headline and intro claim in both languages", async () => {
    const reviewer = vi.fn(supportedReviewer);
    const snapshots = await verifyReleaseSources(futureIssue(), {
      sourceFetcher: sourceFetcher(),
      reviewer,
      now: () => new Date("2026-07-19T00:10:00Z"),
    });

    expect(snapshots.length).toBeGreaterThanOrEqual(8);
    expect(snapshots.every((item) => item.contentHash.length === 64)).toBe(true);
    expect(snapshots.every((item) => item.claimResults.length === 4)).toBe(true);
    expect(snapshots.every((item) => item.claimResults.every((claim) => claim.status === "supported"))).toBe(true);
    expect(reviewer.mock.calls[0][0].claims.map((claim) => `${claim.field}:${claim.locale}`)).toEqual([
      "headlineFact:zh-CN",
      "intro:zh-CN",
      "headlineFact:en-US",
      "intro:en-US",
    ]);
  });

  it("blocks fixed ChatGPT share links before any network request", async () => {
    const issue = futureIssue();
    issue.topics[0].sources[0].url = "https://chatgpt.com/share/fixed-link";
    const fetcher = sourceFetcher();

    await expect(verifyReleaseSources(issue, {
      sourceFetcher: fetcher,
      reviewer: supportedReviewer,
    })).rejects.toThrow(/CHATGPT_SHARE_LINK_FORBIDDEN/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects an unsafe final URL returned by an injected fetcher", async () => {
    await expect(verifyReleaseSources(futureIssue(), {
      sourceFetcher: vi.fn(async () => ({
        status: 200,
        finalUrl: "https://127.0.0.1/internal",
        body: html(),
        headers: { "content-type": "text/html" },
      })),
      reviewer: supportedReviewer,
    })).rejects.toThrow(/SOURCE_DNS_ADDRESS_NOT_PUBLIC/);
  });

  it("fails closed on a correction marker before reviewer interpretation", async () => {
    await expect(verifyReleaseSources(futureIssue(), {
      sourceFetcher: sourceFetcher(" This story has been updated to correct the decision."),
      reviewer: supportedReviewer,
    })).rejects.toThrow(/SOURCE_CORRECTED_REVIEW_REQUIRED/);
  });

  it("blocks a recognized correction until the candidate claims are reviewed and regenerated", async () => {
    await expect(verifyReleaseSources(futureIssue(), {
      sourceFetcher: sourceFetcher(" Correction: the controlled source changed its conclusion."),
      reviewer: async (input) => ({ ...(await supportedReviewer(input)), correctionStatus: "corrected" }),
    })).rejects.toThrow("SOURCE_CORRECTED_REVIEW_REQUIRED");
  });

  it("fails closed when any introduction claim is unsupported", async () => {
    await expect(verifyReleaseSources(futureIssue(), {
      sourceFetcher: sourceFetcher(),
      reviewer: async (input) => ({
        ...(await supportedReviewer(input)),
        claimResults: input.claims.map((claim) => ({
          ...claim,
          status: claim.field === "intro" && claim.locale === "en-US" ? "unsupported" as const : "supported" as const,
          rationale: "Per-claim test result.",
        })),
      }),
    })).rejects.toThrow(/SOURCE_CLAIM_NOT_SUPPORTED.*intro:en-US:unsupported/);
  });

  it("fails closed when any claim is uncertain", async () => {
    await expect(verifyReleaseSources(futureIssue(), {
      sourceFetcher: sourceFetcher(),
      reviewer: async (input) => ({
        ...(await supportedReviewer(input)),
        claimResults: input.claims.map((claim) => ({
          ...claim,
          status: claim.field === "headlineFact" && claim.locale === "zh-CN" ? "uncertain" as const : "supported" as const,
          rationale: "Per-claim uncertainty test.",
        })),
      }),
    })).rejects.toThrow(/SOURCE_CLAIM_NOT_SUPPORTED.*uncertain/);
  });

  it("fails closed on a retraction marker even when the reviewer claims clear", async () => {
    await expect(verifyReleaseSources(futureIssue(), {
      sourceFetcher: sourceFetcher(" This story has been retracted and replaced."),
      reviewer: supportedReviewer,
    })).rejects.toThrow(/SOURCE_RETRACTED/);
  });

  it("fails closed when the reviewer omits one factual claim", async () => {
    await expect(verifyReleaseSources(futureIssue(), {
      sourceFetcher: sourceFetcher(),
      reviewer: async (input) => ({
        ...(await supportedReviewer(input)),
        claimResults: (await supportedReviewer(input)).claimResults.slice(1),
      }),
    })).rejects.toThrow(/SOURCE_CLAIM_REVIEW_INCOMPLETE/);
  });

  it("waives semantic review without inventing provider or claim evidence", async () => {
    const reviewer = vi.fn(supportedReviewer);
    const snapshots = await verifyReleaseSources(futureIssue(), {
      sourceFetcher: sourceFetcher(),
      reviewer,
      reviewDecision: {
        reviewStatus: "waived",
        reviewPassed: false,
        reviewWaived: true,
        waiverId: "owner-risk-acceptance-2026-07",
        waiverReason: "Owner explicitly accepts reviewer risk for launch",
        configuredBy: "project-owner",
        configuredAt: "2026-07-21T02:00:00.000Z",
      },
    });
    expect(reviewer).not.toHaveBeenCalled();
    expect(snapshots.every((item) => item.reviewStatus === "waived" && !item.supportsClaim)).toBe(true);
    expect(snapshots.every((item) => item.claimResults.length === 0 && item.reviewProvider === "none")).toBe(true);
  });
});
