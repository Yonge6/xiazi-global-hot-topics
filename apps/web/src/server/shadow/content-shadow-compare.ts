import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ContentRepository } from "../repositories/content-repository";
import { JsonContentRepository } from "../repositories/json-content-repository";
import { SupabaseContentRepository } from "../repositories/supabase-content-repository";
import { compareIssueParity } from "./content-parity";

export type ShadowCompareResult = {
  issueDate: string;
  matched: boolean;
  differenceCount: number;
  differencePaths: string[];
  jsonDurationMs: number;
  supabaseDurationMs: number;
  errorCode?: string;
};

type ShadowCompareOptions = {
  issueDate?: string;
  requestId?: string;
  jsonRepository?: ContentRepository;
  supabaseRepository?: ContentRepository;
  loggerClient?: SupabaseClient | null;
};

function nowMs() {
  return Math.round(performance.now());
}

function serverServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase secret keys must not be exposed through NEXT_PUBLIC variables");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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
    issue_date: result.issueDate,
    matched: result.matched,
    difference_count: result.differenceCount,
    difference_paths: result.differencePaths,
    json_duration_ms: result.jsonDurationMs,
    supabase_duration_ms: result.supabaseDurationMs,
    error_code: result.errorCode || null,
    request_id: requestId || null,
  });
  if (error) {
    console.warn("content shadow compare log insert failed", {
      issueDate: result.issueDate,
      requestId,
      errorCode: error.code,
    });
  }
}

export async function runContentShadowCompare(options: ShadowCompareOptions = {}): Promise<ShadowCompareResult> {
  const jsonRepository = options.jsonRepository || new JsonContentRepository();
  const supabaseRepository = options.supabaseRepository || new SupabaseContentRepository();
  const loggerClient = options.loggerClient === undefined ? serverServiceClient() : options.loggerClient;
  const requestedIssueDate = options.issueDate;
  let issueDate = requestedIssueDate || "latest";
  let jsonDurationMs = 0;
  let supabaseDurationMs = 0;

  try {
    const jsonStart = nowMs();
    const jsonIssue = requestedIssueDate
      ? await jsonRepository.getIssueByDate(requestedIssueDate)
      : await jsonRepository.getLatestPublishedIssue();
    jsonDurationMs = nowMs() - jsonStart;
    if (!jsonIssue) {
      const result = {
        issueDate,
        matched: false,
        differenceCount: 0,
        differencePaths: [],
        jsonDurationMs,
        supabaseDurationMs,
        errorCode: "JSON_ISSUE_MISSING",
      };
      await recordShadowCompare(result, options.requestId, loggerClient);
      return result;
    }

    issueDate = jsonIssue.issueDate;
    const supabaseStart = nowMs();
    const supabaseIssue = await supabaseRepository.getIssueByDate(issueDate);
    supabaseDurationMs = nowMs() - supabaseStart;
    if (!supabaseIssue) {
      const result = {
        issueDate,
        matched: false,
        differenceCount: 1,
        differencePaths: ["$"],
        jsonDurationMs,
        supabaseDurationMs,
        errorCode: "SUPABASE_ISSUE_MISSING",
      };
      await recordShadowCompare(result, options.requestId, loggerClient);
      return result;
    }

    const differences = compareIssueParity(issueDate, jsonIssue, supabaseIssue);
    const differencePaths = sanitizeDifferencePaths(differences.map((difference) => difference.path));
    const result = {
      issueDate,
      matched: differencePaths.length === 0,
      differenceCount: differences.length,
      differencePaths,
      jsonDurationMs,
      supabaseDurationMs,
      ...(differencePaths.length > 0 ? { errorCode: "CONTENT_PARITY_MISMATCH" } : {}),
    };
    await recordShadowCompare(result, options.requestId, loggerClient);
    return result;
  } catch (error) {
    const result = {
      issueDate,
      matched: false,
      differenceCount: 0,
      differencePaths: [],
      jsonDurationMs,
      supabaseDurationMs,
      errorCode: error instanceof Error && error.message.startsWith("Supabase")
        ? "SUPABASE_READ_FAILED"
        : "SHADOW_COMPARE_FAILED",
    };
    await recordShadowCompare(result, options.requestId, loggerClient);
    console.error("content shadow compare failed", {
      issueDate,
      requestId: options.requestId,
      errorCode: result.errorCode,
    });
    return result;
  }
}
