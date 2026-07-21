import { describe, expect, it } from "vitest";

import { immutableAssetKey } from "@xiazi/domain";
import {
  createVerifiedImmutableObject,
  type ImmutableCreateInput,
} from "@/server/storage/immutable-asset-store";
import { MemoryImmutableAssetStore } from "@/server/storage/memory-immutable-asset-store";

const assetBatchId = "asset_20260720_primary";
const input: ImmutableCreateInput = {
  key: immutableAssetKey(assetBatchId, "zh", "no-01"),
  content: Buffer.from("valid immutable png bytes"),
  contentType: "image/png",
  assetBatchId,
  topicId: "topic-1",
  locale: "zh",
  issueDate: "2026-07-20",
  expectedNumber: 1,
  expectedSite: "xiazishuo.com",
  createdAt: "2026-07-20T00:00:00.000Z",
  uploaderVersion: "uploader-v1",
};

describe("create-only immutable asset protocol", () => {
  it("creates once and returns explicit idempotency for the same bytes", async () => {
    const store = new MemoryImmutableAssetStore();
    const first = await createVerifiedImmutableObject(store, input);
    const retry = await createVerifiedImmutableObject(store, {
      ...input,
      createdAt: "2026-07-20T01:00:00.000Z",
      uploaderVersion: "uploader-v2",
    });
    expect(first).toMatchObject({ created: true, idempotent: false });
    expect(retry).toMatchObject({ created: false, idempotent: true });
    expect(retry.object.sha256).toBe(first.object.sha256);
    expect(retry.object.createdAt).toBe(input.createdAt);
    expect(retry.object.uploaderVersion).toBe(input.uploaderVersion);
  });

  it("rejects same-key different content", async () => {
    const store = new MemoryImmutableAssetStore();
    await createVerifiedImmutableObject(store, input);
    await expect(createVerifiedImmutableObject(store, { ...input, content: Buffer.from("different") }))
      .rejects.toThrow(/IMMUTABLE_ASSET_CONTENT_CONFLICT/);
  });

  it("allows exactly one creator under concurrent first writes", async () => {
    const store = new MemoryImmutableAssetStore();
    const results = await Promise.all([
      createVerifiedImmutableObject(store, input),
      createVerifiedImmutableObject(store, input),
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.filter((result) => result.idempotent)).toHaveLength(1);
  });

  it("fails closed when the provider lacks atomic conditional create", async () => {
    const store = new MemoryImmutableAssetStore({ conditionalCreateSupported: false });
    await expect(createVerifiedImmutableObject(store, input)).rejects.toMatchObject({
      code: "IMMUTABLE_ASSET_CONDITIONAL_WRITE_REQUIRED",
    });
  });

  it("detects post-write hash and metadata mismatches", async () => {
    const hashStore = new MemoryImmutableAssetStore();
    await hashStore.createObject({ ...input, sha256: "0".repeat(64) });
    await expect(createVerifiedImmutableObject(hashStore, input)).rejects.toThrow(/CONTENT_CONFLICT/);

    const metadataStore = new MemoryImmutableAssetStore();
    await createVerifiedImmutableObject(metadataStore, input);
    const current = await metadataStore.headObject(input.key);
    metadataStore.corrupt(input.key, { metadata: { ...current!, contentType: "image/jpeg" } });
    await expect(createVerifiedImmutableObject(metadataStore, input)).rejects.toThrow(/CONTENT_CONFLICT/);
  });

  it("fails after upload when reread bytes or size differ", async () => {
    class CorruptBytesAfterCreateStore extends MemoryImmutableAssetStore {
      override async createObject(value: Parameters<MemoryImmutableAssetStore["createObject"]>[0]) {
        const metadata = await super.createObject(value);
        this.corrupt(value.key, { content: Buffer.from(value.content.map((byte, index) => index === 0 ? byte ^ 1 : byte)) });
        return metadata;
      }
    }
    await expect(createVerifiedImmutableObject(new CorruptBytesAfterCreateStore(), input))
      .rejects.toThrow(/IMMUTABLE_ASSET_HASH_MISMATCH/);

    class CorruptSizeAfterCreateStore extends MemoryImmutableAssetStore {
      override async createObject(value: Parameters<MemoryImmutableAssetStore["createObject"]>[0]) {
        const metadata = await super.createObject(value);
        this.corrupt(value.key, { metadata: { ...metadata, sizeBytes: metadata.sizeBytes + 1 } });
        return metadata;
      }
    }
    await expect(createVerifiedImmutableObject(new CorruptSizeAfterCreateStore(), input))
      .rejects.toThrow(/IMMUTABLE_ASSET_METADATA_MISMATCH/);
  });
});
