import type { PublicationReviewDecision } from "@xiazi/contracts";

export function releaseV2Enabled() {
  return process.env.RELEASE_V2_ENABLED === "true";
}

export function explicitDegradedFallbackEnabled() {
  return process.env.RELEASE_EXPLICIT_DEGRADED_FALLBACK === "true";
}

export function releaseApproverId() {
  return process.env.STUDIO_APPROVER_ID || "studio-session";
}

export type ReleaseApprovalMode = "human" | "automatic";

function requiredWaiverValue(env: NodeJS.ProcessEnv, name: string, minimumLength: number) {
  const value = env[name]?.trim();
  if (!value || value.length < minimumLength) throw new Error(`RELEASE_REVIEW_WAIVER_INCOMPLETE:${name}`);
  return value;
}

export function releaseReviewDecision(
  env: NodeJS.ProcessEnv = process.env,
): PublicationReviewDecision {
  const mode = env.RELEASE_REVIEW_MODE?.trim() || "enforced";
  if (mode === "enforced") {
    return { reviewStatus: "passed", reviewPassed: true, reviewWaived: false };
  }
  if (mode !== "waived") throw new Error("RELEASE_REVIEW_MODE_INVALID");
  if (env.RELEASE_ENVIRONMENT !== "production" && env.NODE_ENV !== "test") {
    throw new Error("RELEASE_REVIEW_WAIVER_PRODUCTION_ONLY");
  }
  const waiverId = requiredWaiverValue(env, "RELEASE_REVIEW_WAIVER_ID", 12);
  const waiverReason = requiredWaiverValue(env, "RELEASE_REVIEW_WAIVER_REASON", 24);
  const configuredBy = requiredWaiverValue(env, "RELEASE_REVIEW_WAIVER_CONFIGURED_BY", 3);
  const configuredAt = requiredWaiverValue(env, "RELEASE_REVIEW_WAIVER_CONFIGURED_AT", 20);
  if (Number.isNaN(Date.parse(configuredAt))) throw new Error("RELEASE_REVIEW_WAIVER_INCOMPLETE:RELEASE_REVIEW_WAIVER_CONFIGURED_AT");
  return {
    reviewStatus: "waived",
    reviewPassed: false,
    reviewWaived: true,
    waiverId,
    waiverReason,
    configuredBy,
    configuredAt: new Date(configuredAt).toISOString(),
  };
}

export function releaseApprovalMode(env: NodeJS.ProcessEnv = process.env): ReleaseApprovalMode {
  const mode = env.RELEASE_APPROVAL_MODE?.trim() || "human";
  if (mode !== "human" && mode !== "automatic") throw new Error("RELEASE_APPROVAL_MODE_INVALID");
  if (mode === "automatic" && env.RELEASE_ENVIRONMENT !== "production" && env.NODE_ENV !== "test") {
    throw new Error("RELEASE_AUTOMATIC_APPROVAL_PRODUCTION_ONLY");
  }
  return mode;
}

export function releaseCommitSha(env: NodeJS.ProcessEnv = process.env) {
  const value = (env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || "").trim();
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error("RELEASE_COMMIT_SHA_REQUIRED");
  return value;
}
