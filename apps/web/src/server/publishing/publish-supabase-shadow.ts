import type { SupabaseClient } from "@supabase/supabase-js";
import type { Issue } from "@xiazi/contracts";

import { createSupabaseServiceClientFromEnv } from "../content-sync/supabase-service-client";
import { syncIssueBundleToSupabase } from "../content-sync/sync-issue-bundle";
import { SupabaseContentRepository } from "../repositories/supabase-content-repository";
import { compareIssueParity } from "../shadow/content-parity";
import { PublishError } from "./publish-errors";

export type SupabaseShadowPublishResult = {
  status: "succeeded" | "skipped";
  changed: boolean;
  differenceCount: number;
  differencePaths: string[];
  compareStatus: "matched" | "mismatched";
  contentVersion: number;
};

export async function publishSupabaseShadow(
  issue: Issue,
  checksum: string,
  publishRequestId: string,
  client: SupabaseClient | null = createSupabaseServiceClientFromEnv(),
  actorType: "studio" | "retry" = "studio",
): Promise<SupabaseShadowPublishResult> {
  if (!client) {
    throw new PublishError("Supabase shadow client unavailable", "SUPABASE_SHADOW_FAILED", "supabase");
  }
  const sync = await syncIssueBundleToSupabase(client, issue, checksum, {
    actorType,
    actorId: publishRequestId,
    changeSummary: `${actorType} shadow publish issue ${issue.issueDate}`,
  });
  const repository = new SupabaseContentRepository(client);
  const supabaseIssue = await repository.getIssueByDate(issue.issueDate);
  if (!supabaseIssue) {
    throw new PublishError("Supabase issue missing after shadow publish", "SUPABASE_SHADOW_FAILED", "supabase-read");
  }
  const differencePaths = compareIssueParity(issue.issueDate, issue, supabaseIssue)
    .map((difference) => difference.path)
    .slice(0, 50);
  const compareStatus = differencePaths.length === 0 ? "matched" : "mismatched";
  if (compareStatus === "mismatched") {
    return {
      status: sync.changed ? "succeeded" : "skipped",
      changed: sync.changed,
      contentVersion: sync.contentVersion,
      differenceCount: differencePaths.length,
      differencePaths,
      compareStatus,
    };
  }
  return {
    status: sync.changed ? "succeeded" : "skipped",
    changed: sync.changed,
    contentVersion: sync.contentVersion,
    differenceCount: 0,
    differencePaths: [],
    compareStatus,
  };
}

export async function withTimeout<T>(task: Promise<T>, timeoutMs: number, code = "SUPABASE_SHADOW_TIMEOUT") {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new PublishError("Supabase shadow write timed out", code as "SUPABASE_SHADOW_TIMEOUT", "supabase"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
