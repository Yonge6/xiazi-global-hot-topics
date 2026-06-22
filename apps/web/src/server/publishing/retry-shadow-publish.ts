import { parseIssue } from "@xiazi/contracts";

import { contentChecksum } from "../content-sync/issue-bundle";
import { createSupabaseServiceClientFromEnv } from "../content-sync/supabase-service-client";
import { canonicalIssueBundle } from "./canonical-issue";
import { PublishError, publishErrorCode, publishErrorStage } from "./publish-errors";
import { publishSupabaseShadow, withTimeout } from "./publish-supabase-shadow";
import { readGitHubPrimaryIssue } from "./publish-github-primary";
import {
  getStudioPublishRun,
  incrementStudioPublishRunRetry,
  updateStudioPublishRun,
} from "./studio-publish-runs";

export async function retryStudioShadowPublish(publishRequestId: string) {
  const serviceClient = createSupabaseServiceClientFromEnv();
  const run = await getStudioPublishRun(serviceClient, publishRequestId);
  if (!run) {
    throw new PublishError("Publish run not found", "SHADOW_RETRY_FAILED", "retry");
  }
  await incrementStudioPublishRunRetry(serviceClient, publishRequestId);

  let bundle;
  try {
    const githubIssue = parseIssue(await readGitHubPrimaryIssue(run.issueDate));
    bundle = canonicalIssueBundle(githubIssue);
    if (contentChecksum(bundle.issue) !== run.checksum) {
      throw new PublishError("GitHub primary content checksum no longer matches this publish run", "SHADOW_RETRY_FAILED", "retry");
    }
  } catch (error) {
    const code = publishErrorCode(error, "SHADOW_RETRY_FAILED");
    await updateStudioPublishRun(serviceClient, publishRequestId, {
      shadowStatus: "failed",
      compareStatus: "failed",
      errorStage: publishErrorStage(error, "retry-read-primary"),
      errorCode: code,
      finished: true,
    }).catch(() => undefined);
    throw error;
  }

  try {
    const shadow = await withTimeout(
      publishSupabaseShadow(bundle.issue, bundle.checksum, publishRequestId, serviceClient, "retry"),
      8000,
    );
    const compareStatus = shadow.compareStatus === "matched" ? "matched" : "mismatched";
    const errorCode = compareStatus === "mismatched" ? "CONTENT_MISMATCH" : "";
    const updated = await updateStudioPublishRun(serviceClient, publishRequestId, {
      shadowStatus: shadow.status,
      shadowChanged: shadow.changed,
      compareStatus,
      differenceCount: shadow.differenceCount,
      differencePaths: shadow.differencePaths,
      errorStage: compareStatus === "mismatched" ? "compare" : "",
      errorCode,
      finished: true,
    });
    return {
      publishRequestId,
      issueDate: bundle.issue.issueDate,
      shadow: { target: "supabase" as const, status: shadow.status, changed: shadow.changed },
      compare: {
        status: compareStatus,
        differenceCount: shadow.differenceCount,
        differencePaths: shadow.differencePaths,
      },
      retryCount: updated?.retryCount ?? run.retryCount + 1,
    };
  } catch (error) {
    const code = publishErrorCode(error, "SHADOW_RETRY_FAILED");
    const shadowStatus = code === "SUPABASE_SHADOW_TIMEOUT" ? "timeout" : "failed";
    const updated = await updateStudioPublishRun(serviceClient, publishRequestId, {
      shadowStatus,
      shadowChanged: false,
      compareStatus: "failed",
      errorStage: publishErrorStage(error, "retry-shadow"),
      errorCode: code,
      finished: true,
    }).catch(() => null);
    return {
      publishRequestId,
      issueDate: bundle.issue.issueDate,
      shadow: { target: "supabase" as const, status: shadowStatus, changed: false },
      compare: { status: "failed" as const, differenceCount: 0 },
      retryCount: updated?.retryCount ?? run.retryCount + 1,
      errorCode: code,
    };
  }
}
