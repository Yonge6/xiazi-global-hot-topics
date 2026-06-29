import { NextResponse } from "next/server";

import { getContentRepository } from "@/server/repositories/get-content-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const issue = await getContentRepository().getLatestPublishedIssue();

    return NextResponse.json({
      ...issue,
      assetVersion: issue.assetVersion || issue.beijingTimestamp || issue.issueDate,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Source": process.env.CONTENT_REPOSITORY === "supabase" ? "supabase" : "json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Current issue unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  }
}
