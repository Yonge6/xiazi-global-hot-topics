import { NextResponse } from "next/server";

import { getContentRepository } from "@/server/repositories/get-content-repository";

const NO_STORE = "no-store, no-cache, must-revalidate";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    const repository = getContentRepository();
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ message: "Invalid archive date" }, { status: 400 });
      }
      const repositoryIssue = await repository.getIssueByDate(date).catch(() => null);
      if (repositoryIssue) {
        return NextResponse.json({
          issue: repositoryIssue,
          assetVersion: repositoryIssue.assetVersion || repositoryIssue.beijingTimestamp || date,
          source: process.env.CONTENT_REPOSITORY === "supabase" ? "supabase" : "repository",
        }, {
          headers: { "Cache-Control": NO_STORE },
        });
      }
      return NextResponse.json({ message: "Archive not found" }, { status: 404 });
    }

    const repositoryIssues = await repository.listPublishedIssues().catch(() => []);
    if (repositoryIssues.length > 0) {
      return NextResponse.json({
        issues: repositoryIssues.map((issue) => issue.issueDate),
        source: process.env.CONTENT_REPOSITORY === "supabase" ? "supabase" : "repository",
      }, {
        headers: { "Cache-Control": NO_STORE },
      });
    }
    return NextResponse.json({ issues: [] }, { headers: { "Cache-Control": NO_STORE } });
  } catch {
    return NextResponse.json({ message: "Archive unavailable" }, { status: 500 });
  }
}
