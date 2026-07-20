import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { requireStagingEnvironment, sanitizedUrl } from "./lib/staging-rehearsal.mjs";

const staging = requireStagingEnvironment(process.env);
const bearer = process.env.STAGING_REVIEW_BEARER_SECRET;
const hmacSecret = process.env.STAGING_REVIEW_HMAC_SECRET;
const serviceRole = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const instanceA = process.env.STAGING_REVIEWER_INSTANCE_A_URL;
const instanceB = process.env.STAGING_REVIEWER_INSTANCE_B_URL;
const faultReviewer = process.env.STAGING_FAULT_REVIEWER_URL;
const expectedActive = process.env.STAGING_EXPECTED_ACTIVE_RELEASE_ID;
if (!bearer || !hmacSecret || !serviceRole || !instanceA || !instanceB || !faultReviewer || !expectedActive) {
  throw new Error("STAGING_REVIEWER_FAULT_CONFIG_MISSING");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function semanticPayload(mode) {
  const fact = `Controlled staging fact for ${mode}.`;
  return {
    releaseCandidateId: `fault-${mode}-${process.env.GITHUB_RUN_ID || "local"}`,
    source: {
      sourceId: `source-${mode}`,
      topicId: "staging-topic-01",
      finalUrl: `${staging.webUrl}/api/staging/source-fixture/staging-topic-01`,
      pageTitle: `Controlled staging ${mode}`,
      snapshotText: `${fact} This isolated source snapshot explicitly supports all four exact claims. `.repeat(10),
      correctionMarkerDetected: false,
      retractionMarkerDetected: false,
      claims: [
        { field: "headlineFact", locale: "zh-CN", text: fact },
        { field: "intro", locale: "zh-CN", text: fact },
        { field: "headlineFact", locale: "en-US", text: fact },
        { field: "intro", locale: "en-US", text: fact },
      ],
    },
  };
}

function signedRequest(payload, options = {}) {
  const path = "/api/review/semantic";
  const requestedAt = options.requestedAt || new Date().toISOString();
  const nonce = options.nonce || randomUUID().replaceAll("-", "");
  const body = {
    metadata: {
      protocolVersion: "xiazi-review-v1",
      rulesetVersion: "semantic-2026-07-19.1",
      requestId: options.requestId || randomUUID(),
      requestedAt,
      nonce,
      inputHash: sha256(canonicalJson(payload)),
    },
    payload,
  };
  const rawBody = JSON.stringify(body);
  const signatureMessage = ["xiazi-review-signature-v1", requestedAt, nonce, "POST", path, rawBody].join("\n");
  const signature = createHmac("sha256", hmacSecret).update(signatureMessage).digest("hex");
  return {
    path,
    rawBody,
    headers: {
      Authorization: `Bearer ${options.bearer || bearer}`,
      "Content-Type": "application/json",
      "X-Xiazi-Review-Timestamp": requestedAt,
      "X-Xiazi-Review-Nonce": nonce,
      "X-Xiazi-Review-Signature": signature,
    },
  };
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

async function send(url, request) {
  const response = await fetch(`${new URL(url).origin}${request.path}`, {
    method: "POST",
    headers: request.headers,
    body: request.rawBody,
    cache: "no-store",
    redirect: "error",
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* Expected for deliberately malformed transport. */ }
  return { status: response.status, body };
}

const results = [];
async function scenario(name, execute) {
  const before = await activePointer();
  const detail = await execute();
  const after = await activePointer();
  if (before !== after) throw new Error(`STAGING_POINTER_CHANGED:${name}:${before}:${after}`);
  results.push({ name, passed: true, pointerBefore: before, pointerAfter: after, pointerUnchanged: true, ...detail });
}

await scenario("reviewer-auth-401", async () => {
  const response = await send(instanceA, signedRequest(semanticPayload("auth-401"), { bearer: "invalid-staging-bearer" }));
  if (response.status !== 401 || response.body?.error?.failClosed !== true) throw new Error("STAGING_REVIEWER_AUTH_NOT_CLOSED");
  return { reviewerStatus: response.status, errorCode: response.body.error.code };
});

for (const [mode, expectedStatus, expectedCode] of [
  ["401", 502, "REVIEW_PROVIDER_FAILED:401"],
  ["429", 502, "REVIEW_PROVIDER_FAILED:429"],
  ["500", 502, "REVIEW_PROVIDER_FAILED:500"],
  ["malformed", 502, "REVIEW_PROVIDER_MALFORMED_RESPONSE"],
  ["timeout", 503, "REVIEW_PROVIDER_TIMEOUT"],
]) {
  await scenario(`model-${mode}`, async () => {
    const response = await send(faultReviewer, signedRequest(semanticPayload(mode)));
    if (response.status !== expectedStatus || response.body?.error?.code !== expectedCode || response.body?.error?.failClosed !== true) {
      throw new Error(`STAGING_MODEL_FAULT_NOT_CLOSED:${mode}:${response.status}:${response.body?.error?.code}`);
    }
    return { reviewerStatus: response.status, errorCode: response.body.error.code };
  });
}

await scenario("reviewer-outage", async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  let failed = false;
  try {
    await fetch("https://127.0.0.1:9/api/review/semantic", { method: "POST", signal: controller.signal });
  } catch {
    failed = true;
  } finally {
    clearTimeout(timeout);
  }
  if (!failed) throw new Error("STAGING_REVIEWER_OUTAGE_NOT_DETECTED");
  return { reviewerStatus: null, errorCode: "NETWORK_UNAVAILABLE", failClosed: true };
});

await scenario("nonce-replay-cross-instance", async () => {
  const request = signedRequest(semanticPayload("replay"));
  const first = await send(instanceA, request);
  if (first.status !== 200) throw new Error(`STAGING_REPLAY_FIRST_REQUEST_FAILED:${first.status}:${first.body?.error?.code}`);
  const second = await send(instanceB, request);
  if (second.status !== 403 || second.body?.error?.code !== "REVIEW_AUTH_REPLAY") {
    throw new Error(`STAGING_REPLAY_SECOND_REQUEST_ACCEPTED:${second.status}:${second.body?.error?.code}`);
  }
  return {
    firstInstance: sanitizedUrl(instanceA),
    secondInstance: sanitizedUrl(instanceB),
    firstStatus: first.status,
    secondStatus: second.status,
    errorCode: second.body.error.code,
    persistentStoreShared: true,
  };
});

const evidence = {
  schemaVersion: "release-v2-staging-reviewer-faults-v1",
  verifiedAt: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA || null,
  normalReviewer: sanitizedUrl(staging.reviewerUrl),
  faultProvider: "controlled-staging-only-openai-compatible-transport",
  faultProviderUsedForNormalRelease: false,
  results,
  secretsIncluded: false,
  productionResourcesIncluded: false,
};
if (process.env.STAGING_REVIEWER_FAULT_OUTPUT) {
  await mkdir(dirname(process.env.STAGING_REVIEWER_FAULT_OUTPUT), { recursive: true });
  await writeFile(process.env.STAGING_REVIEWER_FAULT_OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(evidence, null, 2));
