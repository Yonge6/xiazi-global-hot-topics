import type { ImmutableAssetLocale, ImmutableAssetObjectProof, Issue } from "@xiazi/contracts";

export const IMMUTABLE_ASSET_PREFIX = "release-assets";
export const IMMUTABLE_STORAGE_POLICY_VERSION = "xiazi-cos-immutable-v1";
export const IMMUTABLE_STORAGE_VERIFIER_VERSION = "xiazi-storage-verifier-v1";

const ASSET_BATCH_PATTERN = /^asset_[A-Za-z0-9_-]{12,80}$/;
const TOPIC_OR_SLOT_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export function assertAssetBatchId(value: string) {
  if (!ASSET_BATCH_PATTERN.test(value)) throw new Error("IMMUTABLE_ASSET_BATCH_ID_INVALID");
  return value;
}

export function assertImmutableAssetLocale(value: string): asserts value is ImmutableAssetLocale {
  if (value !== "zh" && value !== "en") throw new Error("IMMUTABLE_ASSET_LOCALE_INVALID");
}

export function assertTopicOrSlot(value: string) {
  if (!TOPIC_OR_SLOT_PATTERN.test(value) || value === "current") {
    throw new Error("IMMUTABLE_ASSET_SLOT_INVALID");
  }
  return value;
}

export function immutableAssetKey(assetBatchId: string, locale: ImmutableAssetLocale, topicOrSlot: string) {
  assertAssetBatchId(assetBatchId);
  assertImmutableAssetLocale(locale);
  assertTopicOrSlot(topicOrSlot);
  return `${IMMUTABLE_ASSET_PREFIX}/${assetBatchId}/${locale}/${topicOrSlot}.png`;
}

export function parseImmutableAssetKey(key: string) {
  if (!key
    || key.startsWith("/")
    || key.includes("\\")
    || key.includes("//")
    || key.includes("..")
    || key.includes("%")) {
    throw new Error("IMMUTABLE_ASSET_PATH_INVALID");
  }
  const parts = key.split("/");
  if (parts.length !== 4 || parts[0] !== IMMUTABLE_ASSET_PREFIX || !parts[3].endsWith(".png")) {
    throw new Error("IMMUTABLE_ASSET_PATH_INVALID");
  }
  const assetBatchId = assertAssetBatchId(parts[1]);
  assertImmutableAssetLocale(parts[2]);
  const topicOrSlot = assertTopicOrSlot(parts[3].slice(0, -4));
  return { assetBatchId, locale: parts[2], topicOrSlot };
}

export function immutableAssetUrl(
  origin: string,
  assetBatchId: string,
  locale: ImmutableAssetLocale,
  topicOrSlot: string,
) {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.pathname !== "/" || parsedOrigin.search || parsedOrigin.hash) {
    throw new Error("IMMUTABLE_ASSET_ORIGIN_NOT_ALLOWED");
  }
  if (parsedOrigin.protocol !== "https:"
    && !(parsedOrigin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname))) {
    throw new Error("IMMUTABLE_ASSET_ORIGIN_NOT_ALLOWED");
  }
  return new URL(immutableAssetKey(assetBatchId, locale, topicOrSlot), parsedOrigin).toString();
}

export function assertImmutableAssetUrl(value: string, assetBatchId: string, allowedOrigins: Set<string>) {
  const url = new URL(value);
  if (!allowedOrigins.has(url.origin)) throw new Error(`IMMUTABLE_ASSET_ORIGIN_NOT_ALLOWED:${url.origin}`);
  if (url.username || url.password || url.search || url.hash) throw new Error("IMMUTABLE_ASSET_PATH_INVALID");
  const rawKey = url.pathname.replace(/^\//, "");
  const parsed = parseImmutableAssetKey(rawKey);
  if (parsed.assetBatchId !== assertAssetBatchId(assetBatchId)) {
    throw new Error("IMMUTABLE_ASSET_BATCH_ID_MISMATCH");
  }
  return { ...parsed, key: rawKey, url };
}

function expectedSlots(issue: Issue) {
  return new Set(issue.topics.flatMap((topic) => (["zh", "en"] as const).map((locale) => `${topic.id}:${locale}`)));
}

export function assertCompleteImmutableAssetManifest(issue: Issue, assetBatchId: string, objects: ImmutableAssetObjectProof[]) {
  assertAssetBatchId(assetBatchId);
  const expected = expectedSlots(issue);
  const actual = new Set<string>();
  if (objects.length !== 18) throw new Error("IMMUTABLE_ASSET_MANIFEST_INCOMPLETE");
  for (const object of objects) {
    if (object.assetBatchId !== assetBatchId) throw new Error("IMMUTABLE_ASSET_BATCH_ID_MISMATCH");
    const slot = `${object.topicId}:${object.locale}`;
    if (!expected.has(slot) || actual.has(slot)) throw new Error("IMMUTABLE_ASSET_MANIFEST_SLOT_INVALID");
    actual.add(slot);
    const parsed = parseImmutableAssetKey(object.key);
    if (parsed.assetBatchId !== assetBatchId || parsed.locale !== object.locale) {
      throw new Error("IMMUTABLE_ASSET_MANIFEST_PATH_MISMATCH");
    }
    if (!HASH_PATTERN.test(object.sha256)
      || object.contentType !== "image/png"
      || !Number.isSafeInteger(object.sizeBytes)
      || object.sizeBytes <= 0
      || !object.storageVersionId
      || !object.etag
      || object.serverSideEncryption !== "AES256"
      || !object.uploaderVersion
      || Number.isNaN(Date.parse(object.createdAt))) {
      throw new Error("IMMUTABLE_ASSET_METADATA_MISMATCH");
    }
  }
  if ([...expected].some((slot) => !actual.has(slot))) throw new Error("IMMUTABLE_ASSET_MANIFEST_INCOMPLETE");
}
