import { NextResponse } from "next/server";

import { parseIssue } from "@xiazi/contracts";
import fallbackIssue from "@/data/current-issue.json";
import { cachedFetchInit, CONTENT_REVALIDATE_SECONDS } from "@/lib/cache/public-cache";
import { githubRepo } from "@/lib/github/repo";

const contentUrl =
  `https://api.github.com/repos/${githubRepo}/contents/data/current-issue.json`;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const token = process.env.GITHUB_STUDIO_TOKEN;
    const headers = {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const contentResponse = await fetch(
      contentUrl,
      cachedFetchInit(CONTENT_REVALIDATE_SECONDS, {
        headers: {
          ...headers,
          Accept: "application/vnd.github.raw+json",
        },
      }),
    );

    if (!contentResponse.ok) throw new Error("Unable to load current issue");

    const issue = parseIssue(await contentResponse.json());

    return NextResponse.json({
      ...issue,
      assetVersion: issue.assetVersion || issue.beijingTimestamp || issue.issueDate,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({
      ...fallbackIssue,
      assetVersion: fallbackIssue.assetVersion || fallbackIssue.beijingTimestamp || fallbackIssue.issueDate,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Fallback": "true",
      },
    });
  }
}
