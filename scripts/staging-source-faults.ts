import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { verifyReleaseSources } from "../apps/web/src/server/releases/source-gate";
import { fetchSafeSource } from "../apps/web/src/server/releases/safe-source-fetch";
import { stagingRehearsalIssue } from "../apps/web/src/server/releases/staging-rehearsal-fixture";
import { requireStagingEnvironment, sanitizedUrl } from "./lib/staging-rehearsal.mjs";

const staging = requireStagingEnvironment(process.env);
const serviceRole = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const faultReviewer = process.env.STAGING_FAULT_REVIEWER_URL;
const expectedActive = process.env.STAGING_EXPECTED_ACTIVE_RELEASE_ID;
const bearer = process.env.STAGING_REVIEW_BEARER_SECRET;
const hmacSecret = process.env.STAGING_REVIEW_HMAC_SECRET;
if (!serviceRole || !faultReviewer || !expectedActive || !bearer || !hmacSecret) {
  throw new Error("STAGING_SOURCE_FAULT_CONFIG_MISSING");
}
const serviceRoleKey = serviceRole;
process.env.SOURCE_SEMANTIC_REVIEW_URL = `${new URL(faultReviewer).origin}/api/review/semantic`;
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
async function expectFailure(name: string, expectedCode: string, action: () => Promise<unknown>, injection: string) {
  const before = await activePointer();
  let actual = "";
  try {
    await action();
  } catch (error) {
    actual = error instanceof Error ? error.message : String(error);
  }
  if (!actual.startsWith(expectedCode)) throw new Error(`STAGING_FAULT_EXPECTATION_FAILED:${name}:${actual}`);
  const after = await activePointer();
  if (before !== after) throw new Error(`STAGING_POINTER_CHANGED:${name}:${before}:${after}`);
  results.push({ name, passed: true, expectedCode, actualCode: actual.split(":").slice(0, 5).join(":"), injection, pointerBefore: before, pointerAfter: after, pointerUnchanged: true });
}

function issueWithSourceMode(mode: string) {
  const issue = structuredClone(stagingRehearsalIssue({ issueDate: "2026-07-22", sourceOrigin: staging.webUrl }));
  issue.topics[0].sources[0].url = `${staging.webUrl}/api/staging/source-fixture/staging-topic-01?mode=${mode}`;
  return issue;
}

for (const status of ["unsupported", "uncertain"] as const) {
  await expectFailure(
    `source-claim-${status}`,
    "SOURCE_CLAIM_NOT_SUPPORTED",
    () => verifyReleaseSources(issueWithSourceMode("supported"), { releaseCandidateId: `fault-${status}-${process.env.GITHUB_RUN_ID || "local"}` }),
    "controlled staging reviewer result",
  );
}

await expectFailure(
  "source-correction",
  "SOURCE_CORRECTED_REVIEW_REQUIRED",
  () => verifyReleaseSources(issueWithSourceMode("correction"), { releaseCandidateId: `fault-supported-correction-${process.env.GITHUB_RUN_ID || "local"}` }),
  "live HTTPS correction marker plus controlled reviewer recognition",
);

await expectFailure(
  "source-retraction",
  "SOURCE_RETRACTED",
  () => verifyReleaseSources(issueWithSourceMode("retraction"), { releaseCandidateId: `fault-supported-retraction-${process.env.GITHUB_RUN_ID || "local"}` }),
  "live HTTPS retraction marker plus controlled reviewer recognition",
);

for (const [mode, code] of [
  ["redirect-localhost", "SOURCE_DNS_ADDRESS_NOT_PUBLIC"],
  ["redirect-private-ipv4", "SOURCE_DNS_ADDRESS_NOT_PUBLIC"],
  ["redirect-private-ipv6", "SOURCE_DNS_ADDRESS_NOT_PUBLIC"],
  ["redirect-loop", "SOURCE_TOO_MANY_REDIRECTS"],
  ["too-large", "SOURCE_BODY_TOO_LARGE"],
] as const) {
  await expectFailure(
    `source-${mode}`,
    code,
    () => fetchSafeSource(`${staging.webUrl}/api/staging/source-fixture/staging-topic-01?mode=${mode}`, { maxBytes: 500_000, maxRedirects: 3 }),
    "live HTTPS staging source fixture",
  );
}

await expectFailure(
  "source-dns-public-private-mix",
  "SOURCE_DNS_ADDRESS_NOT_PUBLIC",
  () => fetchSafeSource("https://mixed-address.staging.invalid/story", {
    resolver: async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.7", family: 4 }],
    requestOnce: async () => { throw new Error("REQUEST_MUST_NOT_START"); },
  }),
  "controlled DNS resolver before any socket connection",
);

const evidence = {
  schemaVersion: "release-v2-staging-source-faults-v1",
  verifiedAt: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA || null,
  web: sanitizedUrl(staging.webUrl),
  faultReviewer: sanitizedUrl(faultReviewer),
  faultReviewerUsedForNormalRelease: false,
  results,
  secretsIncluded: false,
  productionResourcesIncluded: false,
};
if (process.env.STAGING_SOURCE_FAULT_OUTPUT) {
  await mkdir(dirname(process.env.STAGING_SOURCE_FAULT_OUTPUT), { recursive: true });
  await writeFile(process.env.STAGING_SOURCE_FAULT_OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(evidence, null, 2));
