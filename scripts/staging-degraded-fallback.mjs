import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { requireStagingEnvironment, sanitizedUrl } from "./lib/staging-rehearsal.mjs";

const staging = requireStagingEnvironment(process.env);
const serviceRole = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const expectedActive = process.env.STAGING_EXPECTED_ACTIVE_RELEASE_ID;
const fallbackOffUrl = process.env.STAGING_FALLBACK_OFF_URL;
const fallbackOnUrl = process.env.STAGING_FALLBACK_ON_URL;
if (!serviceRole || !expectedActive || !fallbackOffUrl || !fallbackOnUrl) {
  throw new Error("STAGING_DEGRADED_CONFIG_MISSING");
}

async function activePointer() {
  const response = await fetch(`${staging.supabaseUrl}/rest/v1/rpc/get_active_publication_release`, {
    method: "POST",
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`STAGING_POINTER_READ_FAILED:${response.status}`);
  const body = await response.json();
  const releaseId = body?.metadata?.releaseId || null;
  if (releaseId !== expectedActive) throw new Error(`STAGING_POINTER_UNEXPECTED:${releaseId}`);
  return releaseId;
}

async function requestContent(origin) {
  const response = await fetch(`${new URL(origin).origin}/api/content/`, { cache: "no-store", redirect: "error" });
  const body = await response.json();
  return { response, body };
}

const before = await activePointer();
const fallbackOff = await requestContent(fallbackOffUrl);
if (fallbackOff.response.status !== 503
  || fallbackOff.body.publicationHealth !== "degraded"
  || fallbackOff.body.stale !== true
  || fallbackOff.response.headers.get("x-publication-health") !== "degraded"
  || fallbackOff.response.headers.get("x-content-stale") !== "true") {
  throw new Error("STAGING_FALLBACK_OFF_NOT_EXPLICIT_503");
}
const afterOff = await activePointer();
if (before !== afterOff) throw new Error("STAGING_POINTER_CHANGED:FALLBACK_OFF");

const fallbackOn = await requestContent(fallbackOnUrl);
if (!fallbackOn.response.ok
  || fallbackOn.body.publicationHealth !== "degraded"
  || fallbackOn.body.stale !== true
  || !String(fallbackOn.body.releaseId || "").startsWith("legacy_")
  || fallbackOn.response.headers.get("x-publication-health") !== "degraded"
  || fallbackOn.response.headers.get("x-content-stale") !== "true") {
  throw new Error("STAGING_FALLBACK_ON_NOT_EXPLICITLY_STALE");
}
const afterOn = await activePointer();
if (before !== afterOn) throw new Error("STAGING_POINTER_CHANGED:FALLBACK_ON");

const evidence = {
  schemaVersion: "release-v2-staging-degraded-fallback-v1",
  verifiedAt: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA || null,
  activeReleaseId: expectedActive,
  pointerUnchanged: before === afterOff && before === afterOn,
  fallbackOff: {
    url: sanitizedUrl(fallbackOffUrl),
    status: fallbackOff.response.status,
    publicationHealth: fallbackOff.body.publicationHealth,
    stale: fallbackOff.body.stale,
  },
  fallbackOn: {
    url: sanitizedUrl(fallbackOnUrl),
    status: fallbackOn.response.status,
    publicationHealth: fallbackOn.body.publicationHealth,
    stale: fallbackOn.body.stale,
    dataSource: fallbackOn.body.dataSource,
    releaseIdPrefix: String(fallbackOn.body.releaseId).split("_")[0],
  },
  secretsIncluded: false,
  productionResourcesIncluded: false,
};
if (process.env.STAGING_DEGRADED_OUTPUT) {
  await mkdir(dirname(process.env.STAGING_DEGRADED_OUTPUT), { recursive: true });
  await writeFile(process.env.STAGING_DEGRADED_OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(evidence, null, 2));
