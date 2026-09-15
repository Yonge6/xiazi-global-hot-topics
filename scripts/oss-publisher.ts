import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Issue } from "@xiazi/contracts";
import { assertCompleteImmutableAssetManifest, immutableAssetKey } from "@xiazi/domain";
import { OssImmutableAssetStore } from "../apps/web/src/server/storage/oss-immutable-asset-store";
import { createVerifiedImmutableObject } from "../apps/web/src/server/storage/immutable-asset-store";
import type { ImmutablePosterUpload } from "../apps/web/src/server/storage/immutable-upload-service";

export async function uploadOssPosters(issue: Issue, assetBatchId: string, uploads: ImmutablePosterUpload[]) {
  const expected = new Set(issue.topics.flatMap((t) => ["zh", "en"].map((l) => `${t.id}:${l}`)));
  const actual = new Set(uploads.map((p) => `${p.topicId}:${p.locale}`));
  if (uploads.length !== 18 || actual.size !== 18 || [...expected].some((k) => !actual.has(k))) throw new Error("OSS_MANIFEST_INCOMPLETE");
  const filename = process.env.XIAZI_OSS_PUBLISHER_CONFIG || path.join(os.homedir(), ".config/xiazi/oss-publisher.json");
  const info = await stat(filename);
  if ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) throw new Error("PUBLISHER_CONFIG_MUST_BE_OWNER_ONLY");
  const store = new OssImmutableAssetStore(JSON.parse(await readFile(filename, "utf8")));
  await store.verifyVersioning();
  const results = [];
  for (const upload of uploads) {
    const topic = issue.topics.find((t) => t.id === upload.topicId)!;
    const result = await createVerifiedImmutableObject(store, { ...upload, key: immutableAssetKey(assetBatchId, upload.locale, topic.slug),
      contentType: "image/png", assetBatchId, issueDate: issue.issueDate, expectedNumber: topic.rank, expectedSite: "xiazishuo.com",
      createdAt: new Date().toISOString(), uploaderVersion: "xiazi-daily-oss-v1" });
    results.push(result);
    console.log(`OSS ${results.length}/18 ${result.created ? "created" : "reused"}`);
  }
  const objects = results.map((r) => r.object);
  assertCompleteImmutableAssetManifest(issue, assetBatchId, objects);
  return { assetBatchId, objects, createdCount: results.filter((r) => r.created).length, idempotentCount: results.filter((r) => r.idempotent).length };
}
