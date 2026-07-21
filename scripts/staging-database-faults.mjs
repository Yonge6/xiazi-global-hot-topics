import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { requireStagingEnvironment } from "./lib/staging-rehearsal.mjs";

const staging = requireStagingEnvironment(process.env);
const serviceRole = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const expectedActive = process.env.STAGING_EXPECTED_ACTIVE_RELEASE_ID;
const releaseAId = process.env.STAGING_RELEASE_A_ID;
if (!serviceRole || !expectedActive || !releaseAId) throw new Error("STAGING_DATABASE_FAULT_CONFIG_MISSING");
const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, "Content-Type": "application/json" };

async function rpc(name, payload, customHeaders = headers) {
  const response = await fetch(`${staging.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: customHeaders,
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* Error text is retained only as an error-code source. */ }
  return { ok: response.ok, status: response.status, body, text };
}

async function activePointer() {
  const result = await rpc("get_active_publication_release", {});
  if (!result.ok) throw new Error(`STAGING_POINTER_READ_FAILED:${result.status}`);
  const releaseId = result.body?.metadata?.releaseId || null;
  if (releaseId !== expectedActive) throw new Error(`STAGING_POINTER_UNEXPECTED:${releaseId}`);
  return releaseId;
}

async function releaseExists(releaseId) {
  const response = await fetch(`${staging.supabaseUrl}/rest/v1/publication_releases?release_id=eq.${encodeURIComponent(releaseId)}&select=release_id`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`STAGING_RELEASE_QUERY_FAILED:${response.status}`);
  return (await response.json()).length > 0;
}

async function tableRows(table, query) {
  const response = await fetch(`${staging.supabaseUrl}/rest/v1/${table}?${query}`, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`STAGING_TABLE_QUERY_FAILED:${table}:${response.status}`);
  return response.json();
}

async function loadReleasePayload(releaseId) {
  const [release] = await tableRows("publication_releases", `release_id=eq.${encodeURIComponent(releaseId)}&select=*`);
  const sources = await tableRows("publication_source_snapshots", `release_id=eq.${encodeURIComponent(releaseId)}&select=*&order=source_id.asc`);
  const posters = await tableRows("publication_poster_checks", `release_id=eq.${encodeURIComponent(releaseId)}&select=*&order=topic_id.asc,locale.asc`);
  if (!release || sources.length < 8 || posters.length !== 18) throw new Error("STAGING_RELEASE_A_EXPORT_INCOMPLETE");
  return {
    releaseId: release.release_id,
    releaseHash: release.release_hash,
    schemaVersion: release.schema_version,
    issueDate: release.issue_date,
    contentHash: release.content_hash,
    issue: release.issue,
    sourceSnapshotHash: release.source_snapshot_hash,
    posterManifestHash: release.poster_manifest_hash,
    validationReport: release.validation_report,
    sources: sources.map((source) => ({
      sourceId: source.source_id,
      topicId: source.topic_id,
      url: source.url,
      finalUrl: source.final_url,
      fetchedAt: source.fetched_at,
      httpStatus: source.http_status,
      title: source.title,
      contentHash: source.content_hash,
      snapshotText: source.snapshot_text,
      correctionStatus: source.correction_status,
      supportsClaim: source.supports_claim,
      claimResults: source.claim_results,
      reviewProvider: source.review_provider,
      reviewModel: source.review_model,
      rationale: source.rationale,
    })),
    posters: posters.map((poster) => ({
      topicId: poster.topic_id,
      locale: poster.locale,
      url: poster.url,
      contentHash: poster.content_hash,
      perceptualHash: poster.perceptual_hash,
      width: poster.width,
      height: poster.height,
      format: poster.format,
      ocrTextHash: poster.ocr_text_hash,
      detectedNumber: poster.detected_number,
      detectedLanguage: poster.detected_language,
      titleMatches: poster.title_matches,
      dateMatches: poster.date_matches,
      siteMatches: poster.site_matches,
      themeMatches: poster.theme_matches,
      xiaziMatches: poster.xiazi_matches,
      doudoulongMatches: poster.doudoulong_matches,
      crossLocaleThemeMatches: poster.cross_locale_theme_matches,
      maxDistinctTopicSimilarity: poster.max_distinct_topic_similarity,
      batchComparisonHash: poster.batch_comparison_hash,
      duplicateOf: poster.duplicate_of,
      reviewProvider: poster.review_provider,
      reviewModel: poster.review_model,
      checkedAt: poster.checked_at,
    })),
  };
}

const releasePayload = await loadReleasePayload(releaseAId);

function faultDate(index) {
  const run = BigInt(process.env.GITHUB_RUN_ID || Date.now());
  const base = new Date("2090-01-01T00:00:00.000Z");
  base.setUTCDate(base.getUTCDate() + Number(run % 2500n) + index);
  return base.toISOString().slice(0, 10);
}

function errorText(result) {
  return `${result.body?.message || ""}:${result.body?.details || ""}:${result.text || ""}`;
}

const results = [];
async function scenario(name, execute) {
  const before = await activePointer();
  const detail = await execute();
  const after = await activePointer();
  if (before !== after) throw new Error(`STAGING_POINTER_CHANGED:${name}:${before}:${after}`);
  results.push({ name, passed: true, pointerBefore: before, pointerAfter: after, pointerUnchanged: true, ...detail });
}

const concurrentDate = faultDate(0);
const concurrent = await Promise.all([
  rpc("acquire_publication_lease", { p_issue_date: concurrentDate, p_idempotency_key: `0550-${process.env.GITHUB_RUN_ID}`, p_lease_owner: "worker-0550", p_lease_seconds: 30 }),
  rpc("acquire_publication_lease", { p_issue_date: concurrentDate, p_idempotency_key: `0600-${process.env.GITHUB_RUN_ID}`, p_lease_owner: "worker-0600", p_lease_seconds: 30 }),
]);
const winnerIndex = concurrent.findIndex((item) => item.ok && item.body?.acquired === true);
if (winnerIndex < 0 || concurrent.filter((item) => item.ok && item.body?.acquired === true).length !== 1) {
  throw new Error("STAGING_CONCURRENT_LEASE_WINNER_INVALID");
}
const winnerKey = winnerIndex === 0 ? `0550-${process.env.GITHUB_RUN_ID}` : `0600-${process.env.GITHUB_RUN_ID}`;
const winnerOwner = winnerIndex === 0 ? "worker-0550" : "worker-0600";
results.push({
  name: "lease-0550-0600-concurrency",
  passed: true,
  issueDate: concurrentDate,
  winner: winnerOwner,
  acquiredCount: 1,
  loserStatus: concurrent[1 - winnerIndex].status,
  pointerBefore: expectedActive,
  pointerAfter: await activePointer(),
  pointerUnchanged: true,
});

await scenario("lease-same-idempotency-short-circuit", async () => {
  const retry = await rpc("acquire_publication_lease", {
    p_issue_date: concurrentDate,
    p_idempotency_key: winnerKey,
    p_lease_owner: winnerOwner,
    p_lease_seconds: 30,
  });
  if (!retry.ok || retry.body?.acquired !== false || retry.body?.leaseOwner !== winnerOwner) {
    throw new Error("STAGING_IDEMPOTENCY_RETRY_NOT_SHORT_CIRCUITED");
  }
  return { acquired: false, existingOwner: retry.body.leaseOwner, status: retry.body.status };
});

await scenario("lease-owner-cannot-be-replaced", async () => {
  const attempt = await rpc("acquire_publication_lease", {
    p_issue_date: concurrentDate,
    p_idempotency_key: `replace-${process.env.GITHUB_RUN_ID}`,
    p_lease_owner: "replacement-worker",
    p_lease_seconds: 30,
  });
  if (attempt.ok || !errorText(attempt).includes("PUBLICATION_LEASE_HELD")) {
    throw new Error(`STAGING_ACTIVE_LEASE_REPLACED:${attempt.status}`);
  }
  return { rejectedStatus: attempt.status, errorCode: "PUBLICATION_LEASE_HELD" };
});

await scenario("lease-heartbeat", async () => {
  const renewed = await rpc("renew_publication_lease", {
    p_issue_date: concurrentDate,
    p_idempotency_key: winnerKey,
    p_lease_owner: winnerOwner,
    p_lease_seconds: 30,
  });
  if (!renewed.ok || renewed.body?.renewed !== true) throw new Error("STAGING_HEARTBEAT_FAILED");
  return { renewed: true, owner: winnerOwner };
});

const expiryDate = faultDate(1);
const oldKey = `expired-old-${process.env.GITHUB_RUN_ID}`;
const oldOwner = "expired-old-worker";
const acquired = await rpc("acquire_publication_lease", {
  p_issue_date: expiryDate,
  p_idempotency_key: oldKey,
  p_lease_owner: oldOwner,
  p_lease_seconds: 30,
});
if (!acquired.ok || acquired.body?.acquired !== true) throw new Error("STAGING_EXPIRY_LEASE_NOT_ACQUIRED");
await new Promise((resolve) => setTimeout(resolve, 31_000));

await scenario("lease-heartbeat-interrupted", async () => {
  const renewed = await rpc("renew_publication_lease", {
    p_issue_date: expiryDate,
    p_idempotency_key: oldKey,
    p_lease_owner: oldOwner,
    p_lease_seconds: 30,
  });
  if (renewed.ok || !errorText(renewed).includes("PUBLICATION_LEASE_EXPIRED_OR_OWNERSHIP_LOST")) {
    throw new Error("STAGING_EXPIRED_LEASE_RENEWED");
  }
  return { rejectedStatus: renewed.status, errorCode: "PUBLICATION_LEASE_EXPIRED_OR_OWNERSHIP_LOST" };
});

const takeoverKey = `takeover-${process.env.GITHUB_RUN_ID}`;
const takeoverOwner = "takeover-worker";
await scenario("lease-takeover-after-expiry", async () => {
  const takeover = await rpc("acquire_publication_lease", {
    p_issue_date: expiryDate,
    p_idempotency_key: takeoverKey,
    p_lease_owner: takeoverOwner,
    p_lease_seconds: 60,
  });
  if (!takeover.ok || takeover.body?.acquired !== true || takeover.body?.leaseOwner !== takeoverOwner) {
    throw new Error("STAGING_LEASE_TAKEOVER_FAILED");
  }
  return { acquired: true, newOwner: takeoverOwner };
});

await scenario("old-worker-stage-after-takeover", async () => {
  const oldPayload = structuredClone(releasePayload);
  oldPayload.issueDate = expiryDate;
  oldPayload.issue.issueDate = expiryDate;
  oldPayload.idempotencyKey = oldKey;
  oldPayload.leaseOwner = oldOwner;
  const stage = await rpc("stage_publication_release", { payload: oldPayload });
  if (stage.ok || !errorText(stage).includes("PUBLICATION_LEASE_OWNERSHIP_REQUIRED")) {
    throw new Error(`STAGING_OLD_WORKER_STAGE_ACCEPTED:${stage.status}`);
  }
  return { rejectedStatus: stage.status, errorCode: "PUBLICATION_LEASE_OWNERSHIP_REQUIRED" };
});

await scenario("stage-transaction-incomplete-manifest", async () => {
  const invalid = structuredClone(releasePayload);
  invalid.issueDate = expiryDate;
  invalid.issue.issueDate = expiryDate;
  invalid.idempotencyKey = takeoverKey;
  invalid.leaseOwner = takeoverOwner;
  invalid.releaseId = `rel_${expiryDate.replaceAll("-", "")}_${createHash("sha256").update(`invalid-${process.env.GITHUB_RUN_ID}`).digest("hex").slice(0, 24)}`;
  invalid.releaseHash = createHash("sha256").update(`invalid-release-${process.env.GITHUB_RUN_ID}`).digest("hex");
  invalid.posters = invalid.posters.slice(0, 17);
  invalid.validationReport.posterCount = 17;
  const stage = await rpc("stage_publication_release", { payload: invalid });
  if (stage.ok || !errorText(stage).includes("EXPECTED_18_POSTER_CHECKS")) {
    throw new Error(`STAGING_INCOMPLETE_MANIFEST_ACCEPTED:${stage.status}`);
  }
  if (await releaseExists(invalid.releaseId)) throw new Error("STAGING_PARTIAL_RELEASE_CREATED");
  return { rejectedStatus: stage.status, errorCode: "EXPECTED_18_POSTER_CHECKS", partialReleaseCreated: false };
});

await scenario("activation-nonexistent-release", async () => {
  const activation = await rpc("activate_publication_release", {
    p_release_id: `rel_20990101_${"f".repeat(24)}`,
    p_approver: "staging-fault-approver",
    p_activation_key: `missing-release-${process.env.GITHUB_RUN_ID}`,
  });
  if (activation.ok || !errorText(activation).includes("RELEASE_NOT_READY_FOR_ACTIVATION")) {
    throw new Error(`STAGING_MISSING_RELEASE_ACTIVATED:${activation.status}`);
  }
  return { rejectedStatus: activation.status, errorCode: "RELEASE_NOT_READY_FOR_ACTIVATION" };
});

await scenario("supabase-unauthorized-read", async () => {
  const unauthorized = await rpc("get_active_publication_release", {}, {
    apikey: "invalid-staging-key",
    Authorization: "Bearer invalid-staging-key",
    "Content-Type": "application/json",
  });
  if (unauthorized.ok || ![401, 403].includes(unauthorized.status)) {
    throw new Error(`STAGING_UNAUTHORIZED_SUPABASE_ACCEPTED:${unauthorized.status}`);
  }
  return { rejectedStatus: unauthorized.status, errorCode: "SUPABASE_AUTH_REJECTED" };
});

await scenario("supabase-network-disconnect-before-rpc", async () => {
  const controller = new AbortController();
  controller.abort();
  let failed = false;
  try {
    await fetch(`${staging.supabaseUrl}/rest/v1/rpc/stage_publication_release`, {
      method: "POST",
      headers,
      body: "{}",
      signal: controller.signal,
    });
  } catch {
    failed = true;
  }
  if (!failed) throw new Error("STAGING_ABORTED_RPC_WAS_SENT");
  return { errorCode: "CLIENT_ABORT_BEFORE_RPC", failClosed: true };
});

const evidence = {
  schemaVersion: "release-v2-staging-database-faults-v1",
  verifiedAt: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA || null,
  expectedActiveReleaseId: expectedActive,
  results,
  secretsIncluded: false,
  productionResourcesIncluded: false,
};
if (process.env.STAGING_DATABASE_FAULT_OUTPUT) {
  await mkdir(dirname(process.env.STAGING_DATABASE_FAULT_OUTPUT), { recursive: true });
  await writeFile(process.env.STAGING_DATABASE_FAULT_OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
}
console.log(JSON.stringify(evidence, null, 2));
