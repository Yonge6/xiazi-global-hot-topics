import { NextResponse } from "next/server";

import { CONTENT_CACHE_CONTROL } from "@/lib/cache/public-cache";
import { getContentRepository } from "@/server/repositories/get-content-repository";

export const revalidate = 60;

export async function GET(_request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ message: "Invalid issue date" }, { status: 400 });
  }
  try {
    const issue = await getContentRepository().getIssueByDate(date);
    if (!issue) return NextResponse.json({ message: "Issue not found" }, { status: 404 });
    return NextResponse.json({ issue }, { headers: { "Cache-Control": CONTENT_CACHE_CONTROL } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Issue unavailable" },
      { status: 500 },
    );
  }
}
