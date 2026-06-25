import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { githubRepo } from "@/lib/github/repo";
import {
  listProductionArchiveIssues,
  loadLatestProductionIssue,
  loadProductionIssueAtRef,
  loadProductionIssueByDate,
} from "@/server/json/production-json-source";
import { studioCookieName, validStudioSession } from "@/lib/studio/auth";

const repo = githubRepo;

async function github(path: string, accept = "application/vnd.github+json") {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) throw new Error("服务器尚未配置发布权限");
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    cache: "no-store",
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("无法读取往期内容");
  }
  return response.json();
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const source = url.searchParams.get("source");
    const value = url.searchParams.get("value");
    if (source === "current") {
      const issue = await loadLatestProductionIssue().then((result) => result.issue).catch(() => null);
      return NextResponse.json({ issue, source: "current" });
    }
    if (source === "archive" && value) {
      const issue = await loadProductionIssueByDate(value).then((result) => result?.issue ?? null);
      return NextResponse.json({ issue, source: "archive" });
    }
    if (source === "commit" && value) {
      return NextResponse.json({
        issue: await loadProductionIssueAtRef("data/current-issue.json", value),
        source: "commit",
      });
    }

    const current = await loadLatestProductionIssue().then((result) => result.issue).catch(() => null);
    const archives = await listProductionArchiveIssues()
      .then((issues) => issues.map((issue) => ({ date: issue.issueDate, source: "archive", value: issue.issueDate })))
      .catch(() => []);
    const commits = await github("commits?path=data/current-issue.json&per_page=50").catch(() => []);
    const knownDates = new Set(archives.map((item) => item.date));
    if (current) knownDates.add(current.issueDate);
    const legacy = [];
    for (const commit of Array.isArray(commits) ? commits : []) {
      const match = String(commit.commit?.message || "").match(/\d{4}-\d{2}-\d{2}/);
      if (!match || knownDates.has(match[0])) continue;
      knownDates.add(match[0]);
      legacy.push({ date: match[0], source: "commit", value: commit.sha });
    }
    const issues = [
      ...(current ? [{ date: current.issueDate, source: "current", value: "current" }] : []),
      ...archives,
      ...legacy,
    ].sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json({ issues });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "无法读取往期内容" },
      { status: 500 },
    );
  }
}
