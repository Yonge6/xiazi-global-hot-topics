import { NextResponse } from "next/server";

import fallbackIssue from "@/data/current-issue.json";
import { githubRepo } from "@/lib/github/repo";

const contentUrl =
  `https://api.github.com/repos/${githubRepo}/contents/data/current-issue.json`;
const commitUrl = `https://api.github.com/repos/${githubRepo}/commits/main`;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = process.env.GITHUB_STUDIO_TOKEN;
    const headers = {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const [contentResponse, commitResponse] = await Promise.all([
      fetch(contentUrl, {
        cache: "no-store",
        headers: {
          ...headers,
          Accept: "application/vnd.github.raw+json",
        },
      }),
      fetch(commitUrl, {
        cache: "no-store",
        headers,
      }),
    ]);

    if (!contentResponse.ok) throw new Error("Unable to load current issue");

    const issue = await contentResponse.json();
    const commit = commitResponse.ok ? await commitResponse.json() : null;

    return NextResponse.json({
      ...issue,
      assetVersion: commit?.sha || issue.beijingTimestamp || issue.issueDate,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({
      ...fallbackIssue,
      assetVersion: fallbackIssue.beijingTimestamp || fallbackIssue.issueDate,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Fallback": "true",
      },
    });
  }
}
