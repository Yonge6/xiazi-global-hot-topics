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
  const objects: ImmutableAssetObjectProof[] = [];
  let createdCount = 0;
  let idempotentCount = 0;
  for (const upload of uploads) {
    const topic = issue.topics.find((item) => item.id === upload.topicId);
    if (!topic) throw new Error(`IMMUTABLE_ASSET_TOPIC_NOT_FOUND:${upload.topicId}`);
    const result = await createVerifiedImmutableObject(store, {
      key: immutableAssetKey(assetBatchId, upload.locale, topic.slug),
      content: upload.content,
      contentType: "image/png",
      assetBatchId,
      topicId: upload.topicId,
      locale: upload.locale,
      createdAt,
      uploaderVersion,
    });
    objects.push(result.object);
    if (result.created) createdCount += 1;
    if (result.idempotent) idempotentCount += 1;
  }
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
