import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { verifyReleasePosters } from "../apps/web/src/server/releases/poster-gate";
import { requireStagingEnvironment, sanitizedUrl } from "./lib/staging-rehearsal.mjs";

const staging = requireStagingEnvironment(process.env);
const serviceRole = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const expectedActive = process.env.STAGING_EXPECTED_ACTIVE_RELEASE_ID;
const faultReviewer = process.env.STAGING_FAULT_REVIEWER_URL;
const bearer = process.env.STAGING_REVIEW_BEARER_SECRET;
const hmacSecret = process.env.STAGING_REVIEW_HMAC_SECRET;
const payloadPath = process.env.STAGING_RELEASE_A_PAYLOAD;
if (!serviceRole || !expectedActive || !faultReviewer || !bearer || !hmacSecret || !payloadPath) {
  throw new Error("STAGING_VISUAL_FAULT_CONFIG_MISSING");
}
const serviceRoleKey = serviceRole;
const input = JSON.parse(await readFile(payloadPath, "utf8"));
process.env.POSTER_VISION_REVIEW_URL = `${new URL(faultReviewer).origin}/api/review/visual`;
process.env.RELEASE_REVIEW_BEARER_SECRET = bearer;
process.env.RELEASE_REVIEW_SIGNING_SECRET = hmacSecret;
process.env.RELEASE_REVIEW_TIMEOUT_MS = "15000";

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
async function expectFailure(mode: string, expectedCode: string) {
  const before = await activePointer();
  const issue = structuredClone(input.issue);
  issue.topics[0].localizations["en-US"].headlineFact += ` fault-${mode}`;
  let actual = "";
  try {
    await verifyReleasePosters(issue, input.assetBatchId, input.posters);
  } catch (error) {
    actual = error instanceof Error ? error.message : String(error);
  }
  if (!actual.includes(expectedCode)) throw new Error(`STAGING_VISUAL_FAULT_EXPECTATION_FAILED:${mode}:${actual}`);
  const after = await activePointer();
  if (before !== after) throw new Error(`STAGING_POINTER_CHANGED:visual-${mode}:${before}:${after}`);
  results.push({
    name: `visual-${mode}`,
    passed: true,
    expectedCode,
    actualCode: actual.split(":").slice(0, 5).join(":"),
    pointerBefore: before,
    pointerAfter: after,
    pointerUnchanged: true,
  });
}

await expectFailure("visual-ip", "POSTER_VISION_GATE_FAILED");
await expectFailure("visual-incomplete", "POSTER_VISION_REVIEW_FAILED:422");
await expectFailure("visual-theme", "POSTER_CROSS_LOCALE_THEME_MISMATCH");
await expectFailure("visual-duplicate", "POSTER_VISUAL_SIMILARITY_REVIEW_REQUIRED");

const evidence = {
  schemaVersion: "release-v2-staging-visual-faults-v1",
  verifiedAt: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA || null,
  faultReviewer: sanitizedUrl(faultReviewer),
  controlledProviderUsedForNormalRelease: false,
  actualPosterBytesDownloadedAndCompared: true,
  results,
  secretsIncluded: false,
  productionResourcesIncluded: false,
};
if (process.env.STAGING_VISUAL_FAULT_OUTPUT) {
  await mkdir(dirname(process.env.STAGING_VISUAL_FAULT_OUTPUT), { recursive: true });
  await writeFile(process.env.STAGING_VISUAL_FAULT_OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(evidence, null, 2));
