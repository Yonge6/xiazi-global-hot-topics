export type PublishErrorCode =
  | "ISSUE_VALIDATION_FAILED"
  | "GITHUB_ISSUE_READ_FAILED"
  | "ARCHIVE_MISMATCH"
  | "GITHUB_PRIMARY_FAILED"
  | "GITHUB_CONFLICT"
  | "SUPABASE_SHADOW_FAILED"
  | "SUPABASE_SHADOW_TIMEOUT"
  | "CONTENT_MISMATCH"
  | "PUBLISH_RUN_AUDIT_FAILED"
  | "SHADOW_RETRY_FAILED";

export class PublishError extends Error {
  constructor(
    message: string,
    readonly code: PublishErrorCode,
    readonly stage: string,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

export function publishErrorCode(error: unknown, fallback: PublishErrorCode) {
  return error instanceof PublishError ? error.code : fallback;
}

export function publishErrorStage(error: unknown, fallback: string) {
  return error instanceof PublishError ? error.stage : fallback;
}
