import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  assertActivePublication,
  assertDatabasePointer,
  assertReviewerIdentity,
  fetchJson,
  requireStagingEnvironment,
  sanitizedUrl,
  sha256,
} from "./lib/staging-rehearsal.mjs";

const env = process.env;
const staging = requireStagingEnvironment(env);
const expectedReleaseId = env.STAGING_EXPECTED_RELEASE_ID;
const expectedDeploymentVersion = env.STAGING_EXPECTED_DEPLOYMENT_VERSION;
const serviceRole = env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (!expectedReleaseId || !/^rel_\d{8}_[0-9a-f]{24}$/.test(expectedReleaseId)) {
  throw new Error("STAGING_EXPECTED_RELEASE_ID_INVALID");
}
if (!expectedDeploymentVersion) throw new Error("STAGING_EXPECTED_DEPLOYMENT_VERSION_MISSING");
if (!serviceRole) throw new Error("STAGING_SUPABASE_SERVICE_ROLE_KEY_MISSING");

const startedAt = new Date().toISOString();
const health = await fetchJson(`${staging.reviewerUrl}/api/health`);
const version = await fetchJson(`${staging.reviewerUrl}/api/version`);
assertReviewerIdentity(health.body, version.body, expectedDeploymentVersion);

const contentResult = await fetchJson(`${staging.webUrl}/api/content/`);
assertActivePublication(contentResult.body, expectedReleaseId);
if (contentResult.response.headers.get("x-release-id") !== expectedReleaseId
  || contentResult.response.headers.get("x-publication-health") !== "healthy") {
  throw new Error("STAGING_CONTENT_HEADERS_INVALID");
}

const rpc = await fetchJson(`${staging.supabaseUrl}/rest/v1/rpc/get_active_publication_release`, {
  method: "POST",
  headers: {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});
assertDatabasePointer(rpc.body, expectedReleaseId);

for (const locale of ["zh", "en"]) {
  const response = await fetch(`${staging.webUrl}/${locale}/`, { cache: "no-store", redirect: "error" });
  const html = await response.text();
  if (!response.ok || !html.includes(contentResult.body.issueDate) || !html.includes(expectedReleaseId)) {
    throw new Error(`STAGING_PAGE_RELEASE_MISMATCH:${locale}`);
  }
}

const posterProofs = [];
for (const topic of contentResult.body.topics) {
  for (const locale of ["zh", "en"]) {
    const posterName = topic.slug === "overview" ? "overview" : topic.slug;
    const url = new URL(`${staging.webUrl}/api/posters/${locale}/${posterName}`);
    url.searchParams.set("issueDate", contentResult.body.issueDate);
    url.searchParams.set("v", expectedReleaseId);
    const response = await fetch(url, { cache: "no-store", redirect: "manual" });
    if (response.status !== 307
      || response.headers.get("x-xiazi-release-id") !== expectedReleaseId
      || !/^[0-9a-f]{64}$/.test(response.headers.get("x-xiazi-content-hash") || "")) {
      throw new Error(`STAGING_POSTER_ROUTE_INVALID:${topic.id}:${locale}`);
    }
    const destination = response.headers.get("location");
    if (!destination || !destination.startsWith("https://") || !destination.includes("/release-assets/")) {
      throw new Error(`STAGING_POSTER_ORIGIN_INVALID:${topic.id}:${locale}`);
    }
    const object = await fetch(destination, { cache: "no-store", redirect: "error" });
    const bytes = Buffer.from(await object.arrayBuffer());
    const expectedHash = response.headers.get("x-xiazi-content-hash");
    if (!object.ok || object.headers.get("x-cos-server-side-encryption") !== "AES256" || sha256(bytes) !== expectedHash) {
      throw new Error(`STAGING_POSTER_OBJECT_INVALID:${topic.id}:${locale}`);
    }
    posterProofs.push({ topicId: topic.id, locale, contentHash: expectedHash, sizeBytes: bytes.length });
  }
}
if (posterProofs.length !== 18) throw new Error("STAGING_POSTER_COUNT_INVALID");

const evidence = {
  schemaVersion: "release-v2-staging-rehearsal-v1",
  verifiedAt: new Date().toISOString(),
  startedAt,
  commitSha: expectedDeploymentVersion,
  releaseId: expectedReleaseId,
  issueDate: contentResult.body.issueDate,
  contentHash: contentResult.body.contentHash,
  releaseSchemaVersion: contentResult.body.releaseSchemaVersion,
  deployedAt: contentResult.body.deployedAt,
  publicationHealth: contentResult.body.publicationHealth,
  stale: contentResult.body.stale,
  reviewer: {
    url: sanitizedUrl(staging.reviewerUrl),
    protocolVersion: version.body.protocolVersion,
    semanticRulesetVersion: version.body.semanticRulesetVersion,
    visualRulesetVersion: version.body.visualRulesetVersion,
    provider: version.body.provider,
    modelVersion: version.body.modelVersion,
    deploymentVersion: version.body.deploymentVersion,
  },
  web: { url: sanitizedUrl(staging.webUrl) },
  supabase: { projectRef: staging.projectRef, url: sanitizedUrl(staging.supabaseUrl) },
  storage: {
    provider: "tencent-cos",
    bucket: `${staging.bucket.slice(0, 18)}-REDACTED`,
    mode: "direct-cos-origin",
    cdnVerificationStatus: "not-applicable-for-direct-cos-origin",
    cdnSourceHashMatches: null,
  },
  posterProofs,
  secretsIncluded: false,
  productionResourcesIncluded: false,
};

const output = env.STAGING_EVIDENCE_OUTPUT;
if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(evidence, null, 2));
