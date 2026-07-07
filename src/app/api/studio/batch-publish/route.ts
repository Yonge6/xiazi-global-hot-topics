import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { githubRepo } from "@/lib/github/repo";
import { buildIssueFromBatch } from "@/lib/studio/batch-publish";
import { studioCookieName, validStudioSession } from "@/lib/studio/auth";
import type { Issue } from "@/types/content";

const repo = githubRepo;
const currentPaths = [
  "data/current-issue.json",
  "src/data/current-issue.json",
  "public/data/current-issue.json",
];

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64");
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

async function raw(path: string) {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) throw new Error("服务器尚未配置发布权限");
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) return "";
  if (!response.ok) throw new Error("GitHub 文件读取失败");
  return response.text();
}

async function currentSha(path: string) {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) return undefined;
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) return undefined;
  const detail = await response.json().catch(() => null);
  if (!response.ok) throw new Error(detail?.message || "GitHub 发布失败");
  return detail.sha as string;
}

async function writeText(path: string, content: string, message: string) {
  const sha = await currentSha(path);
  await github(path, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: encode(content),
      ...(sha ? { sha } : {}),
    }),
  });
}

function archiveIndexContent(existing: string, issueDate: string) {
  let issues: string[] = [];
  try {
    const parsed = JSON.parse(existing || "{}") as { issues?: string[] };
    issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  } catch {
    issues = [];
  }
  return `${JSON.stringify({ issues: Array.from(new Set([issueDate, ...issues])).sort((a, b) => b.localeCompare(a)) }, null, 2)}\n`;
}

function vercelIgnoreContent(existing: string, issue: Issue) {
  const names = issue.topics.map((topic) => topic.slug);
  const additions = [
    `!public/archive/${issue.issueDate}/`,
    `!public/archive/${issue.issueDate}/**`,
    ...names.flatMap((name) => [
      `!public/posters/zh/${name}.png`,
      `!public/posters/en/${name}.png`,
      `!public/posters/thumb/zh/${name}.webp`,
      `!public/posters/thumb/en/${name}.webp`,
    ]),
  ];
  const lines = existing.split("\n");
  const known = new Set(lines);
  for (const line of additions) {
    if (!known.has(line)) lines.push(line);
  }
  return `${lines.join("\n").replace(/\n+$/g, "")}\n`;
}

async function triggerDeploy() {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) return "未配置 VERCEL_DEPLOY_HOOK_URL，已完成 GitHub 发布";
  const response = await fetch(hook, { method: "POST" });
  if (!response.ok) return "Vercel deploy hook 调用失败，请稍后检查生产站";
  return "";
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!validStudioSession(cookieStore.get(studioCookieName)?.value)) {
    return NextResponse.json({ message: "登录已过期，请重新进入后台" }, { status: 401 });
  }

  try {
    const payload = await request.json() as {
      mode?: "preview" | "publish";
      issueDate?: string;
      copy?: string;
      styleZhName?: string;
      baseIssue?: Issue;
      issue?: Issue;
    };

    if (payload.mode === "preview") {
      if (!payload.issueDate || !payload.copy || !payload.baseIssue) {
        return NextResponse.json({ message: "缺少日期、文案或当前刊期模板" }, { status: 400 });
      }
      const issue = buildIssueFromBatch(payload.baseIssue, payload.issueDate, payload.copy, payload.styleZhName);
      return NextResponse.json({
        issue,
        slots: issue.topics.map((topic) => ({
          rank: topic.rank,
          slug: topic.slug,
          zhTitle: topic.localizations["zh-CN"].headlineFact,
          enTitle: topic.localizations["en-US"].headlineFact,
        })),
      });
    }

    const issue = payload.issue;
    if (!issue || !/^\d{4}-\d{2}-\d{2}$/.test(issue.issueDate) || issue.topics.length !== 9) {
      return NextResponse.json({ message: "刊期数据无效" }, { status: 400 });
    }

    const body = `${JSON.stringify(issue, null, 2)}\n`;
    const archivePaths = [
      `data/archive/${issue.issueDate}.json`,
      `src/data/archive/${issue.issueDate}.json`,
      `public/data/archive/${issue.issueDate}.json`,
    ];
    await Promise.all([
      ...currentPaths.map((path) => writeText(path, body, `Mobile batch publish ${issue.issueDate}`)),
      ...archivePaths.map((path) => writeText(path, body, `Archive issue ${issue.issueDate}`)),
    ]);

    const archiveIndex = archiveIndexContent(await raw("public/data/archive/index.json").catch(() => ""), issue.issueDate);
    const vercelIgnore = vercelIgnoreContent(await raw(".vercelignore").catch(() => ""), issue);
    await Promise.all([
      writeText("public/data/archive/index.json", archiveIndex, `Update archive index ${issue.issueDate}`),
      writeText(".vercelignore", vercelIgnore, `Allow deploy assets ${issue.issueDate}`),
    ]);

    const deployWarning = await triggerDeploy();
    return NextResponse.json({
      issue,
      target: { source: "current", value: "current" },
      warning: deployWarning,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "批量发布失败" },
      { status: 500 },
    );
  }
}
