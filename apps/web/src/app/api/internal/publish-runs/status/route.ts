import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseServiceClientFromEnv } from "@/server/content-sync/supabase-service-client";

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
    process.env.PUBLISH_RUN_STATUS_SECRET,
    process.env.SHADOW_COMPARE_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value));
  return Boolean(bearerToken && allowedSecrets.some((secret) => safeEquals(bearerToken, secret)));
}

function shortSha(value: unknown) {
  return typeof value === "string" && value ? value.slice(0, 12) : null;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseServiceClientFromEnv();
  if (!client) {
    return NextResponse.json({ ok: false, message: "Supabase service client unavailable" }, { status: 500 });
  }

  const limitParam = Number(new URL(request.url).searchParams.get("limit") || 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 25) : 10;
  const { data, error } = await client
    .from("studio_publish_runs")
    .select(`
      publish_request_id,
      issue_date,
      trigger_type,
      primary_status,
      primary_commit_sha,
      shadow_status,
      shadow_changed,
      compare_status,
      difference_count,
      retry_count,
      error_stage,
      error_code,
      started_at,
      finished_at,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, message: "Publish runs unavailable" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    runs: (data || []).map((row) => ({
      publishRequestId: row.publish_request_id,
      issueDate: row.issue_date,
      triggerType: row.trigger_type,
      primaryStatus: row.primary_status,
      primaryCommitSha: shortSha(row.primary_commit_sha),
      shadowStatus: row.shadow_status,
      shadowChanged: row.shadow_changed,
      compareStatus: row.compare_status,
      differenceCount: row.difference_count,
      retryCount: row.retry_count,
      errorStage: row.error_stage,
      errorCode: row.error_code,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      createdAt: row.created_at,
    })),
  }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
