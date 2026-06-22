import { randomUUID } from "node:crypto";

import type { Issue } from "@xiazi/contracts";

import { createSupabaseServiceClientFromEnv } from "../content-sync/supabase-service-client";
import { canonicalIssueBundle } from "./canonical-issue";
import { PublishError, publishErrorCode, publishErrorStage } from "./publish-errors";
import { publishGitHubPrimary, type PublishTarget } from "./publish-github-primary";
import { publishSupabaseShadow, withTimeout } from "./publish-supabase-shadow";
import { startStudioPublishRun, updateStudioPublishRun } from "./studio-publish-runs";

export type StudioPublishResult = {
  published: boolean;
  issue: Issue;
  issueDate: string;
  publishRequestId: string;
  target: { source: "current" | "archive"; value: string };
  primary: {
    target: "github";
    status: "succeeded" | "failed";
    commitSha?: string;
  };
  shadow: {
    target: "supabase";
    status: "disabled" | "succeeded" | "skipped" | "failed" | "timeout";
    changed?: boolean;
  };
  compare: {
    status: "matched" | "mismatched" | "failed" | "not_started";
    differenceCount: number;
    differencePaths?: string[];
  };
};

function logPublishRunFallback(message: string, data: Record<string, unknown>) {
  console.warn(message, {
    publishRequestId: data.publishRequestId,
    issueDate: data.issueDate,
    errorStage: data.errorStage,
    errorCode: data.errorCode,
  });
}

export function studioShadowWriteEnabled() {
  return process.env.STUDIO_SHADOW_WRITE_ENABLED === "true";
}

export async function publishIssueFromStudio(input: {
  issue: unknown;
  target?: PublishTarget;
  shadowTimeoutMs?: number;
}): Promise<StudioPublishResult> {
  let bundle;
  try {
    bundle = canonicalIssueBundle(input.issue);
  } catch (error) {
    throw new PublishError(
      error instanceof Error ? error.message : "Issue validation failed",
      "ISSUE_VALIDATION_FAILED",
      "validation",
    );
  }

  const publishRequestId = bundle.publishRequestId || randomUUID();
  const shadowEnabled = studioShadowWriteEnabled();
  const serviceClient = shadowEnabled ? createSupabaseServiceClientFromEnv() : null;
  if (shadowEnabled) {
    try {
      await startStudioPublishRun(serviceClient, {
        publishRequestId,
        issueDate: bundle.issue.issueDate,
        checksum: bundle.checksum,
      });
    } catch (error) {
      logPublishRunFallback("studio publish run start failed", {
        publishRequestId,
        issueDate: bundle.issue.issueDate,
        errorStage: "audit",
        errorCode: error instanceof Error ? error.message : "AUDIT_FAILED",
      });
    }
  }

  let primary;
  try {
    primary = await publishGitHubPrimary(bundle.issue, input.target);
    if (shadowEnabled) {
      await updateStudioPublishRun(serviceClient, publishRequestId, {
        primaryStatus: "succeeded",
        primaryCommitSha: primary.commitSha,
      }).catch((error) => {
        logPublishRunFallback("studio publish primary audit failed", {
          publishRequestId,
          issueDate: bundle.issue.issueDate,
          errorStage: "audit",
          errorCode: error instanceof Error ? error.message : "AUDIT_FAILED",
        });
      });
    }
  } catch (error) {
    const code = publishErrorCode(error, "GITHUB_PRIMARY_FAILED");
    if (shadowEnabled) {
      await updateStudioPublishRun(serviceClient, publishRequestId, {
        primaryStatus: "failed",
        shadowStatus: "not_started",
        compareStatus: "not_started",
        errorStage: publishErrorStage(error, "github"),
        errorCode: code,
        finished: true,
      }).catch(() => undefined);
    }
    throw error;
  }

  if (!shadowEnabled) {
    return {
      published: true,
      issue: bundle.issue,
      issueDate: bundle.issue.issueDate,
      publishRequestId,
      target: primary.target,
      primary: { target: "github", status: "succeeded", ...(primary.commitSha ? { commitSha: primary.commitSha } : {}) },
      shadow: { target: "supabase", status: "disabled", changed: false },
      compare: { status: "not_started", differenceCount: 0 },
    };
  }

  try {
    const shadow = await withTimeout(
      publishSupabaseShadow(bundle.issue, bundle.checksum, publishRequestId, serviceClient),
      input.shadowTimeoutMs ?? 8000,
    );
    const compareStatus = shadow.compareStatus === "matched" ? "matched" : "mismatched";
    await updateStudioPublishRun(serviceClient, publishRequestId, {
      shadowStatus: shadow.status,
      shadowChanged: shadow.changed,
      compareStatus,
      differenceCount: shadow.differenceCount,
      differencePaths: shadow.differencePaths,
      errorStage: compareStatus === "mismatched" ? "compare" : "",
      errorCode: compareStatus === "mismatched" ? "CONTENT_MISMATCH" : "",
      finished: true,
    }).catch((error) => {
      logPublishRunFallback("studio publish shadow audit failed", {
        publishRequestId,
        issueDate: bundle.issue.issueDate,
        errorStage: "audit",
        errorCode: error instanceof Error ? error.message : "AUDIT_FAILED",
      });
    });
    return {
      published: true,
      issue: bundle.issue,
      issueDate: bundle.issue.issueDate,
      publishRequestId,
      target: primary.target,
      primary: { target: "github", status: "succeeded", ...(primary.commitSha ? { commitSha: primary.commitSha } : {}) },
      shadow: { target: "supabase", status: shadow.status, changed: shadow.changed },
      compare: {
        status: compareStatus,
        differenceCount: shadow.differenceCount,
        differencePaths: shadow.differencePaths,
      },
    };
  } catch (error) {
    const code = publishErrorCode(error, "SUPABASE_SHADOW_FAILED");
    const shadowStatus = code === "SUPABASE_SHADOW_TIMEOUT" ? "timeout" : "failed";
    await updateStudioPublishRun(serviceClient, publishRequestId, {
      shadowStatus,
      shadowChanged: false,
      compareStatus: "failed",
      errorStage: publishErrorStage(error, "supabase"),
      errorCode: code,
      finished: true,
    }).catch((auditError) => {
      logPublishRunFallback("studio publish shadow failure audit failed", {
        publishRequestId,
        issueDate: bundle.issue.issueDate,
        errorStage: "audit",
        errorCode: auditError instanceof Error ? auditError.message : "AUDIT_FAILED",
      });
    });
    return {
      published: true,
      issue: bundle.issue,
      issueDate: bundle.issue.issueDate,
      publishRequestId,
      target: primary.target,
      primary: { target: "github", status: "succeeded", ...(primary.commitSha ? { commitSha: primary.commitSha } : {}) },
      shadow: { target: "supabase", status: shadowStatus, changed: false },
      compare: { status: "failed", differenceCount: 0 },
    };
  }
}
