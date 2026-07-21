import type {
  ImmutableAssetObjectProof,
  Issue,
  PosterCandidate,
  PosterCheck,
  StorageVerificationReport,
} from "@xiazi/contracts";
import {
  assertCompleteImmutableAssetManifest,
  assertImmutableAssetUrl,
  IMMUTABLE_STORAGE_POLICY_VERSION,
  IMMUTABLE_STORAGE_VERIFIER_VERSION,
} from "@xiazi/domain";

import type { PosterImageCheck } from "../releases/poster-gate";
import { stableHash } from "../releases/release-hash";
import { CosImmutableAssetStore } from "./cos-immutable-asset-store";
import {
  hashImmutableObjectStream,
  ImmutableAssetError,
  type ImmutableAssetStore,
} from "./immutable-asset-store";

export type StoragePolicyAttestation = {
  provider: "tencent-cos";
  policyVersion: string;
  verifiedAt: string;
  verificationToolVersion: string;
  overwriteDenied: boolean;
  deleteDenied: boolean;
  policyVerified: boolean;
};

type StorageGateOptions = {
  store?: ImmutableAssetStore;
  policy?: StoragePolicyAttestation;
  allowedOrigins?: Set<string>;
  now?: () => Date;
};

function booleanEnv(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ImmutableAssetError("IMMUTABLE_ASSET_POLICY_UNVERIFIED", `${name}_MISSING`);
  return value;
}

export function cosImmutableStoreFromEnv() {
  return new CosImmutableAssetStore({
    secretId: requiredEnv("COS_SECRET_ID"),
    secretKey: requiredEnv("COS_SECRET_KEY"),
    bucket: requiredEnv("COS_BUCKET"),
    region: requiredEnv("COS_REGION"),
    publicOrigin: requiredEnv("NEXT_PUBLIC_COS_BASE_URL"),
    versioningState: (process.env.COS_IMMUTABLE_VERSIONING_STATE || "unknown") as
      | "never-enabled" | "enabled" | "suspended" | "unknown",
  });
}

export function storagePolicyAttestationFromEnv(): StoragePolicyAttestation {
  return {
    provider: "tencent-cos",
    policyVersion: process.env.RELEASE_STORAGE_POLICY_VERSION || IMMUTABLE_STORAGE_POLICY_VERSION,
    verifiedAt: process.env.RELEASE_STORAGE_POLICY_VERIFIED_AT || "",
    verificationToolVersion: process.env.RELEASE_STORAGE_VERIFICATION_TOOL_VERSION || IMMUTABLE_STORAGE_VERIFIER_VERSION,
    overwriteDenied: booleanEnv(process.env.RELEASE_STORAGE_OVERWRITE_DENIED),
    deleteDenied: booleanEnv(process.env.RELEASE_STORAGE_DELETE_DENIED),
    policyVerified: booleanEnv(process.env.RELEASE_STORAGE_POLICY_VERIFIED),
  };
}

function allowedOriginsFromEnv(store: ImmutableAssetStore) {
  const origins = new Set<string>();
  for (const value of [store.publicOrigin, ...(process.env.RELEASE_ASSET_ORIGINS || "").split(",")]) {
    if (!value.trim()) continue;
    origins.add(new URL(value.trim()).origin);
  }
  return origins;
}

export function assertStoragePolicyAttestation(policy: StoragePolicyAttestation) {
  if (policy.provider !== "tencent-cos"
    || policy.policyVersion !== IMMUTABLE_STORAGE_POLICY_VERSION
    || policy.verificationToolVersion !== IMMUTABLE_STORAGE_VERIFIER_VERSION
    || !policy.overwriteDenied
    || !policy.deleteDenied
    || !policy.policyVerified
    || Number.isNaN(Date.parse(policy.verifiedAt))) {
    throw new ImmutableAssetError("IMMUTABLE_ASSET_POLICY_UNVERIFIED");
  }
}

function expectedObjectName(issue: Issue, topicId: string, actual: string) {
  const topic = issue.topics.find((item) => item.id === topicId);
  if (!topic) throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${topicId}:topic`);
  const slot = `no-${String(topic.rank).padStart(2, "0")}`;
  if (actual !== topic.slug && actual !== slot) {
    throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${topicId}:path-slot`);
  }
}

function assertObjectMetadata(
  issue: Issue,
  candidate: PosterCandidate,
  key: string,
  metadata: Awaited<ReturnType<ImmutableAssetStore["headObject"]>>,
) {
  if (!metadata
    || metadata.key !== key
    || metadata.contentType.split(";")[0].trim().toLowerCase() !== "image/png"
    || metadata.sizeBytes <= 0
    || !metadata.etag
    || !metadata.storageVersionId
    || metadata.serverSideEncryption !== "AES256"
    || metadata.customMetadata["asset-batch-id"] === undefined
    || metadata.customMetadata["topic-id"] !== candidate.topicId
    || metadata.customMetadata.locale !== candidate.locale
    || metadata.customMetadata["issue-date"] !== issue.issueDate
    || metadata.customMetadata["expected-number"] !== String(issue.topics.find((item) => item.id === candidate.topicId)?.rank || "")
    || metadata.customMetadata["expected-site"] !== "xiazishuo.com"
    || !/^[0-9a-f]{64}$/.test(metadata.customMetadata.sha256 || "")
    || !metadata.customMetadata["created-at"]
    || !metadata.customMetadata["uploader-version"]) {
    throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", key);
  }
  return metadata;
}

export async function verifyReleaseStorage(
  issue: Issue,
  assetBatchId: string,
  candidates: PosterCandidate[],
  options: StorageGateOptions = {},
): Promise<StorageVerificationReport> {
  const policy = options.policy || storagePolicyAttestationFromEnv();
  assertStoragePolicyAttestation(policy);
  const store = options.store || cosImmutableStoreFromEnv();
  if (!store.conditionalCreateSupported) {
    throw new ImmutableAssetError("IMMUTABLE_ASSET_CONDITIONAL_WRITE_REQUIRED", store.provider);
  }
  const allowedOrigins = options.allowedOrigins || allowedOriginsFromEnv(store);
  const objects: ImmutableAssetObjectProof[] = [];
  for (const candidate of candidates) {
    const parsedUrl = assertImmutableAssetUrl(candidate.url, assetBatchId, allowedOrigins);
    if (parsedUrl.locale !== candidate.locale) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${candidate.topicId}:locale-path`);
    }
    expectedObjectName(issue, candidate.topicId, parsedUrl.topicOrSlot);
    const metadata = assertObjectMetadata(issue, candidate, parsedUrl.key, await store.headObject(parsedUrl.key));
    if (metadata.customMetadata["asset-batch-id"] !== assetBatchId) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${candidate.topicId}:asset-batch`);
    }
    const read = await hashImmutableObjectStream(await store.readObject(parsedUrl.key));
    const afterRead = assertObjectMetadata(issue, candidate, parsedUrl.key, await store.headObject(parsedUrl.key));
    if (afterRead.storageVersionId !== metadata.storageVersionId
      || afterRead.etag !== metadata.etag
      || afterRead.sizeBytes !== metadata.sizeBytes
      || afterRead.customMetadata.sha256 !== metadata.customMetadata.sha256) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${candidate.topicId}:changed-during-read`);
    }
    if (read.buffer.length !== metadata.sizeBytes) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${candidate.topicId}:size`);
    }
    if (read.sha256 !== metadata.customMetadata.sha256) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_HASH_MISMATCH", parsedUrl.key);
    }
    objects.push({
      assetBatchId,
      topicId: candidate.topicId,
      locale: candidate.locale,
      issueDate: metadata.customMetadata["issue-date"],
      expectedNumber: Number(metadata.customMetadata["expected-number"]),
      expectedSite: "xiazishuo.com",
      key: parsedUrl.key,
      url: candidate.url,
      sha256: read.sha256,
      contentType: "image/png",
      sizeBytes: read.buffer.length,
      createdAt: metadata.customMetadata["created-at"],
      uploaderVersion: metadata.customMetadata["uploader-version"],
      storageVersionId: metadata.storageVersionId,
      etag: metadata.etag,
      serverSideEncryption: "AES256",
    });
  }
  assertCompleteImmutableAssetManifest(issue, assetBatchId, objects);
  const now = options.now || (() => new Date());
  return {
    ...policy,
    assetBatchId,
    objects,
    objectManifestHash: stableHash(objects),
    verifiedAt: now().toISOString(),
  };
}

export function bindStorageProofsToPosterChecks(
  posterChecks: PosterImageCheck[],
  storageVerification: StorageVerificationReport,
): PosterCheck[] {
  assertStoragePolicyAttestation(storageVerification);
  const proofs = new Map(storageVerification.objects.map((proof) => [`${proof.topicId}:${proof.locale}`, proof]));
  if (proofs.size !== 18 || posterChecks.length !== 18) throw new Error("IMMUTABLE_ASSET_MANIFEST_INCOMPLETE");
  return posterChecks.map((poster) => {
    const proof = proofs.get(`${poster.topicId}:${poster.locale}`);
    if (!proof
      || proof.url !== poster.url
      || proof.sha256 !== poster.contentHash
      || proof.contentType !== "image/png") {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_HASH_MISMATCH", `${poster.topicId}:${poster.locale}`);
    }
    return {
      ...poster,
      sizeBytes: proof.sizeBytes,
      contentType: proof.contentType,
      storageProvider: storageVerification.provider,
      storageVersionId: proof.storageVersionId,
      etag: proof.etag,
      storageCreatedAt: proof.createdAt,
      uploaderVersion: proof.uploaderVersion,
    };
  });
}
