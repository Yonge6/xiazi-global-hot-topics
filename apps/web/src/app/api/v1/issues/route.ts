import { NextResponse } from "next/server";

import { CONTENT_CACHE_CONTROL } from "@/lib/cache/public-cache";
import { getContentRepository } from "@/server/repositories/get-content-repository";

export const revalidate = 60;

export async function GET() {
  try {
    const issues = await getContentRepository().listPublishedIssues();
    return NextResponse.json({ issues }, { headers: { "Cache-Control": CONTENT_CACHE_CONTROL } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Issue list unavailable" },
      { status: 500 },
    );
  }
}
