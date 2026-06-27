import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseIssue, type Issue } from "@xiazi/contracts";

import { cachedFetchInit, CONTENT_REVALIDATE_SECONDS } from "../../lib/cache/public-cache";
import { githubRepo } from "../../lib/github/repo";

type GithubFile = { type: string; name: string };

export type ProductionIssueSource = "github" | "local";

export type LoadedProductionIssue = {
  issue: Issue;
  source: ProductionIssueSource;
};

export type ArchiveIssueSummary = {
  issueDate: string;
  slug: string;
  status: "published";
  source: ProductionIssueSource;
};

async function githubJson(apiPath: string, accept = "application/vnd.github+json") {
  const token = process.env.GITHUB_STUDIO_TOKEN;
  const response = await fetch(
    `https://api.github.com/repos/${githubRepo}/${apiPath}`,
    cachedFetchInit(CONTENT_REVALIDATE_SECONDS, {
      headers: {
        Accept: accept,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }),
  );
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("GitHub content unavailable");
  }
  return response.json();
}

function dataRootCandidates() {
  const cwd = process.cwd();
  return [
    path.join(cwd, "data"),
    path.join(cwd, "apps/web/data"),
  ];
}

function prefersLocalJson() {
  return process.env.XIAZI_JSON_SOURCE !== "github";
}

export function productionDataRoots() {
  const roots = dataRootCandidates().filter((candidate) => existsSync(candidate));
  return roots.length > 0 ? roots : [path.join(process.cwd(), "data")];
}

async function localIssue(relativePath: string): Promise<LoadedProductionIssue | null> {
  for (const root of productionDataRoots()) {
    try {
      const issue = parseIssue(JSON.parse(await readFile(path.join(root, relativePath), "utf8")));
      return { issue, source: "local" };
    } catch {
      // Try the next candidate root.
    }
  }
  return null;
}

async function localArchiveDates() {
  const dates = new Set<string>();
  for (const root of productionDataRoots()) {
    try {
      const files = await readdir(path.join(root, "archive"));
      for (const file of files) {
        if (/^\d{4}-\d{2}-\d{2}\.json$/.test(file)) dates.add(file.replace(".json", ""));
      }
    } catch {
      // Try the next candidate root.
    }
  }
  return Array.from(dates);
}

export async function loadLatestProductionIssue(): Promise<LoadedProductionIssue> {
  if (prefersLocalJson()) {
    const local = await localIssue("current-issue.json");
    if (local) return local;
  }

  const remote = await githubJson(
    "contents/data/current-issue.json",
    "application/vnd.github.raw+json",
  ).catch(() => null);
  if (remote) return { issue: parseIssue(remote), source: "github" };

  const local = await localIssue("current-issue.json");
  if (local) return local;

  throw new Error("Current issue unavailable");
}

export async function loadProductionIssueByDate(date: string): Promise<LoadedProductionIssue | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (prefersLocalJson()) {
    const local = await localIssue(path.join("archive", `${date}.json`));
    if (local) return local;
  }

  const remote = await githubJson(
    `contents/data/archive/${date}.json`,
    "application/vnd.github.raw+json",
  ).catch(() => null);
  if (remote) return { issue: parseIssue(remote), source: "github" };
  return localIssue(path.join("archive", `${date}.json`));
}

export async function loadProductionIssueAtRef(relativePath: string, ref: string) {
  const remote = await githubJson(
    `contents/${relativePath}?ref=${encodeURIComponent(ref)}`,
    "application/vnd.github.raw+json",
  );
  return remote ? parseIssue(remote) : null;
}

export async function listProductionArchiveIssues(): Promise<ArchiveIssueSummary[]> {
  if (prefersLocalJson()) {
    const localDates = await localArchiveDates();
    return localDates
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        issueDate: date,
        slug: date,
        status: "published",
        source: "local",
      }));
  }

  const files = await githubJson("contents/data/archive").catch(() => null);
  const remoteDates = Array.isArray(files)
    ? (files as GithubFile[])
        .filter((file) => file.type === "file" && /^\d{4}-\d{2}-\d{2}\.json$/.test(file.name))
        .map((file) => file.name.replace(".json", ""))
    : [];
  const localDates = await localArchiveDates();
  const dates = Array.from(new Set([...remoteDates, ...localDates])).sort((a, b) => b.localeCompare(a));
  return dates.map((date) => ({
    issueDate: date,
    slug: date,
    status: "published",
    source: remoteDates.includes(date) ? "github" : "local",
  }));
}
