import { describe, expect, it } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { createVerifiedImmutableObject } from "@/server/storage/immutable-asset-store";
import { MemoryImmutableAssetStore } from "@/server/storage/memory-immutable-asset-store";
import { verifyReleaseStorage } from "@/server/storage/storage-gate";
import { parseIssue, type PosterCandidate } from "@xiazi/contracts";
import { immutableAssetKey } from "@xiazi/domain";

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

async function fixture() {
  const store = new MemoryImmutableAssetStore({ publicOrigin: "http://localhost/" });
  const candidates: PosterCandidate[] = [];
  for (const topic of issue.topics) {
    for (const locale of ["zh", "en"] as const) {
      const key = immutableAssetKey(assetBatchId, locale, topic.slug);
      const result = await createVerifiedImmutableObject(store, {
        key,
        content: Buffer.from(`png:${topic.id}:${locale}:${"x".repeat(20_000)}`),
        contentType: "image/png",
        assetBatchId,
        topicId: topic.id,
        locale,
        createdAt: "2026-07-20T00:00:00.000Z",
        uploaderVersion: "uploader-v1",
      });
      candidates.push({ topicId: topic.id, locale, url: result.object.url });
    }
  }
  return { store, candidates };
}

describe("Release V2 immutable storage gate", () => {
  it("verifies all 18 objects and records provider identities", async () => {
    const { store, candidates } = await fixture();
    const report = await verifyReleaseStorage(issue, assetBatchId, candidates, {
      store,
      policy,
      allowedOrigins: new Set(["http://localhost"]),
      now: () => new Date("2026-07-20T00:10:00.000Z"),
    });
    expect(report.objects).toHaveLength(18);
    expect(new Set(report.objects.map((object) => object.storageVersionId)).size).toBe(18);
    expect(report).toMatchObject({
      provider: "tencent-cos",
      policyVerified: true,
      overwriteDenied: true,
      deleteDenied: true,
    });
  });

  it("fails closed when policy verification is absent", async () => {
    const { store, candidates } = await fixture();
    await expect(verifyReleaseStorage(issue, assetBatchId, candidates, {
      store,
      policy: { ...policy, policyVerified: false },
      allowedOrigins: new Set(["http://localhost"]),
    })).rejects.toThrow(/IMMUTABLE_ASSET_POLICY_UNVERIFIED/);
  });

  it("rejects non-allowlisted origins and incomplete manifests", async () => {
    const { store, candidates } = await fixture();
    const wrongOrigin = structuredClone(candidates);
    wrongOrigin[0].url = wrongOrigin[0].url.replace("http://localhost", "https://evil.example");
    await expect(verifyReleaseStorage(issue, assetBatchId, wrongOrigin, {
      store, policy, allowedOrigins: new Set(["http://localhost"]),
    })).rejects.toThrow(/ORIGIN_NOT_ALLOWED/);
    await expect(verifyReleaseStorage(issue, assetBatchId, candidates.slice(1), {
      store, policy, allowedOrigins: new Set(["http://localhost"]),
    })).rejects.toThrow(/MANIFEST_INCOMPLETE/);
  });

  it("detects changed object bytes", async () => {
    const { store, candidates } = await fixture();
    const key = new URL(candidates[0].url).pathname.replace(/^\//, "");
    store.corrupt(key, { content: Buffer.from("tampered") });
    await expect(verifyReleaseStorage(issue, assetBatchId, candidates, {
      store, policy, allowedOrigins: new Set(["http://localhost"]),
    })).rejects.toThrow(/IMMUTABLE_ASSET_(METADATA|HASH)_MISMATCH/);
  });
});
