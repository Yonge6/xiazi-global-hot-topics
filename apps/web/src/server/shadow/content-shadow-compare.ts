import type { SupabaseClient } from "@supabase/supabase-js";

import { contentChecksum, validateIssueForImport } from "../content-sync/issue-bundle";
import { createSupabaseServiceClientFromEnv } from "../content-sync/supabase-service-client";
import { syncIssueBundleToSupabase, type SyncIssueBundleResult } from "../content-sync/sync-issue-bundle";
import type { ContentRepository } from "../repositories/content-repository";
import { JsonContentRepository } from "../repositories/json-content-repository";
import { SupabaseContentRepository } from "../repositories/supabase-content-repository";
import { compareIssueParity } from "./content-parity";

export type ShadowTriggerType = "cron" | "manual";
export type ShadowSyncStatus = "skipped" | "inserted" | "updated" | "failed";
export type ShadowCompareStatus = "matched" | "mismatch" | "failed";

export type ShadowCompareResult = {
  issueDate: string | null;
  matched: boolean;
  differenceCount: number;
  differencePaths: string[];
  jsonDurationMs: number;
  supabaseDurationMs: number;
  triggerType: ShadowTriggerType;
  syncStatus?: ShadowSyncStatus;
  syncChanged?: boolean;
  sourceIssueDate?: string;
  sourceChecksum?: string;
  syncErrorCode?: string;
  syncDurationMs?: number;
  compareStatus?: ShadowCompareStatus;
  deploymentId?: string;
  executionKey?: string;
  errorCode?: string;
};

type ShadowCompareOptions = {
  issueDate?: string;
  requestId?: string;
  triggerType?: ShadowTriggerType;
  syncBeforeCompare?: boolean;
  jsonRepository?: ContentRepository;
  supabaseRepository?: ContentRepository;
  loggerClient?: SupabaseClient | null;
  serviceClient?: SupabaseClient | null;
  syncIssueBundle?: typeof syncIssueBundleToSupabase;
};

function nowMs() {
  return Math.round(performance.now());
}

function deploymentId() {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || undefined;
}

function sanitizeDifferencePaths(paths: string[]) {
  return paths.slice(0, 50).map((path) => path.slice(0, 180));
}

async function recordShadowCompare(
  result: ShadowCompareResult,
  requestId: string | undefined,
  client: SupabaseClient | null,
) {
  if (!client) return;
  const { error } = await client.from("shadow_compare_runs").insert({
    issue_date: result.issueDate || null,
    matched: result.matched,
    difference_count: result.differenceCount,
    difference_paths: result.differencePaths,
    json_duration_ms: result.jsonDurationMs,
    supabase_duration_ms: result.supabaseDurationMs,
    error_code: result.errorCode || null,
    request_id: requestId || null,
    trigger_type: result.triggerType,
    sync_status: result.syncStatus || null,
    sync_changed: result.syncChanged ?? null,
    source_issue_date: result.sourceIssueDate || result.issueDate || null,
    source_checksum: result.sourceChecksum || null,
    sync_error_code: result.syncErrorCode || null,
    sync_duration_ms: result.syncDurationMs ?? null,
    compare_status: result.compareStatus || null,
    deployment_id: result.deploymentId || null,
    execution_key: result.executionKey || null,
  });
  if (error) {
    console.warn("content shadow compare log insert failed", {
      issueDate: result.issueDate,
      requestId,
      errorCode: error.code,
    });
  }
}

function resultBase(triggerType: ShadowTriggerType) {
  return {
    triggerType,
    deploymentId: deploymentId(),
    differenceCount: 0,
    differencePaths: [],
    jsonDurationMs: 0,
    supabaseDurationMs: 0,
  };
}

export async function runContentShadowCompare(options: ShadowCompareOptions = {}): Promise<ShadowCompareResult> {
  const jsonRepository = options.jsonRepository || new JsonContentRepository();
  const supabaseRepository = options.supabaseRepository || new SupabaseContentRepository();
  const loggerClient = options.loggerClient === undefined ? createSupabaseServiceClientFromEnv() : options.loggerClient;
  const serviceClient = options.serviceClient === undefined ? createSupabaseServiceClientFromEnv() : options.serviceClient;
  const syncIssueBundle = options.syncIssueBundle || syncIssueBundleToSupabase;
  const triggerType = options.triggerType || "manual";
  const requestedIssueDate = options.issueDate;
  let issueDate: string | null = requestedIssueDate || null;
  let jsonDurationMs = 0;
  let supabaseDurationMs = 0;
  let sourceChecksum: string | undefined;
  let syncResult: SyncIssueBundleResult | undefined;
  let syncDurationMs: number | undefined;

  const jsonStart = nowMs();
  let jsonIssue;
  try {
    jsonIssue = requestedIssueDate
      ? await jsonRepository.getIssueByDate(requestedIssueDate)
      : await jsonRepository.getLatestPublishedIssue();
  } catch {
    jsonDurationMs = nowMs() - jsonStart;
    const result: ShadowCompareResult = {
      ...resultBase(triggerType),
      issueDate,
      matched: false,
      jsonDurationMs,
      errorCode: "JSON_READ_FAILED",
      compareStatus: "failed",
    };
    await recordShadowCompare(result, options.requestId, loggerClient);
    return result;
  }
  jsonDurationMs = nowMs() - jsonStart;

  if (!jsonIssue) {
    const result: ShadowCompareResult = {
      ...resultBase(triggerType),
      issueDate,
      matched: false,
      jsonDurationMs,
      errorCode: "JSON_READ_FAILED",
      compareStatus: "failed",
    };
    await recordShadowCompare(result, options.requestId, loggerClient);
    return result;
  }

  try {
    const validated = validateIssueForImport(jsonIssue);
    jsonIssue = validated.issue;
    issueDate = jsonIssue.issueDate;
    sourceChecksum = contentChecksum(jsonIssue);
  } catch {
    const result: ShadowCompareResult = {
      ...resultBase(triggerType),
      issueDate,
      matched: false,
      jsonDurationMs,
      errorCode: "ISSUE_VALIDATION_FAILED",
      compareStatus: "failed",
    };
    await recordShadowCompare(result, options.requestId, loggerClient);
    return result;
  }

  if (options.syncBeforeCompare) {
    const syncStart = nowMs();
    try {
      if (!serviceClient) throw new Error("SUPABASE_SERVICE_CLIENT_UNAVAILABLE");
      syncResult = await syncIssueBundle(serviceClient, jsonIssue, sourceChecksum, {
        actorType: triggerType,
        actorId: options.requestId,
        changeSummary: `shadow ${triggerType} sync issue ${jsonIssue.issueDate}`,
      });
      syncDurationMs = nowMs() - syncStart;
    } catch {
      syncDurationMs = nowMs() - syncStart;
      const result: ShadowCompareResult = {
        ...resultBase(triggerType),
        issueDate,
        matched: false,
        jsonDurationMs,
        sourceIssueDate: jsonIssue.issueDate,
        sourceChecksum,
        syncStatus: "failed",
        syncChanged: false,
        syncErrorCode: "SUPABASE_SYNC_FAILED",
        syncDurationMs,
        compareStatus: "failed",
        errorCode: "SUPABASE_SYNC_FAILED",
      };
      await recordShadowCompare(result, options.requestId, loggerClient);
      return result;
    }
  }

  let supabaseIssue;
  const supabaseStart = nowMs();
  try {
    supabaseIssue = await supabaseRepository.getIssueByDate(issueDate);
    supabaseDurationMs = nowMs() - supabaseStart;
  } catch {
    supabaseDurationMs = nowMs() - supabaseStart;
    const result: ShadowCompareResult = {
      ...resultBase(triggerType),
      issueDate,
      matched: false,
      jsonDurationMs,
      supabaseDurationMs,
      sourceIssueDate: jsonIssue.issueDate,
      sourceChecksum,
      syncStatus: syncResult?.syncStatus,
      syncChanged: syncResult?.changed,
      syncDurationMs,
      executionKey: syncResult?.executionKey,
      errorCode: "SUPABASE_READ_FAILED",
      compareStatus: "failed",
    };
    await recordShadowCompare(result, options.requestId, loggerClient);
    return result;
  }

  if (!supabaseIssue) {
    const result: ShadowCompareResult = {
      ...resultBase(triggerType),
      issueDate,
      matched: false,
      differenceCount: 1,
      differencePaths: ["$"],
      jsonDurationMs,
      supabaseDurationMs,
      sourceIssueDate: jsonIssue.issueDate,
      sourceChecksum,
      syncStatus: syncResult?.syncStatus,
      syncChanged: syncResult?.changed,
      syncDurationMs,
      executionKey: syncResult?.executionKey,
      errorCode: "SUPABASE_ISSUE_MISSING",
      compareStatus: "failed",
    };
    await recordShadowCompare(result, options.requestId, loggerClient);
    return result;
  }

  const differences = compareIssueParity(issueDate, jsonIssue, supabaseIssue);
  const differencePaths = sanitizeDifferencePaths(differences.map((difference) => difference.path));
  const result: ShadowCompareResult = {
    ...resultBase(triggerType),
    issueDate,
    matched: differencePaths.length === 0,
    differenceCount: differences.length,
    differencePaths,
    jsonDurationMs,
    supabaseDurationMs,
    sourceIssueDate: jsonIssue.issueDate,
    sourceChecksum,
    syncStatus: syncResult?.syncStatus,
    syncChanged: syncResult?.changed,
    syncDurationMs,
    executionKey: syncResult?.executionKey,
    compareStatus: differencePaths.length === 0 ? "matched" : "mismatch",
    ...(differencePaths.length > 0 ? { errorCode: "CONTENT_MISMATCH" } : {}),
  };
  await recordShadowCompare(result, options.requestId, loggerClient);
  return result;
}
