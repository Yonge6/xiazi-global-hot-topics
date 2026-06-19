import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseIssue, type Issue } from "@xiazi/contracts";

import type { ContentRepository, IssueSummary } from "./content-repository";
import { githubRepo } from "../../lib/github/repo";

type GithubFile = { type: string; name: string };

const repo = githubRepo;

async function github(pathname: string, accept = "application/vnd.github+json") {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${repo}/${pathname}`, {
    cache: "no-store",
    headers: {
      Accept: accept,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("GitHub content unavailable");
  }
  return response.json();
}

async function localIssue(filePath: string) {
  try {
    return parseIssue(JSON.parse(await readFile(filePath, "utf8")));
  } catch {
    return null;
  }
}

async function localArchiveDates(dataRoot: string) {
  try {
    const files = await readdir(path.join(dataRoot, "archive"));
    return files
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .map((file) => file.replace(".json", ""));
  } catch {
    return [];
  }
}

export class JsonContentRepository implements ContentRepository {
  constructor(private readonly dataRoot = defaultDataRoot()) {}

  async getLatestPublishedIssue(): Promise<Issue> {
    const remote = await github(
      "contents/data/current-issue.json",
      "application/vnd.github.raw+json",
    ).catch(() => null);
    if (remote) return parseIssue(remote);

    const local = await localIssue(path.join(this.dataRoot, "current-issue.json"));
    if (local) return local;

    throw new Error("Current issue unavailable");
  }

  async getIssueByDate(date: string): Promise<Issue | null> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const remote = await github(
      `contents/data/archive/${date}.json`,
      "application/vnd.github.raw+json",
    ).catch(() => null);
    if (remote) return parseIssue(remote);
    return localIssue(path.join(this.dataRoot, "archive", `${date}.json`));
  }

  async listPublishedIssues(): Promise<IssueSummary[]> {
    const files = await github("contents/data/archive").catch(() => null);
    const remoteDates = Array.isArray(files)
      ? (files as GithubFile[])
          .filter((file) => file.type === "file" && /^\d{4}-\d{2}-\d{2}\.json$/.test(file.name))
          .map((file) => file.name.replace(".json", ""))
      : [];
    const dates = Array.from(new Set([...remoteDates, ...await localArchiveDates(this.dataRoot)]))
      .sort((a, b) => b.localeCompare(a));

    return dates.map((date) => ({
      issueDate: date,
      slug: date,
      status: "published",
      source: remoteDates.includes(date) ? "github" : "local",
    }));
  }
}

function defaultDataRoot() {
  const appDataRoot = path.join(process.cwd(), "apps/web/data");
  if (existsSync(appDataRoot)) return appDataRoot;
  return path.join(process.cwd(), "data");
}
