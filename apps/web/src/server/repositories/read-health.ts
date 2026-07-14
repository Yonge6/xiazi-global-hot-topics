import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceClientFromEnv } from "../content-sync/supabase-service-client";

export type ReadPathType = "latest" | "issue" | "archive";
export type ReadFallbackReason =
  | "SUPABASE_READ_FAILED"
  | "SUPABASE_TIMEOUT"
  | "SUPABASE_ISSUE_MISSING"
  | "SUPABASE_CONTRACT_INVALID"
  | "SUPABASE_ARCHIVE_FAILED"
  | "SUPABASE_UNKNOWN_ERROR";

export type ContentReadRun = {
  requestId?: string;
  pathType: ReadPathType;
  issueDate?: string | null;
  primarySource: "supabase" | "json";
  fallbackUsed: boolean;
  fallbackReason?: ReadFallbackReason;
  supabaseDurationMs?: number | null;
  jsonDurationMs?: number | null;
  matched?: boolean | null;
  differenceCount?: number | null;
  differencePaths?: string[];
  errorCode?: string | null;
};

export function nowMs() {
  return Math.round(performance.now());
}

export function fallbackReasonFor(error: unknown, fallback: ReadFallbackReason): ReadFallbackReason {
  const message = error instanceof Error ? error.message : "";
  if (message === "SUPABASE_TIMEOUT") return "SUPABASE_TIMEOUT";
  if (/contract|parse|schema|validation|invalid/i.test(message)) return "SUPABASE_CONTRACT_INVALID";
  return fallback;
}

export async function withReadTimeout<T>(task: Promise<T>, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    task,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("SUPABASE_TIMEOUT")), timeoutMs);
    }),
  ]);
}

export async function recordContentReadRun(
  run: ContentReadRun,
  client: SupabaseClient | null = createSupabaseServiceClientFromEnv(),
) {
  if (!client) {
    if (run.fallbackUsed) {
      console.warn("content read fallback", {
        pathType: run.pathType,
        issueDate: run.issueDate,
        fallbackUsed: run.fallbackUsed,
        fallbackReason: run.fallbackReason,
        errorCode: run.errorCode,
      });
    }
    return;
  }

  const { error } = await client.from("content_read_runs").insert({
    request_id: run.requestId || null,
    path_type: run.pathType,
    issue_date: run.issueDate || null,
    primary_source: run.primarySource,
    fallback_used: run.fallbackUsed,
    fallback_reason: run.fallbackReason || null,
    supabase_duration_ms: run.supabaseDurationMs ?? null,
    json_duration_ms: run.jsonDurationMs ?? null,
    matched: run.matched ?? null,
    difference_count: run.differenceCount ?? null,
    difference_paths: run.differencePaths || [],
    error_code: run.errorCode || run.fallbackReason || null,
  });

  if (error) {
    console.warn("content read run insert failed", {
      pathType: run.pathType,
      issueDate: run.issueDate,
      fallbackUsed: run.fallbackUsed,
      fallbackReason: run.fallbackReason,
      errorCode: error.code,
    });
  }
}
