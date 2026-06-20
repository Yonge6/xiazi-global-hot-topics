import { NextResponse } from "next/server";

import { CONTENT_CACHE_CONTROL } from "@/lib/cache/public-cache";
import { getContentRepository } from "@/server/repositories/get-content-repository";

export const revalidate = 60;

export async function GET() {
  try {
    const issue = await getContentRepository().getLatestPublishedIssue();
    return NextResponse.json({ issue }, { headers: { "Cache-Control": CONTENT_CACHE_CONTROL } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Issue unavailable" },
      { status: 500 },
    );
  }
}
