import type { Issue } from "@xiazi/contracts";

import { githubRepo } from "@/lib/github/repo";

import { PublishError } from "./publish-errors";

const dataPath = "data/current-issue.json";

export type PublishTarget = {
  source: "current" | "archive" | "commit";
  value: string;
};

export type GitHubPrimaryPublishResult = {
  target: { source: "current" | "archive"; value: string };
  commitSha?: string;
};

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

async function github(path: string, init?: RequestInit) {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) throw new PublishError("服务器尚未配置发布权限", "GITHUB_PRIMARY_FAILED", "github");

  const response = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
  const detail = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PublishError(
      detail?.message || "GitHub 发布失败",
      response.status === 409 ? "GITHUB_CONFLICT" : "GITHUB_PRIMARY_FAILED",
      "github",
    );
  }
  return detail;
}

async function currentSha(path: string) {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  if (!token) throw new PublishError("服务器尚未配置发布权限", "GITHUB_PRIMARY_FAILED", "github");
  const response = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) return undefined;
  const detail = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PublishError(detail?.message || "GitHub 发布失败", "GITHUB_PRIMARY_FAILED", "github");
  }
  return detail.sha as string;
}

async function writeIssue(path: string, issue: Issue, message: string) {
  const sha = await currentSha(path);
  const detail = await github(path, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: encode(JSON.stringify(issue, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  });
  return detail?.commit?.sha as string | undefined;
}

export async function publishGitHubPrimary(
  issue: Issue,
  target?: PublishTarget,
): Promise<GitHubPrimaryPublishResult> {
  const archivePath = `data/archive/${issue.issueDate}.json`;
  const archiveCommitSha = await writeIssue(archivePath, issue, `Archive issue ${issue.issueDate}`);
  const updatesCurrent = !target || target.source === "current";
  if (updatesCurrent) {
    const currentCommitSha = await writeIssue(dataPath, issue, `Update issue ${issue.issueDate}`);
    return {
      target: { source: "current", value: "current" },
      commitSha: currentCommitSha || archiveCommitSha,
    };
  }
  return {
    target: { source: "archive", value: issue.issueDate },
    commitSha: archiveCommitSha,
  };
}

export async function readGitHubPrimaryIssue(issueDate: string) {
  const response = await github(`data/archive/${issueDate}.json`, {
    method: "GET",
    headers: { Accept: "application/vnd.github.raw+json" },
  });
  return response as unknown;
}
