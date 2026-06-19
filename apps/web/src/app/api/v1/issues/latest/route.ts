import { NextResponse } from "next/server";

import { getContentRepository } from "@/server/repositories/get-content-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const issue = await getContentRepository().getLatestPublishedIssue();
    return NextResponse.json({ issue });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Issue unavailable" },
      { status: 500 },
    );
  }
}
