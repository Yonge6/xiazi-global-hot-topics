export const HISTORICAL_RELEASE_CUTOFF = "2026-07-18";
export const HISTORICAL_RELEASE_RECOVERY_DATES = [
  "2026-07-19",
  "2026-07-20",
  "2026-07-23",
] as const;
const historicalReleaseRecoveryDates = new Set<string>(HISTORICAL_RELEASE_RECOVERY_DATES);
export const PUBLICATION_RELEASE_SCHEMA_VERSION = "release-v2.1";

export function isHistoricalReleaseDate(issueDate: string) {
  return issueDate <= HISTORICAL_RELEASE_CUTOFF
    || historicalReleaseRecoveryDates.has(issueDate);
}

export function assertFutureReleaseDate(issueDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) throw new Error("Invalid issueDate");
  if (issueDate <= HISTORICAL_RELEASE_CUTOFF) {
    throw new Error(`Release V2 only accepts issues after ${HISTORICAL_RELEASE_CUTOFF}`);
  }
}

export function publicationReleaseId(issueDate: string, releaseHash: string) {
  assertFutureReleaseDate(issueDate);
  if (!/^[a-f0-9]{64}$/.test(releaseHash)) throw new Error("releaseHash must be a SHA-256 hex digest");
  return `rel_${issueDate.replaceAll("-", "")}_${releaseHash.slice(0, 24)}`;
}

export function publicationLeaseKey(issueDate: string) {
  assertFutureReleaseDate(issueDate);
  return `publication:${issueDate}`;
}
