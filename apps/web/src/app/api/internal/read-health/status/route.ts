import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseServiceClientFromEnv } from "@/server/content-sync/supabase-service-client";
import { JsonContentRepository } from "@/server/repositories/json-content-repository";
import { SupabaseContentRepository } from "@/server/repositories/supabase-content-repository";
import { compareIssueParity } from "@/server/shadow/content-parity";

export const dynamic = "force-dynamic";

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const allowedSecrets = [
    process.env.READ_HEALTH_STATUS_SECRET,
    process.env.PUBLISH_RUN_STATUS_SECRET,
    process.env.SHADOW_COMPARE_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value));
  return Boolean(bearerToken && allowedSecrets.some((secret) => safeEquals(bearerToken, secret)));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const limitParam = Number(new URL(request.url).searchParams.get("limit") || 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 25) : 10;
  const client = createSupabaseServiceClientFromEnv();
  const jsonRepository = new JsonContentRepository();
  const supabaseRepository = new SupabaseContentRepository();
  const [jsonLatest, supabaseLatest] = await Promise.allSettled([
    jsonRepository.getLatestPublishedIssue(),
    supabaseRepository.getLatestPublishedIssue(),
  ]);

  const jsonIssue = jsonLatest.status === "fulfilled" ? jsonLatest.value : null;
  const supabaseIssue = supabaseLatest.status === "fulfilled" ? supabaseLatest.value : null;
  const differencePaths = jsonIssue && supabaseIssue
    ? compareIssueParity(jsonIssue.issueDate, jsonIssue, supabaseIssue).map((difference) => difference.path).slice(0, 50)
    : [];

  const { data } = client
    ? await client
        .from("content_read_runs")
        .select(`
          path_type,
          issue_date,
          primary_source,
          fallback_used,
          fallback_reason,
          supabase_duration_ms,
          json_duration_ms,
          matched,
          difference_count,
          error_code,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(limit)
    : { data: [] };

  const runs = data || [];
  return NextResponse.json({
    ok: true,
    mode: {
      contentRepository: process.env.CONTENT_REPOSITORY || "json",
      supabasePrimaryReadsEnabled: process.env.SUPABASE_PRIMARY_READS_ENABLED === "true",
      jsonReadFallbackEnabled: process.env.JSON_READ_FALLBACK_ENABLED === "true",
    },
    latest: {
      json: jsonIssue?.issueDate || null,
      supabase: supabaseIssue?.issueDate || null,
      matched: Boolean(jsonIssue && supabaseIssue && differencePaths.length === 0),
      differenceCount: differencePaths.length,
      differencePaths,
    },
    readRuns: runs.map((row) => ({
      pathType: row.path_type,
      issueDate: row.issue_date,
      primarySource: row.primary_source,
      fallbackUsed: row.fallback_used,
      fallbackReason: row.fallback_reason,
      supabaseDurationMs: row.supabase_duration_ms,
      jsonDurationMs: row.json_duration_ms,
      matched: row.matched,
      differenceCount: row.difference_count,
      errorCode: row.error_code,
      createdAt: row.created_at,
    })),
    fallbackCount: runs.filter((row) => row.fallback_used).length,
  }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
