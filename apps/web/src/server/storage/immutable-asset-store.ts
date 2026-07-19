import { createHash } from "node:crypto";

import type { ImmutableAssetLocale, ImmutableAssetObjectProof } from "@xiazi/contracts";
import { parseImmutableAssetKey } from "@xiazi/domain";

export const IMMUTABLE_ASSET_ERROR_CODES = [
  "IMMUTABLE_ASSET_ALREADY_EXISTS",
  "IMMUTABLE_ASSET_CONTENT_CONFLICT",
  "IMMUTABLE_ASSET_CONDITIONAL_WRITE_REQUIRED",
  "IMMUTABLE_ASSET_METADATA_MISMATCH",
  "IMMUTABLE_ASSET_HASH_MISMATCH",
  "IMMUTABLE_ASSET_ORIGIN_NOT_ALLOWED",
  "IMMUTABLE_ASSET_POLICY_UNVERIFIED",
] as const;

export type ImmutableAssetErrorCode = typeof IMMUTABLE_ASSET_ERROR_CODES[number];

export class ImmutableAssetError extends Error {
  constructor(public readonly code: ImmutableAssetErrorCode, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "ImmutableAssetError";
  }
}

export type ImmutableObjectMetadata = {
  key: string;
  contentType: string;
  sizeBytes: number;
  etag: string;
  storageVersionId: string;
  serverSideEncryption: string;
  customMetadata: Record<string, string>;
};

export type ImmutableCreateInput = {
  key: string;
  content: Buffer;
  contentType: "image/png";
  assetBatchId: string;
  topicId: string;
  locale: ImmutableAssetLocale;
  createdAt: string;
  uploaderVersion: string;
};

export type ImmutableCreateResult = {
  created: boolean;
  idempotent: boolean;
  object: ImmutableAssetObjectProof;
};

export type ImmutableAssetStore = {
  readonly provider: "tencent-cos" | "memory";
  readonly publicOrigin: string;
  readonly conditionalCreateSupported: boolean;
  createObject(input: ImmutableCreateInput & { sha256: string }): Promise<ImmutableObjectMetadata>;
  headObject(key: string): Promise<ImmutableObjectMetadata | null>;
  readObject(key: string): Promise<ReadableStream<Uint8Array> | Buffer>;
};

export function sha256Buffer(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export async function hashImmutableObjectStream(value: ReadableStream<Uint8Array> | Buffer) {
  if (Buffer.isBuffer(value)) return { buffer: value, sha256: sha256Buffer(value) };
  const reader = value.getReader();
  const chunks: Buffer[] = [];
  const hash = createHash("sha256");
  let sizeBytes = 0;
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    const buffer = Buffer.from(chunk);
    sizeBytes += buffer.length;
    hash.update(buffer);
    chunks.push(buffer);
  }
  return { buffer: Buffer.concat(chunks, sizeBytes), sha256: hash.digest("hex") };
}

function expectedCustomMetadata(input: ImmutableCreateInput, sha256: string) {
  return {
    "asset-batch-id": input.assetBatchId,
    "topic-id": input.topicId,
    locale: input.locale,
    sha256,
    "created-at": input.createdAt,
    "uploader-version": input.uploaderVersion,
  };
}

function assertMetadata(
  metadata: ImmutableObjectMetadata,
  input: ImmutableCreateInput,
  expectedSha256: string,
  mode: "created" | "existing",
) {
  const expected = expectedCustomMetadata(input, expectedSha256);
  const identityEntries = Object.entries(expected).filter(([key]) => (
    mode === "created" || !["created-at", "uploader-version"].includes(key)
  ));
  if (metadata.key !== input.key
    || metadata.contentType.split(";")[0].trim().toLowerCase() !== input.contentType
    || metadata.sizeBytes !== input.content.length
    || !metadata.etag
    || !metadata.storageVersionId
    || metadata.serverSideEncryption !== "AES256"
    || !metadata.customMetadata["created-at"]
    || !metadata.customMetadata["uploader-version"]
    || identityEntries.some(([key, value]) => metadata.customMetadata[key] !== value)) {
    throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", input.key);
  }
}

async function verifyStoredObject(
  store: ImmutableAssetStore,
  input: ImmutableCreateInput,
  expectedSha256: string,
  mode: "created" | "existing",
) {
  const metadata = await store.headObject(input.key);
  if (!metadata) throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${input.key}:missing-after-write`);
  assertMetadata(metadata, input, expectedSha256, mode);
  const read = await hashImmutableObjectStream(await store.readObject(input.key));
  if (read.buffer.length !== input.content.length) {
    throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${input.key}:read-size`);
  }
  if (read.sha256 !== expectedSha256) {
    throw new ImmutableAssetError("IMMUTABLE_ASSET_HASH_MISMATCH", input.key);
  }
  return metadata;
}

function proof(store: ImmutableAssetStore, input: ImmutableCreateInput, sha256: string, metadata: ImmutableObjectMetadata) {
  return {
    assetBatchId: input.assetBatchId,
    topicId: input.topicId,
    locale: input.locale,
    key: input.key,
    url: new URL(input.key, store.publicOrigin.endsWith("/") ? store.publicOrigin : `${store.publicOrigin}/`).toString(),
    sha256,
    contentType: input.contentType,
    sizeBytes: input.content.length,
    createdAt: metadata.customMetadata["created-at"],
    uploaderVersion: metadata.customMetadata["uploader-version"],
    storageVersionId: metadata.storageVersionId,
    etag: metadata.etag,
    serverSideEncryption: "AES256",
  } satisfies ImmutableAssetObjectProof;
}

async function existingResult(store: ImmutableAssetStore, input: ImmutableCreateInput, sha256: string) {
  try {
    const metadata = await verifyStoredObject(store, input, sha256, "existing");
    return { created: false, idempotent: true, object: proof(store, input, sha256, metadata) } satisfies ImmutableCreateResult;
  } catch (error) {
    if (error instanceof ImmutableAssetError
      && ["IMMUTABLE_ASSET_HASH_MISMATCH", "IMMUTABLE_ASSET_METADATA_MISMATCH"].includes(error.code)) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_CONTENT_CONFLICT", input.key);
    }
    throw error;
  }
}

export async function createVerifiedImmutableObject(
  store: ImmutableAssetStore,
  input: ImmutableCreateInput,
): Promise<ImmutableCreateResult> {
  const parsed = parseImmutableAssetKey(input.key);
  if (parsed.assetBatchId !== input.assetBatchId || parsed.locale !== input.locale) {
    throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${input.key}:identity`);
  }
  if (!store.conditionalCreateSupported) {
    throw new ImmutableAssetError("IMMUTABLE_ASSET_CONDITIONAL_WRITE_REQUIRED", store.provider);
  }
  const hash = sha256Buffer(input.content);
  if (await store.headObject(input.key)) return existingResult(store, input, hash);
  try {
    await store.createObject({ ...input, sha256: hash });
  } catch (error) {
    if (error instanceof ImmutableAssetError && error.code === "IMMUTABLE_ASSET_ALREADY_EXISTS") {
      return existingResult(store, input, hash);
    }
    throw error;
  }
  const metadata = await verifyStoredObject(store, input, hash, "created");
  return { created: true, idempotent: false, object: proof(store, input, hash, metadata) };
}
