import { NextResponse } from "next/server";

import { validReleaseStageRequest } from "@/server/releases/release-auth";
import { stageFuturePublication } from "@/server/releases/release-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validReleaseStageRequest(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await stageFuturePublication(await request.json());
    return NextResponse.json({ ok: true, ...result }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Release staging failed" },
      { status: 422 },
    );
  }
}
