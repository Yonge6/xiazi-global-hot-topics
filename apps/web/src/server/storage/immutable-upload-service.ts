import type { ImmutableAssetLocale, ImmutableAssetObjectProof, Issue, PosterCandidate } from "@xiazi/contracts";
import { assertCompleteImmutableAssetManifest, immutableAssetKey } from "@xiazi/domain";

import { stableHash } from "../releases/release-hash";
import {
  createVerifiedImmutableObject,
  type ImmutableAssetStore,
} from "./immutable-asset-store";
import {
  assertStoragePolicyAttestation,
  cosImmutableStoreFromEnv,
  storagePolicyAttestationFromEnv,
  type StoragePolicyAttestation,
} from "./storage-gate";

export type ImmutablePosterUpload = {
  topicId: string;
  locale: ImmutableAssetLocale;
  content: Buffer;
};

type UploadOptions = {
  store?: ImmutableAssetStore;
  policy?: StoragePolicyAttestation;
  now?: () => Date;
  uploaderVersion?: string;
  concurrency?: number;
  onProgress?: (progress: {
    completed: number;
    total: number;
    key: string;
    created: boolean;
    idempotent: boolean;
  }) => void;
};

function slotKey(topicId: string, locale: ImmutableAssetLocale) {
  return `${topicId}:${locale}`;
}

export async function uploadImmutableReleasePosters(
  issue: Issue,
  assetBatchId: string,
  uploads: ImmutablePosterUpload[],
  options: UploadOptions = {},
) {
  const expected = new Set(issue.topics.flatMap((topic) => (["zh", "en"] as const).map((locale) => slotKey(topic.id, locale))));
  const actual = new Set(uploads.map((upload) => slotKey(upload.topicId, upload.locale)));
  if (uploads.length !== 18
    || actual.size !== 18
    || [...expected].some((slot) => !actual.has(slot))) {
    throw new Error("IMMUTABLE_ASSET_MANIFEST_INCOMPLETE");
  }
  const policy = options.policy || storagePolicyAttestationFromEnv();
  assertStoragePolicyAttestation(policy);
  const store = options.store || cosImmutableStoreFromEnv();
  const now = options.now || (() => new Date());
  const createdAt = now().toISOString();
  const uploaderVersion = options.uploaderVersion || "xiazi-release-uploader-v1";
  const concurrency = options.concurrency
    ?? Number.parseInt(process.env.COS_UPLOAD_CONCURRENCY || "3", 10);
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error("IMMUTABLE_ASSET_UPLOAD_CONCURRENCY_INVALID");
  }
  const results = new Array<Awaited<ReturnType<typeof createVerifiedImmutableObject>>>(uploads.length);
  let nextIndex = 0;
  let completed = 0;
  async function uploadNext() {
    while (nextIndex < uploads.length) {
      const index = nextIndex;
      nextIndex += 1;
      const upload = uploads[index];
      const topic = issue.topics.find((item) => item.id === upload.topicId);
      if (!topic) throw new Error(`IMMUTABLE_ASSET_TOPIC_NOT_FOUND:${upload.topicId}`);
      const result = await createVerifiedImmutableObject(store, {
        key: immutableAssetKey(assetBatchId, upload.locale, topic.slug),
        content: upload.content,
        contentType: "image/png",
        assetBatchId,
        topicId: upload.topicId,
        locale: upload.locale,
        issueDate: issue.issueDate,
        expectedNumber: topic.rank,
        expectedSite: "xiazishuo.com",
        createdAt,
        uploaderVersion,
      });
      results[index] = result;
      completed += 1;
      options.onProgress?.({
        completed,
        total: uploads.length,
        key: result.object.key,
        created: result.created,
        idempotent: result.idempotent,
      });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, uploads.length) }, uploadNext));
  const objects: ImmutableAssetObjectProof[] = results.map((result) => result.object);
  const createdCount = results.filter((result) => result.created).length;
  const idempotentCount = results.filter((result) => result.idempotent).length;
  assertCompleteImmutableAssetManifest(issue, assetBatchId, objects);
  const posters: PosterCandidate[] = objects.map((object) => ({
    topicId: object.topicId,
    locale: object.locale,
    url: object.url,
  }));
  return {
    assetBatchId,
    objects,
    posters,
    objectManifestHash: stableHash(objects),
    createdCount,
    idempotentCount,
  };
}
