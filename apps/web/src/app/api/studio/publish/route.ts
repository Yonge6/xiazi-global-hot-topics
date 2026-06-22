import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { parseIssue, type Issue } from "@xiazi/contracts";
import { githubRepo } from "@/lib/github/repo";
import { studioCookieName, validStudioOrigin, validStudioSession } from "@/lib/studio/auth";

const repo = githubRepo;
const dataPath = "data/current-issue.json";

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

async function github(path: string, init?: RequestInit) {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) throw new Error("服务器尚未配置发布权限");

  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
  const detail = await response.json().catch(() => null);
  if (!response.ok) throw new Error(detail?.message || "GitHub 发布失败");
  return detail;
}

async function currentSha(path: string) {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) return undefined;
  const detail = await response.json();
  if (!response.ok) throw new Error(detail?.message || "GitHub 发布失败");
  return detail.sha as string;
}

async function writeIssue(path: string, issue: Issue, message: string) {
  const sha = await currentSha(path);
  await github(path, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: encode(JSON.stringify(issue, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  });
}

export async function POST(request: Request) {
  if (!validStudioOrigin(request)) {
    return NextResponse.json({ message: "请求来源无效" }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }

  try {
    const payload = await request.json() as {
      issue: Issue;
      target?: { source: "current" | "archive" | "commit"; value: string };
    };
    const issue = parseIssue(payload.issue);
    const normalized = {
      ...issue,
      topics: issue.topics.map((topic, index) => ({ ...topic, rank: index + 1 })),
    };
    parseIssue(normalized);
    const archivePath = `data/archive/${issue.issueDate}.json`;
    await writeIssue(archivePath, normalized, `Archive issue ${issue.issueDate}`);
    const updatesCurrent = !payload.target || payload.target.source === "current";
    if (updatesCurrent) {
      await writeIssue(dataPath, normalized, `Update issue ${issue.issueDate}`);
    }
    return NextResponse.json({
      issue: normalized,
      target: { source: updatesCurrent ? "current" : "archive", value: updatesCurrent ? "current" : issue.issueDate },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "发布失败" },
      { status: 500 },
    );
  }
}
