import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { bindStorageProofsToPosterChecks, verifyReleaseStorage } from "../apps/web/src/server/storage/storage-gate";
import { requireStagingEnvironment } from "./lib/staging-rehearsal.mjs";

const staging = requireStagingEnvironment(process.env);
const serviceRole = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const expectedActive = process.env.STAGING_EXPECTED_ACTIVE_RELEASE_ID;
const payloadPath = process.env.STAGING_RELEASE_A_PAYLOAD;
if (!serviceRole || !expectedActive || !payloadPath) throw new Error("STAGING_STORAGE_FAULT_CONFIG_MISSING");
const serviceRoleKey = serviceRole;
const input = JSON.parse(await readFile(payloadPath, "utf8"));

async function activePointer() {
  const response = await fetch(`${staging.supabaseUrl}/rest/v1/rpc/get_active_publication_release`, {
    method: "POST",
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`STAGING_POINTER_READ_FAILED:${response.status}`);
  const body = await response.json() as { metadata?: { releaseId?: string } };
  const releaseId = body.metadata?.releaseId || null;
  if (releaseId !== expectedActive) throw new Error(`STAGING_POINTER_UNEXPECTED:${releaseId}`);
  return releaseId;
}

const results: Array<Record<string, unknown>> = [];
async function expectFailure(name: string, expectedCode: string, action: () => Promise<unknown>) {
  const before = await activePointer();
  let actual = "";
  try { await action(); } catch (error) { actual = error instanceof Error ? error.message : String(error); }
  if (!actual.includes(expectedCode)) throw new Error(`STAGING_STORAGE_FAULT_EXPECTATION_FAILED:${name}:${actual}`);
  const after = await activePointer();
  if (before !== after) throw new Error(`STAGING_POINTER_CHANGED:${name}:${before}:${after}`);
  results.push({ name, passed: true, expectedCode, actualCode: actual.split(":").slice(0, 4).join(":"), pointerBefore: before, pointerAfter: after, pointerUnchanged: true });
}

const baseline = await verifyReleaseStorage(input.issue, input.assetBatchId, input.posters);
if (baseline.objects.length !== 18 || baseline.objects.some((object) => object.serverSideEncryption !== "AES256")) {
  throw new Error("STAGING_STORAGE_BASELINE_INVALID");
}

await expectFailure("cos-manifest-incomplete", "IMMUTABLE_ASSET_MANIFEST_INCOMPLETE", () => (
  verifyReleaseStorage(input.issue, input.assetBatchId, input.posters.slice(0, 17))
));

await expectFailure("cos-object-missing", "IMMUTABLE_ASSET", () => {
  const missingBatch = `asset_staging_missing_${process.env.GITHUB_RUN_ID || "local"}`;
  const candidates = input.posters.map((poster: { url: string }) => ({
    ...poster,
    url: poster.url.replace(`/release-assets/${input.assetBatchId}/`, `/release-assets/${missingBatch}/`),
  }));
  return verifyReleaseStorage(input.issue, missingBatch, candidates);
});

await expectFailure("cos-content-hash-manifest-change", "IMMUTABLE_ASSET_HASH_MISMATCH", async () => {
  const checks = baseline.objects.map((object) => ({
    topicId: object.topicId,
    locale: object.locale,
    url: object.url,
    contentHash: object.sha256,
  }));
  checks[0].contentHash = "0".repeat(64);
  bindStorageProofsToPosterChecks(checks as never, baseline);
});

const evidence = {
  schemaVersion: "release-v2-staging-storage-faults-v1",
  verifiedAt: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA || null,
  activeReleaseId: expectedActive,
  baseline: {
    assetBatchId: baseline.assetBatchId,
    objectCount: baseline.objects.length,
    objectManifestHash: baseline.objectManifestHash,
    encryption: "AES256",
    policyVersion: baseline.policyVersion,
  },
  results,
  overwriteDeleteCopyMultipartEvidence: "protected COS verifier output in the same workflow artifact",
  secretsIncluded: false,
  productionResourcesIncluded: false,
};
if (process.env.STAGING_STORAGE_FAULT_OUTPUT) {
  await mkdir(dirname(process.env.STAGING_STORAGE_FAULT_OUTPUT), { recursive: true });
  await writeFile(process.env.STAGING_STORAGE_FAULT_OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(evidence, null, 2));
