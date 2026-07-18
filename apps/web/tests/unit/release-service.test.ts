import { describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { approveFuturePublication, rollbackFuturePublication, stageFuturePublication } from "@/server/releases/release-service";
import { parseIssue, type PosterCheck, type SourceSnapshot } from "@xiazi/contracts";
import { contentChecksum } from "@/server/content-sync/issue-bundle";
import { publicationReleaseId } from "@xiazi/domain";

const issueValue = structuredClone(currentIssue);
issueValue.issueDate = "2026-07-19";
issueValue.slug = "2026-07-19";
issueValue.beijingTimestamp = "2026-07-19T05:00:00+08:00";
issueValue.gmtTimestamp = "2026-07-18T21:00:00Z";
const issue = parseIssue(issueValue);
const releaseId = publicationReleaseId(issue.issueDate, contentChecksum(issue));
const posterCandidates = issue.topics.flatMap((topic) => (["zh", "en"] as const).map((locale) => ({
  topicId: topic.id,
  locale,
  url: `https://xiazishuo.com/releases/${releaseId}/${locale}/${topic.slug}.png`,
})));

const sources: SourceSnapshot[] = issue.topics.slice(0, 8).map((topic, index) => ({
  sourceId: `source-${index}`,
  topicId: topic.id,
  url: `https://example.com/${index}`,
  finalUrl: `https://example.com/${index}`,
  fetchedAt: "2026-07-19T00:00:00.000Z",
  httpStatus: 200,
  title: "Source",
  contentHash: String(index).padStart(64, "a").slice(-64),
  snapshotText: "Current source text supports the claim.",
  correctionStatus: "clear",
  supportsClaim: true,
  reviewProvider: "test",
  rationale: "supported",
}));
const posters: PosterCheck[] = posterCandidates.map((candidate, index) => ({
  ...candidate,
  contentHash: index.toString(16).padStart(64, "0"),
  width: 800,
  height: 1600,
  format: "png",
  ocrTextHash: (index + 20).toString(16).padStart(64, "0"),
  detectedNumber: Math.floor(index / 2) + 1,
  detectedLanguage: candidate.locale,
  titleMatches: true,
  dateMatches: true,
  siteMatches: true,
  themeMatches: true,
  xiaziMatches: true,
  doudoulongMatches: true,
  reviewProvider: "test",
  checkedAt: "2026-07-19T00:00:00.000Z",
}));

function fakeClient() {
  const rpc = vi.fn(async (name: string) => ({
    data: name === "stage_publication_release" ? { releaseId, status: "ready_for_approval" } : { ok: true },
    error: null,
  }));
  return { rpc };
}

describe("future release service", () => {
  it("stages but does not publish until manual approval", async () => {
    const client = fakeClient();
    const result = await stageFuturePublication({
      issue,
      posters: posterCandidates,
      idempotencyKey: "automation:2026-07-19:primary",
      leaseOwner: "automation-0550",
    }, {
      client: client as never,
      sourceGate: vi.fn(async () => sources),
      posterGate: vi.fn(async () => posters),
      now: () => new Date("2026-07-19T00:30:00Z"),
    });

    expect(result.published).toBe(false);
    expect(result.status).toBe("ready_for_approval");
    expect(result.releaseId).toBe(releaseId);
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual([
      "acquire_publication_lease",
      "stage_publication_release",
    ]);
  });

  it("records a failed job and never stages when a hard gate fails", async () => {
    const client = fakeClient();
    await expect(stageFuturePublication({
      issue,
      posters: posterCandidates,
      idempotencyKey: "automation:2026-07-19:failure",
      leaseOwner: "automation-0600",
    }, {
      client: client as never,
      sourceGate: vi.fn(async () => { throw new Error("SOURCE_RETRACTED"); }),
      posterGate: vi.fn(async () => posters),
    })).rejects.toThrow(/SOURCE_RETRACTED/);
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual([
      "acquire_publication_lease",
      "fail_publication_job",
    ]);
  });

  it("uses separate explicit RPCs for activation and rollback", async () => {
    const client = fakeClient();
    await approveFuturePublication(releaseId, { activationKey: `approve:${releaseId}` }, "editor", client as never);
    await rollbackFuturePublication(releaseId, {
      activationKey: `rollback:${releaseId}`,
      reason: "Fault injection rollback verification",
    }, "editor", client as never);
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual([
      "activate_publication_release",
      "rollback_publication_release",
    ]);
  });

  it("rejects historical issues before acquiring a lease", async () => {
    const client = fakeClient();
    await expect(stageFuturePublication({
      issue: parseIssue(currentIssue),
      posters: posterCandidates,
      idempotencyKey: "automation:2026-07-18:blocked",
      leaseOwner: "automation",
    }, { client: client as never })).rejects.toThrow(/after 2026-07-18/);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
