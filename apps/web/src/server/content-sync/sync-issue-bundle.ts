import type { SupabaseClient } from "@supabase/supabase-js";
import type { Issue } from "@xiazi/contracts";

export type SyncIssueBundleStatus = "skipped" | "inserted" | "updated";

export type SyncIssueBundleResult = {
  issueDate: string;
  checksum: string;
  executionKey: string;
  changed: boolean;
  contentVersion: number;
  syncStatus: SyncIssueBundleStatus;
};

export type SyncIssueBundleOptions = {
  actorType: "script" | "cron" | "manual" | "studio" | "automation" | "retry";
  actorId?: string;
  changeSummary?: string;
};

export async function syncIssueBundleToSupabase(
  supabase: SupabaseClient,
  issue: Issue,
  checksum: string,
  options: SyncIssueBundleOptions,
): Promise<SyncIssueBundleResult> {
  const executionKey = `shadow-sync:${issue.issueDate}:${checksum}`;
  const { data, error } = await supabase.rpc("upsert_issue_bundle_with_lock", {
    lock_key: executionKey,
    payload: {
      issue,
      contentChecksum: checksum,
      changeSummary: options.changeSummary || `shadow sync issue ${issue.issueDate}`,
      actorType: options.actorType,
      actorId: options.actorId,
    },
  });
  if (error) throw new Error(error.message);

  const changed = Boolean(data?.changed);
  const contentVersion = Number(data?.contentVersion || 0);
  const syncStatus: SyncIssueBundleStatus = !changed ? "skipped" : contentVersion > 1 ? "updated" : "inserted";
  return {
    issueDate: issue.issueDate,
    checksum,
    executionKey,
    changed,
    contentVersion,
    syncStatus,
  };
}
