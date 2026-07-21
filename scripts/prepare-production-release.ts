import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseIssue } from "@xiazi/contracts";

import { uploadImmutableReleasePosters } from "../apps/web/src/server/storage/immutable-upload-service";

const HISTORICAL_CUTOFF = "2026-07-18";
const CANONICAL_ORIGIN = "https://xiazishuo.com";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PRODUCTION_RELEASE_CONFIG_MISSING:${name}`);
  return value;
}

function assertProductionGuard(issueDate: string, assetBatchId: string) {
  if (process.env.RELEASE_ENVIRONMENT !== "production") {
    throw new Error("PRODUCTION_RELEASE_ENVIRONMENT_REQUIRED");
  }
  if (new URL(required("PRODUCTION_WEB_URL")).origin !== CANONICAL_ORIGIN) {
    throw new Error("PRODUCTION_RELEASE_ORIGIN_MISMATCH");
  }
  if (issueDate <= HISTORICAL_CUTOFF) {
    throw new Error("HISTORICAL_RELEASE_OUT_OF_SCOPE");
  }
  const compactDate = issueDate.replaceAll("-", "");
  if (!assetBatchId.startsWith(`asset_prod_${compactDate}_`)) {
    throw new Error("PRODUCTION_ASSET_BATCH_ID_INVALID");
  }
  const commitSha = required("PRODUCTION_COMMIT_SHA");
  if (!/^[0-9a-f]{40}$/.test(commitSha)) {
    throw new Error("PRODUCTION_COMMIT_SHA_INVALID");
  }
}

async function main() {
  const issueDate = required("PRODUCTION_ISSUE_DATE");
  const assetBatchId = required("PRODUCTION_ASSET_BATCH_ID");
  const variant = required("PRODUCTION_RELEASE_VARIANT").toUpperCase();
  const output = required("PRODUCTION_RELEASE_PAYLOAD_OUTPUT");
  if (variant !== "A" && variant !== "B") throw new Error("PRODUCTION_RELEASE_VARIANT_INVALID");
  assertProductionGuard(issueDate, assetBatchId);

  const issue = parseIssue(JSON.parse(await readFile("data/current-issue.json", "utf8")));
  if (issue.issueDate !== issueDate) throw new Error("PRODUCTION_ISSUE_DATE_MISMATCH");
  if (JSON.stringify(issue).toLowerCase().includes("pluto.hk")) {
    throw new Error("RETIRED_DOMAIN_IN_PRODUCTION_RELEASE");
  }

  const uploads = [];
  for (const topic of issue.topics) {
    for (const locale of ["zh", "en"] as const) {
      const posterPath = path.join("apps", "web", "public", "posters", locale, `${topic.slug}.png`);
      uploads.push({
        topicId: topic.id,
        locale,
        content: await readFile(posterPath),
      });
    }
  }

  const uploaded = await uploadImmutableReleasePosters(issue, assetBatchId, uploads, {
    uploaderVersion: `xiazi-production-rollout-${variant.toLowerCase()}-${required("PRODUCTION_COMMIT_SHA").slice(0, 12)}`,
    onProgress: ({ completed, total, key, created, idempotent }) => {
      console.error(`[production-upload] ${completed}/${total} ${key} created=${created} idempotent=${idempotent}`);
    },
  });
  const payload = {
    issue,
    posters: uploaded.posters,
    assetBatchId,
    idempotencyKey: `production-${issueDate}-${variant.toLowerCase()}-${assetBatchId}`,
    leaseOwner: `production-rollout-${variant.toLowerCase()}`,
  };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({
    issueDate,
    assetBatchId,
    variant,
    createdCount: uploaded.createdCount,
    idempotentCount: uploaded.idempotentCount,
    objectManifestHash: uploaded.objectManifestHash,
    posterCount: uploaded.posters.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
