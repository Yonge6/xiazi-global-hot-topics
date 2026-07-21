import { describe, expect, it } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { uploadImmutableReleasePosters } from "@/server/storage/immutable-upload-service";
import { MemoryImmutableAssetStore } from "@/server/storage/memory-immutable-asset-store";
import { parseIssue } from "@xiazi/contracts";

const issueValue = structuredClone(currentIssue);
issueValue.issueDate = "2026-07-20";
issueValue.slug = "2026-07-20";
const issue = parseIssue(issueValue);
const assetBatchId = "asset_20260720_primary";
const policy = {
  provider: "tencent-cos" as const,
  policyVersion: "xiazi-cos-immutable-v3",
  verifiedAt: "2026-07-20T00:00:00.000Z",
  verificationToolVersion: "xiazi-storage-verifier-v3",
  overwriteDenied: true,
  deleteDenied: true,
  policyVerified: true,
};
const uploads = issue.topics.flatMap((topic) => (["zh", "en"] as const).map((locale) => ({
  topicId: topic.id,
  locale,
  content: Buffer.from(`png:${topic.id}:${locale}:${"x".repeat(20_000)}`),
})));

describe("immutable 18-poster upload service", () => {
  it("creates a complete manifest and makes retries explicitly idempotent", async () => {
    const store = new MemoryImmutableAssetStore();
    const progress: string[] = [];
    const first = await uploadImmutableReleasePosters(issue, assetBatchId, uploads, {
      store, policy, now: () => new Date("2026-07-20T00:00:00.000Z"),
      onProgress: ({ completed, total, key }) => progress.push(`${completed}/${total}:${key}`),
    });
    const retry = await uploadImmutableReleasePosters(issue, assetBatchId, uploads, {
      store, policy, now: () => new Date("2026-07-20T01:00:00.000Z"),
    });
    expect(first.objects).toHaveLength(18);
    expect(first.posters).toHaveLength(18);
    expect(first).toMatchObject({ createdCount: 18, idempotentCount: 0 });
    expect(retry).toMatchObject({ createdCount: 0, idempotentCount: 18 });
    expect(retry.objectManifestHash).toBe(first.objectManifestHash);
    expect(progress).toHaveLength(18);
    expect(progress.at(-1)).toMatch(/^18\/18:release-assets\//);
  });

  it("rejects an incomplete batch before writing", async () => {
    await expect(uploadImmutableReleasePosters(issue, assetBatchId, uploads.slice(1), {
      store: new MemoryImmutableAssetStore(), policy,
    })).rejects.toThrow(/MANIFEST_INCOMPLETE/);
  });

  it("rejects an unverified policy before writing", async () => {
    await expect(uploadImmutableReleasePosters(issue, assetBatchId, uploads, {
      store: new MemoryImmutableAssetStore(),
      policy: { ...policy, policyVerified: false },
    })).rejects.toThrow(/IMMUTABLE_ASSET_POLICY_UNVERIFIED/);
  });
});
