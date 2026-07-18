export const HISTORICAL_RELEASE_CUTOFF = "2026-07-18";

export function assertFutureReleaseDate(issueDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) throw new Error("Invalid issueDate");
  if (issueDate <= HISTORICAL_RELEASE_CUTOFF) {
    throw new Error(`Release V2 only accepts issues after ${HISTORICAL_RELEASE_CUTOFF}`);
  }
}

export function publicationReleaseId(issueDate: string, contentHash: string) {
  assertFutureReleaseDate(issueDate);
  if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error("contentHash must be a SHA-256 hex digest");
  return `rel_${issueDate.replaceAll("-", "")}_${contentHash.slice(0, 24)}`;
}

export function publicationLeaseKey(issueDate: string) {
  assertFutureReleaseDate(issueDate);
  return `publication:${issueDate}`;
}
