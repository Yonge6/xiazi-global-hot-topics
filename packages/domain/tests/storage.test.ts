import { describe, expect, it } from "vitest";

import type { ImmutableAssetObjectProof, Issue } from "@xiazi/contracts";

import {
  assertCompleteImmutableAssetManifest,
  assertImmutableAssetUrl,
  immutableAssetKey,
  immutableAssetUrl,
  parseImmutableAssetKey,
} from "../src/storage";

const assetBatchId = "asset_20260720_primary";

describe("immutable release asset paths", () => {
  it("builds the fixed release-assets path", () => {
    expect(immutableAssetKey(assetBatchId, "zh", "no-01")).toBe(
      "release-assets/asset_20260720_primary/zh/no-01.png",
    );
    expect(immutableAssetUrl("https://assets.example.com/", assetBatchId, "en", "no-09")).toBe(
      "https://assets.example.com/release-assets/asset_20260720_primary/en/no-09.png",
    );
  });

  it.each([
    "release-assets/asset_20260720_primary/zh/../no-01.png",
    "release-assets/asset_20260720_primary/zh/%2e%2e.png",
    "release-assets/asset_20260720_primary/zh\\no-01.png",
    "release-assets//asset_20260720_primary/zh/no-01.png",
    "current/asset_20260720_primary/zh/no-01.png",
    "release-assets/asset_20260720_primary/fr/no-01.png",
    "release-assets/asset_20260720_primary/zh/current.png",
  ])("rejects unsafe or mutable path %s", (key) => {
    expect(() => parseImmutableAssetKey(key)).toThrow(/IMMUTABLE_ASSET/);
  });

  it("requires an allowlisted origin and the requested asset batch", () => {
    expect(() => assertImmutableAssetUrl(
      `https://evil.example/release-assets/${assetBatchId}/zh/no-01.png`,
      assetBatchId,
      new Set(["https://assets.example.com"]),
    )).toThrow(/ORIGIN_NOT_ALLOWED/);
    expect(() => assertImmutableAssetUrl(
      "https://assets.example.com/release-assets/asset_20260720_secondary/zh/no-01.png",
      assetBatchId,
      new Set(["https://assets.example.com"]),
    )).toThrow(/BATCH_ID_MISMATCH/);
  });
});

describe("immutable release asset manifest", () => {
  const issue = {
    topics: Array.from({ length: 9 }, (_, index) => ({ id: `topic-${index + 1}` })),
  } as Issue;
  const objects: ImmutableAssetObjectProof[] = issue.topics.flatMap((topic, index) => (["zh", "en"] as const).map((locale) => ({
    assetBatchId,
    topicId: topic.id,
    locale,
    issueDate: "2026-07-20",
    expectedNumber: index + 1,
    expectedSite: "xiazishuo.com" as const,
    key: immutableAssetKey(assetBatchId, locale, `no-${String(index + 1).padStart(2, "0")}`),
    url: `https://assets.example.com/${immutableAssetKey(assetBatchId, locale, `no-${String(index + 1).padStart(2, "0")}`)}`,
    sha256: String(index * 2 + (locale === "en" ? 1 : 0)).padStart(64, "0"),
    contentType: "image/png" as const,
    sizeBytes: 100_000 + index,
    createdAt: "2026-07-20T00:00:00.000Z",
    uploaderVersion: "uploader-v1",
    storageVersionId: `proof-${index}-${locale}`,
    etag: `etag-${index}-${locale}`,
    serverSideEncryption: "AES256" as const,
  })));

  it("accepts 18 complete unique storage proofs", () => {
    expect(() => assertCompleteImmutableAssetManifest(issue, assetBatchId, objects)).not.toThrow();
  });

  it("rejects missing and duplicate slots", () => {
    expect(() => assertCompleteImmutableAssetManifest(issue, assetBatchId, objects.slice(1))).toThrow(/INCOMPLETE/);
    const duplicate = [...objects.slice(0, -1), { ...objects[0] }];
    expect(() => assertCompleteImmutableAssetManifest(issue, assetBatchId, duplicate)).toThrow(/SLOT_INVALID/);
  });
});
