import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishTriggerType = "studio" | "automation" | "retry";

export type PublishRunStatus = {
  publishRequestId: string;
  issueDate: string;
  checksum: string;
  triggerType: PublishTriggerType;
  primaryStatus: "pending" | "succeeded" | "failed";
  primaryCommitSha?: string;
  shadowStatus: "not_started" | "succeeded" | "skipped" | "failed" | "timeout";
  shadowChanged?: boolean;
  compareStatus: "not_started" | "matched" | "mismatched" | "failed";
  differenceCount: number;
  differencePaths: string[];
  retryCount: number;
  errorStage?: string;
  errorCode?: string;
};

export type StudioPublishRunStatus = PublishRunStatus;

type RunPatch = Partial<Omit<PublishRunStatus, "publishRequestId" | "issueDate" | "checksum">> & {
  finished?: boolean;
};

function deploymentId() {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || undefined;
}

function mapRun(row: Record<string, unknown>): PublishRunStatus {
  return {
    publishRequestId: String(row.publish_request_id),
    issueDate: String(row.issue_date),
    checksum: String(row.checksum),
    triggerType: row.trigger_type as PublishTriggerType,
    primaryStatus: row.primary_status as PublishRunStatus["primaryStatus"],
    ...(row.primary_commit_sha ? { primaryCommitSha: String(row.primary_commit_sha) } : {}),
    shadowStatus: row.shadow_status as PublishRunStatus["shadowStatus"],
    ...(typeof row.shadow_changed === "boolean" ? { shadowChanged: row.shadow_changed } : {}),
    compareStatus: row.compare_status as PublishRunStatus["compareStatus"],
    differenceCount: Number(row.difference_count || 0),
    differencePaths: Array.isArray(row.difference_paths) ? row.difference_paths.map(String) : [],
    retryCount: Number(row.retry_count || 0),
    ...(row.error_stage ? { errorStage: String(row.error_stage) } : {}),
    ...(row.error_code ? { errorCode: String(row.error_code) } : {}),
  };
}

function patchToRow(patch: RunPatch) {
  return {
    ...(patch.triggerType ? { trigger_type: patch.triggerType } : {}),
    ...(patch.primaryStatus ? { primary_status: patch.primaryStatus } : {}),
    ...(patch.primaryCommitSha ? { primary_commit_sha: patch.primaryCommitSha } : {}),
    ...(patch.shadowStatus ? { shadow_status: patch.shadowStatus } : {}),
    ...(patch.shadowChanged !== undefined ? { shadow_changed: patch.shadowChanged } : {}),
    ...(patch.compareStatus ? { compare_status: patch.compareStatus } : {}),
    ...(patch.differenceCount !== undefined ? { difference_count: patch.differenceCount } : {}),
    ...(patch.differencePaths ? { difference_paths: patch.differencePaths } : {}),
    ...(patch.retryCount !== undefined ? { retry_count: patch.retryCount } : {}),
    ...(patch.errorStage !== undefined ? { error_stage: patch.errorStage || null } : {}),
    ...(patch.errorCode !== undefined ? { error_code: patch.errorCode || null } : {}),
    ...(patch.finished ? { finished_at: new Date().toISOString() } : {}),
  };
}

export async function startPublishRun(
  client: SupabaseClient | null,
  input: {
    publishRequestId: string;
    issueDate: string;
    checksum: string;
    triggerType?: PublishTriggerType;
    primaryStatus?: PublishRunStatus["primaryStatus"];
    primaryCommitSha?: string;
  },
) {
  if (!client) return null;
  const { data, error } = await client
    .from("studio_publish_runs")
    .upsert({
      publish_request_id: input.publishRequestId,
      issue_date: input.issueDate,
      checksum: input.checksum,
      trigger_type: input.triggerType || "studio",
      primary_target: "github",
      primary_status: input.primaryStatus || "pending",
      primary_commit_sha: input.primaryCommitSha || null,
      shadow_status: "not_started",
      compare_status: "not_started",
      difference_count: 0,
      difference_paths: [],
      error_stage: null,
      error_code: null,
      deployment_id: deploymentId() || null,
      started_at: new Date().toISOString(),
      finished_at: null,
    }, { onConflict: "publish_request_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRun(data as Record<string, unknown>);
}

export async function updatePublishRun(
  client: SupabaseClient | null,
  publishRequestId: string,
  patch: RunPatch,
) {
  if (!client) return null;
  const { data, error } = await client
    .from("studio_publish_runs")
    .update(patchToRow(patch))
    .eq("publish_request_id", publishRequestId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRun(data as Record<string, unknown>);
}

export async function getPublishRun(client: SupabaseClient | null, publishRequestId: string) {
  if (!client) return null;
  const { data, error } = await client
    .from("studio_publish_runs")
    .select("*")
    .eq("publish_request_id", publishRequestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRun(data as Record<string, unknown>) : null;
}

export async function incrementPublishRunRetry(client: SupabaseClient | null, publishRequestId: string) {
  const current = await getPublishRun(client, publishRequestId);
  if (!current) return null;
  return updatePublishRun(client, publishRequestId, {
    retryCount: current.retryCount + 1,
    triggerType: "retry",
    shadowStatus: "not_started",
    compareStatus: "not_started",
    errorStage: "",
    errorCode: "",
  });
}

export const startStudioPublishRun = startPublishRun;
export const updateStudioPublishRun = updatePublishRun;
export const getStudioPublishRun = getPublishRun;
export const incrementStudioPublishRunRetry = incrementPublishRunRetry;
