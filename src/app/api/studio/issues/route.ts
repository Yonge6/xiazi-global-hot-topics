import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { studioCookieName, validStudioSession } from "@/lib/studio/auth";
import type { Issue } from "@/types/content";

const repo = "Yonge6/vilesaint";
const dataRoot = path.join(process.cwd(), "data");

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

async function rawFile(path: string, ref?: string) {
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return github(`contents/${path}${suffix}`, "application/vnd.github.raw+json") as Promise<Issue | null>;
}

async function localCurrentIssue() {
  try {
    return JSON.parse(await readFile(path.join(dataRoot, "current-issue.json"), "utf8")) as Issue;
  } catch {
    return null;
  }
}

async function localArchiveIssue(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  try {
    return JSON.parse(await readFile(path.join(dataRoot, "archive", `${date}.json`), "utf8")) as Issue;
  } catch {
    return null;
  }
}

async function localArchiveEntries() {
  try {
    const files = await readdir(path.join(dataRoot, "archive"));
    return files
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .map((file) => ({ date: file.replace(".json", ""), source: "archive" as const, value: file.replace(".json", "") }));
  } catch {
    return [];
  }
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
      const issue = await rawFile("data/current-issue.json").catch(() => localCurrentIssue());
      return NextResponse.json({ issue, source: "current" });
    }
    if (source === "archive" && value) {
      const filePath = `data/archive/${value}.json`;
      const issue = await rawFile(filePath).catch(() => localArchiveIssue(value));
      return NextResponse.json({ issue, source: "archive" });
    }
    if (source === "commit" && value) {
      return NextResponse.json({ issue: await rawFile("data/current-issue.json", value), source: "commit" });
    }

    const current = await rawFile("data/current-issue.json").catch(() => localCurrentIssue());
    const archiveFiles = await github("contents/data/archive").catch(() => null);
    const archives = Array.isArray(archiveFiles)
      ? archiveFiles
          .filter((file) => file.type === "file" && /^\d{4}-\d{2}-\d{2}\.json$/.test(file.name))
          .map((file) => ({ date: file.name.replace(".json", ""), source: "archive", value: file.name.replace(".json", "") }))
      : await localArchiveEntries();
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
