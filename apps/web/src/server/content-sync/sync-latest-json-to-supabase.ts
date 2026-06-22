import type { SupabaseClient } from "@supabase/supabase-js";

import { JsonContentRepository } from "../repositories/json-content-repository";
import { contentChecksum, validateIssueForImport } from "./issue-bundle";
import { createSupabaseServiceClientFromEnv } from "./supabase-service-client";
import { syncIssueBundleToSupabase, type SyncIssueBundleOptions } from "./sync-issue-bundle";

export async function syncLatestJsonToSupabase(
  options: Partial<SyncIssueBundleOptions> & { supabase?: SupabaseClient } = {},
) {
  const jsonRepository = new JsonContentRepository();
  const sourceIssue = await jsonRepository.getLatestPublishedIssue();
  const { issue } = validateIssueForImport(sourceIssue);
  const checksum = contentChecksum(issue);
  const supabase = options.supabase || createSupabaseServiceClientFromEnv();
  if (!supabase) throw new Error("SUPABASE_SERVICE_CLIENT_UNAVAILABLE");
  const result = await syncIssueBundleToSupabase(supabase, issue, checksum, {
    actorType: options.actorType || "cron",
    actorId: options.actorId,
    changeSummary: options.changeSummary,
  });
  return { issue, checksum, result };
}
