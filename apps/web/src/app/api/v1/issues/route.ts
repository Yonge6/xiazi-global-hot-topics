import { NextResponse } from "next/server";

import { getContentRepository } from "@/server/repositories/get-content-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const issues = await getContentRepository().listPublishedIssues();
    return NextResponse.json(
      { issues },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Issue list unavailable" },
      { status: 500 },
    );
  }
}
