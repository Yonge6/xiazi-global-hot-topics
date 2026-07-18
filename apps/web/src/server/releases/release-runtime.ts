export function releaseV2Enabled() {
  return process.env.RELEASE_V2_ENABLED === "true";
}

export function explicitDegradedFallbackEnabled() {
  return process.env.RELEASE_EXPLICIT_DEGRADED_FALLBACK === "true";
}

export function releaseApproverId() {
  return process.env.STUDIO_APPROVER_ID || "studio-session";
}
