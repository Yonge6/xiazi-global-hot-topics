import { createSupabaseServiceClientFromEnv } from "../content-sync/supabase-service-client";
import { canonicalIssueBundle } from "./canonical-issue";
import { publishErrorCode, publishErrorStage } from "./publish-errors";
import { publishSupabaseShadow, withTimeout, type SupabaseShadowPublishResult } from "./publish-supabase-shadow";
import {
  startPublishRun,
  updatePublishRun,
  type PublishTriggerType,
} from "./studio-publish-runs";

export type CompleteShadowPublishResult = {
  issueDate: string;
  publishRequestId: string;
  checksum: string;
  primaryCommitSha?: string;
  shadow: SupabaseShadowPublishResult | null;
  shadowStatus: "succeeded" | "skipped" | "failed" | "timeout";
  compareStatus: "matched" | "mismatched" | "failed";
  differenceCount: number;
  differencePaths: string[];
  errorCode?: string;
};

function automationPublishRequestId(input: { commitSha: string; issueDate: string; checksum: string }) {
  return `automation:${input.commitSha}:${input.issueDate}:${input.checksum}`;
}

function logPublishRunFallback(message: string, data: Record<string, unknown>) {
  console.warn(message, {
    publishRequestId: data.publishRequestId,
    issueDate: data.issueDate,
    errorStage: data.errorStage,
    errorCode: data.errorCode,
  });
}

export async function completeShadowPublishAfterPrimary(input: {
  issue: unknown;
  triggerType: Exclude<PublishTriggerType, "retry">;
  primaryCommitSha?: string;
  publishRequestId?: string;
  shadowTimeoutMs?: number;
  throwOnShadowFailure?: boolean;
}): Promise<CompleteShadowPublishResult> {
  const bundle = canonicalIssueBundle(input.issue);
  const publishRequestId = input.publishRequestId
    || (input.triggerType === "automation" && input.primaryCommitSha
      ? automationPublishRequestId({
          commitSha: input.primaryCommitSha,
          issueDate: bundle.issue.issueDate,
          checksum: bundle.checksum,
        })
      : bundle.publishRequestId);
  const serviceClient = createSupabaseServiceClientFromEnv();

  try {
    await startPublishRun(serviceClient, {
      publishRequestId,
      issueDate: bundle.issue.issueDate,
      checksum: bundle.checksum,
      triggerType: input.triggerType,
      primaryStatus: "succeeded",
      primaryCommitSha: input.primaryCommitSha,
    });
  } catch (error) {
    logPublishRunFallback("publish run start failed", {
      publishRequestId,
      issueDate: bundle.issue.issueDate,
      errorStage: "audit",
      errorCode: error instanceof Error ? error.message : "PUBLISH_RUN_AUDIT_FAILED",
    });
  }

  try {
    const shadow = await withTimeout(
      publishSupabaseShadow(
        bundle.issue,
        bundle.checksum,
        publishRequestId,
        serviceClient,
        input.triggerType,
      ),
      input.shadowTimeoutMs ?? 8000,
    );
    const compareStatus = shadow.compareStatus === "matched" ? "matched" : "mismatched";
    const errorCode = compareStatus === "mismatched" ? "CONTENT_MISMATCH" : "";
    await updatePublishRun(serviceClient, publishRequestId, {
      shadowStatus: shadow.status,
      shadowChanged: shadow.changed,
      compareStatus,
      differenceCount: shadow.differenceCount,
      differencePaths: shadow.differencePaths,
      errorStage: compareStatus === "mismatched" ? "compare" : "",
      errorCode,
      finished: true,
    }).catch((error) => {
      logPublishRunFallback("publish run shadow audit failed", {
        publishRequestId,
        issueDate: bundle.issue.issueDate,
        errorStage: "audit",
        errorCode: error instanceof Error ? error.message : "PUBLISH_RUN_AUDIT_FAILED",
      });
    });
    return {
      issueDate: bundle.issue.issueDate,
      publishRequestId,
      checksum: bundle.checksum,
      ...(input.primaryCommitSha ? { primaryCommitSha: input.primaryCommitSha } : {}),
      shadow,
      shadowStatus: shadow.status,
      compareStatus,
      differenceCount: shadow.differenceCount,
      differencePaths: shadow.differencePaths,
      ...(errorCode ? { errorCode } : {}),
    };
  } catch (error) {
    const code = publishErrorCode(error, "SUPABASE_SHADOW_FAILED");
    const shadowStatus = code === "SUPABASE_SHADOW_TIMEOUT" ? "timeout" : "failed";
    await updatePublishRun(serviceClient, publishRequestId, {
      shadowStatus,
      shadowChanged: false,
      compareStatus: "failed",
      errorStage: publishErrorStage(error, "supabase"),
      errorCode: code,
      finished: true,
    }).catch((auditError) => {
      logPublishRunFallback("publish run shadow failure audit failed", {
        publishRequestId,
        issueDate: bundle.issue.issueDate,
        errorStage: "audit",
        errorCode: auditError instanceof Error ? auditError.message : "PUBLISH_RUN_AUDIT_FAILED",
      });
    });
    if (input.throwOnShadowFailure) throw error;
    return {
      issueDate: bundle.issue.issueDate,
      publishRequestId,
      checksum: bundle.checksum,
      ...(input.primaryCommitSha ? { primaryCommitSha: input.primaryCommitSha } : {}),
      shadow: null,
      shadowStatus,
      compareStatus: "failed",
      differenceCount: 0,
      differencePaths: [],
      errorCode: code,
    };
  }
}
