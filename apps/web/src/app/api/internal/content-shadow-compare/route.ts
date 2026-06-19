import { randomUUID } from "node:crypto";
import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runContentShadowCompare } from "@/server/shadow/content-shadow-compare";

export const dynamic = "force-dynamic";

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function configuredSecrets() {
  return [process.env.SHADOW_COMPARE_SECRET, process.env.CRON_SECRET].filter((secret): secret is string => Boolean(secret));
}

function isAuthorized(request: Request) {
  const secrets = configuredSecrets();
  if (secrets.length === 0) return false;
  const authorization = request.headers.get("authorization");
  const shadowHeader = request.headers.get("x-shadow-compare-secret");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  return secrets.some((secret) =>
    (bearerToken ? safeEquals(bearerToken, secret) : false) ||
    (shadowHeader ? safeEquals(shadowHeader, secret) : false),
  );
}

async function issueDateFromRequest(request: Request) {
  if (request.method === "GET") {
    return new URL(request.url).searchParams.get("issueDate") || undefined;
  }
  try {
    const body = await request.json() as { issueDate?: unknown };
    return typeof body.issueDate === "string" ? body.issueDate : undefined;
  } catch {
    return undefined;
  }
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  if (process.env.SHADOW_COMPARE_ENABLED !== "true") {
    return NextResponse.json({ ok: true, enabled: false }, { status: 202 });
  }

  const requestId = request.headers.get("x-vercel-id") || randomUUID();
  const issueDate = await issueDateFromRequest(request);
  const result = await runContentShadowCompare({ issueDate, requestId });
  return NextResponse.json(
    {
      ok: result.matched,
      requestId,
      result,
    },
    { status: result.matched ? 200 : 409 },
  );
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
