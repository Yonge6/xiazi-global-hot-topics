import { createHash } from "node:crypto";

import type {
  ImmutableAssetStore,
  ImmutableCreateInput,
  ImmutableObjectMetadata,
} from "./immutable-asset-store";
import { ImmutableAssetError } from "./immutable-asset-store";

type Stored = { content: Buffer; metadata: ImmutableObjectMetadata };

export class MemoryImmutableAssetStore implements ImmutableAssetStore {
  readonly provider = "memory" as const;
  readonly publicOrigin: string;
  readonly conditionalCreateSupported: boolean;
  private readonly objects = new Map<string, Stored>();

  constructor(options: { publicOrigin?: string; conditionalCreateSupported?: boolean } = {}) {
    this.publicOrigin = options.publicOrigin || "http://localhost/";
    this.conditionalCreateSupported = options.conditionalCreateSupported ?? true;
  }

  async createObject(input: ImmutableCreateInput & { sha256: string }) {
    if (!this.conditionalCreateSupported) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_CONDITIONAL_WRITE_REQUIRED");
    }
    if (this.objects.has(input.key)) throw new ImmutableAssetError("IMMUTABLE_ASSET_ALREADY_EXISTS", input.key);
    const etag = createHash("md5").update(input.content).digest("hex");
    const metadata: ImmutableObjectMetadata = {
      key: input.key,
      contentType: input.contentType,
      sizeBytes: input.content.length,
      etag,
      storageVersionId: `memory:${etag}:${input.sha256}`,
      serverSideEncryption: "AES256",
      customMetadata: {
        "asset-batch-id": input.assetBatchId,
        "topic-id": input.topicId,
        locale: input.locale,
        "issue-date": input.issueDate,
        "expected-number": String(input.expectedNumber),
        "expected-site": input.expectedSite,
        sha256: input.sha256,
        "created-at": input.createdAt,
        "uploader-version": input.uploaderVersion,
      },
    };
    this.objects.set(input.key, { content: Buffer.from(input.content), metadata });
    return metadata;
  }

  async headObject(key: string) {
    return this.objects.get(key)?.metadata || null;
  }

  async readObject(key: string) {
    const object = this.objects.get(key);
    if (!object) throw new Error(`OBJECT_NOT_FOUND:${key}`);
    return Buffer.from(object.content);
  }

  corrupt(key: string, change: Partial<Stored>) {
    const current = this.objects.get(key);
    if (!current) throw new Error(`OBJECT_NOT_FOUND:${key}`);
    this.objects.set(key, { ...current, ...change });
  }
}
