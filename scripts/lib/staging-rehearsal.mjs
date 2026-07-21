import { createHash } from "node:crypto";

const retiredOrProductionHosts = new Set([
  "xiazishuo.com",
  "www.xiazishuo.com",
  "pluto.hk",
  "www.pluto.hk",
]);

export function requireStagingEnvironment(env = process.env) {
  if (env.RELEASE_ENVIRONMENT !== "staging") throw new Error("STAGING_GUARD:RELEASE_ENVIRONMENT");
  if (env.RELEASE_V2_ENABLED !== "true") throw new Error("STAGING_GUARD:RELEASE_V2_ENABLED");
  if (env.STAGING_DIRECT_COS_ORIGIN !== "true") throw new Error("STAGING_GUARD:DIRECT_COS_ORIGIN_REQUIRED");
  if (env.STAGING_CDN_URL) throw new Error("STAGING_GUARD:CDN_FORBIDDEN");
  const bucket = env.STAGING_COS_BUCKET || "";
  if (!bucket.toLowerCase().includes("xiazi") || !bucket.toLowerCase().includes("staging")) {
    throw new Error("STAGING_GUARD:COS_BUCKET_IDENTITY");
  }
  const projectRef = env.STAGING_SUPABASE_PROJECT_REF || "";
  if (!/^[a-z]{20}$/.test(projectRef)) throw new Error("STAGING_GUARD:SUPABASE_PROJECT_REF");
  const urls = [env.STAGING_WEB_URL, env.STAGING_REVIEWER_URL, env.STAGING_SUPABASE_URL];
  for (const value of urls) {
    if (!value) throw new Error("STAGING_GUARD:URL_MISSING");
    const url = new URL(value);
    if (url.protocol !== "https:" || retiredOrProductionHosts.has(url.hostname)) {
      throw new Error(`STAGING_GUARD:PRODUCTION_OR_INSECURE_URL:${url.hostname}`);
    }
  }
  if (!new URL(env.STAGING_SUPABASE_URL).hostname.startsWith(`${projectRef}.`)) {
    throw new Error("STAGING_GUARD:SUPABASE_REF_MISMATCH");
  }
  return {
    bucket,
    projectRef,
    webUrl: new URL(env.STAGING_WEB_URL).origin,
    reviewerUrl: new URL(env.STAGING_REVIEWER_URL).origin,
    supabaseUrl: new URL(env.STAGING_SUPABASE_URL).origin,
  };
}

export async function fetchJson(url, init = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, { ...init, cache: "no-store", redirect: init.redirect || "error" });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`STAGING_RESPONSE_NOT_JSON:${response.status}:${new URL(url).pathname}`);
  }
  if (!response.ok) throw new Error(`STAGING_HTTP_FAILED:${response.status}:${new URL(url).pathname}`);
  return { response, body };
}

export function assertReviewerIdentity(health, version, expectedDeploymentVersion) {
  if (health.status !== "ok" || !health.protocolVersion) throw new Error("STAGING_REVIEWER_HEALTH_INVALID");
  if (version.protocolVersion !== health.protocolVersion
    || !version.semanticRulesetVersion
    || !version.visualRulesetVersion
    || version.provider === "mock"
    || version.modelVersion === "unconfigured"
    || version.deploymentVersion !== expectedDeploymentVersion) {
    throw new Error("STAGING_REVIEWER_VERSION_INVALID");
  }
}

export function assertActivePublication(content, expectedReleaseId) {
  if (content.releaseId !== expectedReleaseId
    || content.assetVersion !== expectedReleaseId
    || content.dataSource !== "supabase-release"
    || content.publicationHealth !== "healthy"
    || content.stale !== false
    || !/^[0-9a-f]{64}$/.test(content.contentHash || "")
    || !content.releaseSchemaVersion
    || !content.deployedAt
    || !Array.isArray(content.topics)
    || content.topics.length !== 9) {
    throw new Error("STAGING_ACTIVE_PUBLICATION_INVALID");
  }
}

export function assertDatabasePointer(payload, expectedReleaseId) {
  if (!payload || payload.metadata?.releaseId !== expectedReleaseId
    || payload.metadata?.dataSource !== "supabase-release"
    || payload.metadata?.publicationHealth !== "healthy"
    || payload.metadata?.stale !== false) {
    throw new Error("STAGING_DATABASE_POINTER_MISMATCH");
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sanitizedUrl(value) {
  const url = new URL(value);
  return `${url.protocol}//${url.hostname}`;
}
