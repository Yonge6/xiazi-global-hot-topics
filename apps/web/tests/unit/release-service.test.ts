import { describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { contentChecksum } from "@/server/content-sync/issue-bundle";
import { stableHash } from "@/server/releases/release-hash";
import { approveFuturePublication, rollbackFuturePublication, stageFuturePublication } from "@/server/releases/release-service";
import type { PosterImageCheck } from "@/server/releases/poster-gate";
import { bindStorageProofsToPosterChecks } from "@/server/storage/storage-gate";
import {
  parseIssue,
  type ImmutableAssetObjectProof,
  type PosterCheck,
  type SourceSnapshot,
  type StorageVerificationReport,
} from "@xiazi/contracts";
import { PUBLICATION_RELEASE_SCHEMA_VERSION, publicationReleaseId } from "@xiazi/domain";

const issueValue = structuredClone(currentIssue);
issueValue.issueDate = "2026-07-19";
issueValue.slug = "2026-07-19";
issueValue.beijingTimestamp = "2026-07-19T05:00:00+08:00";
issueValue.gmtTimestamp = "2026-07-18T21:00:00Z";
const issue = parseIssue(issueValue);
const assetBatchId = "asset_20260719_primary";
const posterCandidates = issue.topics.flatMap((topic) => (["zh", "en"] as const).map((locale) => ({
  topicId: topic.id,
  locale,
  url: `https://xiazishuo.com/release-assets/${assetBatchId}/${locale}/${topic.slug}.png`,
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
  claimResults: (["zh-CN", "en-US"] as const).flatMap((locale) => (["headlineFact", "intro"] as const).map((field) => ({
    field,
    locale,
    text: topic.localizations[locale][field],
    status: "supported" as const,
    rationale: "supported",
  }))),
  reviewProvider: "test",
  rationale: "supported",
}));
const imagePosters: PosterImageCheck[] = posterCandidates.map((candidate, index) => ({
  ...candidate,
  contentHash: index.toString(16).padStart(64, "0"),
  perceptualHash: index.toString(16).padStart(16, "0"),
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
  crossLocaleThemeMatches: true,
  maxDistinctTopicSimilarity: 0.2,
  batchComparisonHash: "b".repeat(64),
  reviewProvider: "test",
  checkedAt: "2026-07-19T00:00:00.000Z",
}));
const storageObjects: ImmutableAssetObjectProof[] = posterCandidates.map((candidate, index) => ({
  assetBatchId,
  topicId: candidate.topicId,
  locale: candidate.locale,
  key: new URL(candidate.url).pathname.replace(/^\//, ""),
  url: candidate.url,
  sha256: imagePosters[index].contentHash,
  contentType: "image/png",
  sizeBytes: 100_000 + index,
  createdAt: "2026-07-19T00:00:00.000Z",
  uploaderVersion: "uploader-v1",
  storageVersionId: `version-${index}`,
  etag: `etag-${index}`,
  serverSideEncryption: "AES256" as const,
}));

function storageReport(objects = storageObjects): StorageVerificationReport {
  return {
    provider: "tencent-cos",
    policyVersion: "xiazi-cos-immutable-v3",
    assetBatchId,
    objectManifestHash: stableHash(objects),
    objects,
    verifiedAt: "2026-07-19T00:20:00.000Z",
    verificationToolVersion: "xiazi-storage-verifier-v3",
    overwriteDenied: true,
    deleteDenied: true,
    policyVerified: true,
  };
}
const posters: PosterCheck[] = bindStorageProofsToPosterChecks(imagePosters, storageReport());

function expectedReleaseId(
  posterChecks = posters,
  storageVerification = storageReport(),
) {
  const posterManifestHash = stableHash({
    posters: posterChecks,
    storage: {
      provider: storageVerification.provider,
      policyVersion: storageVerification.policyVersion,
      objectManifestHash: storageVerification.objectManifestHash,
    },
  });
  const releaseHash = stableHash({
    schemaVersion: PUBLICATION_RELEASE_SCHEMA_VERSION,
    contentHash: contentChecksum(issue),
    sourceSnapshotHash: stableHash(sources),
    posterManifestHash,
  });
  return publicationReleaseId(issue.issueDate, releaseHash);
}

function fakeClient(leaseOverride?: Record<string, unknown>) {
  const releaseId = expectedReleaseId();
  const rpc = vi.fn(async (name: string, params?: Record<string, unknown>) => {
    void params;
    return {
      data: name === "acquire_publication_lease"
        ? {
            acquired: true,
            status: "leased",
            leaseOwner: "automation-0550",
            leaseExpiresAt: "2026-07-19T00:40:00Z",
            ...leaseOverride,
          }
        : name === "stage_publication_release"
          ? { releaseId, status: "ready_for_approval" }
          : { renewed: true },
      error: null,
    };
  });
  return { rpc };
}

function stageInput(idempotencyKey: string, leaseOwner = "automation-0550") {
  return { issue, posters: posterCandidates, assetBatchId, idempotencyKey, leaseOwner };
}

describe("future release service", () => {
  it("binds release identity to content, source snapshots, posters and schema version", async () => {
    const client = fakeClient();
    const result = await stageFuturePublication(stageInput("automation:2026-07-19:primary"), {
      client: client as never,
      sourceGate: vi.fn(async () => sources),
      posterGate: vi.fn(async () => imagePosters),
      storageGate: vi.fn(async () => storageReport()),
      now: () => new Date("2026-07-19T00:30:00Z"),
      heartbeatIntervalMs: 60_000,
    });

    expect(result.published).toBe(false);
    expect(result.status).toBe("ready_for_approval");
    expect(result.releaseId).toBe(expectedReleaseId());
    const stagePayload = client.rpc.mock.calls.find(([name]) => name === "stage_publication_release")?.[1]?.payload;
    expect(stagePayload).toMatchObject({
      releaseId: expectedReleaseId(),
      schemaVersion: PUBLICATION_RELEASE_SCHEMA_VERSION,
      leaseOwner: "automation-0550",
    });
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual([
      "acquire_publication_lease",
      "renew_publication_lease",
      "renew_publication_lease",
      "stage_publication_release",
    ]);
  });

  it("creates a different release when only poster content changes", async () => {
    const changedImagePosters = structuredClone(imagePosters);
    changedImagePosters[0].contentHash = "f".repeat(64);
    const changedObjects = structuredClone(storageObjects);
    changedObjects[0].sha256 = "f".repeat(64);
    const changedStorage = storageReport(changedObjects);
    const changedPosters = bindStorageProofsToPosterChecks(changedImagePosters, changedStorage);
    const client = fakeClient();
    const result = await stageFuturePublication(stageInput("automation:2026-07-19:poster-change"), {
      client: client as never,
      sourceGate: vi.fn(async () => sources),
      posterGate: vi.fn(async () => changedImagePosters),
      storageGate: vi.fn(async () => changedStorage),
      heartbeatIntervalMs: 60_000,
    });
    expect(result.releaseId).toBe(expectedReleaseId(changedPosters, changedStorage));
    expect(result.releaseId).not.toBe(expectedReleaseId());
  });

  it("short-circuits an active idempotent retry before all gates", async () => {
    const releaseId = expectedReleaseId();
    const client = fakeClient({ acquired: false, status: "staged", releaseId });
    const sourceGate = vi.fn();
    const posterGate = vi.fn();
    const storageGate = vi.fn();
    const result = await stageFuturePublication(stageInput("automation:2026-07-19:retry"), {
      client: client as never,
      sourceGate,
      posterGate,
      storageGate,
    });
    expect(result).toMatchObject({ status: "ready_for_approval", releaseId, reused: true });
    expect(sourceGate).not.toHaveBeenCalled();
    expect(posterGate).not.toHaveBeenCalled();
    expect(storageGate).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("records a failed job with lease owner and never stages when a hard gate fails", async () => {
    const client = fakeClient();
    await expect(stageFuturePublication(stageInput("automation:2026-07-19:failure"), {
      client: client as never,
      sourceGate: vi.fn(async () => { throw new Error("SOURCE_RETRACTED"); }),
      posterGate: vi.fn(async () => imagePosters),
      storageGate: vi.fn(async () => storageReport()),
      heartbeatIntervalMs: 60_000,
    })).rejects.toThrow(/SOURCE_RETRACTED/);
    expect(client.rpc.mock.calls.map(([name]) => name)).toEqual([
      "acquire_publication_lease",
      "renew_publication_lease",
      "fail_publication_job",
    ]);
    expect(client.rpc.mock.calls.at(-1)?.[1]).toMatchObject({ p_lease_owner: "automation-0550" });
  });

  it("does not create a Release when the external reviewer service is unavailable", async () => {
    const client = fakeClient();
    await expect(stageFuturePublication(stageInput("automation:2026-07-19:reviewer-down"), {
      client: client as never,
      sourceGate: vi.fn(async () => { throw new Error("SOURCE_SEMANTIC_REVIEW_FAILED:503"); }),
      posterGate: vi.fn(async () => imagePosters),
      storageGate: vi.fn(async () => storageReport()),
      heartbeatIntervalMs: 60_000,
    })).rejects.toThrow(/SOURCE_SEMANTIC_REVIEW_FAILED:503/);
    expect(client.rpc.mock.calls.some(([name]) => name === "stage_publication_release")).toBe(false);
    expect(client.rpc.mock.calls.some(([name]) => name === "fail_publication_job")).toBe(true);
  });

  it("does not create a Release when immutable storage policy is unverified", async () => {
    const client = fakeClient();
    await expect(stageFuturePublication(stageInput("automation:2026-07-19:storage-unverified"), {
      client: client as never,
      sourceGate: vi.fn(async () => sources),
      posterGate: vi.fn(async () => imagePosters),
      storageGate: vi.fn(async () => { throw new Error("IMMUTABLE_ASSET_POLICY_UNVERIFIED"); }),
      heartbeatIntervalMs: 60_000,
    })).rejects.toThrow(/IMMUTABLE_ASSET_POLICY_UNVERIFIED/);
    expect(client.rpc.mock.calls.some(([name]) => name === "stage_publication_release")).toBe(false);
    expect(client.rpc.mock.calls.some(([name]) => name === "fail_publication_job")).toBe(true);
  });

  it("uses separate explicit RPCs for activation and rollback", async () => {
    const client = fakeClient();
    const releaseId = expectedReleaseId();
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
      assetBatchId,
      idempotencyKey: "automation:2026-07-18:blocked",
      leaseOwner: "automation",
    }, { client: client as never })).rejects.toThrow(/after 2026-07-18/);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
