import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import bundledCurrentIssue from "@/data/current-issue.json";
import { resolvePosterName } from "@/lib/posters/assets";
import { parseIssue, type Issue } from "@xiazi/contracts";
import { assertAssetBatchId, assertImmutableAssetUrl } from "@xiazi/domain";

import { cachedFetchInit, CONTENT_REVALIDATE_SECONDS } from "../../lib/cache/public-cache";
import { githubRepo } from "../../lib/github/repo";

type GithubFile = { type: string; name: string };

export type CurrentReleasePoster = {
  topicId: string;
  locale: "zh" | "en";
  url: string;
  contentHash: string;
};

export type CurrentReleaseManifest = {
  schemaVersion: "xiazi-current-release-v1";
  issueDate: string;
  releaseId: string;
  assetBatchId: string;
  posters: CurrentReleasePoster[];
};

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
  if (process.env.XIAZI_JSON_SOURCE) return process.env.XIAZI_JSON_SOURCE !== "github";
  return process.env.NODE_ENV !== "production";
}

function currentReleaseManifestEnabled() {
  return process.env.XIAZI_CURRENT_RELEASE_MANIFEST_ENABLED === "true";
}

function allowedReleaseAssetOrigins() {
  const values = [
    ...(process.env.RELEASE_ASSET_ORIGINS || "").split(","),
    process.env.NEXT_PUBLIC_COS_BASE_URL || "",
  ].map((value) => value.trim()).filter(Boolean);
  return new Set(values.map((value) => new URL(value).origin));
}

function parseCurrentReleaseManifest(value: unknown, issue: Issue): CurrentReleaseManifest {
  if (!value || typeof value !== "object") throw new Error("CURRENT_RELEASE_MANIFEST_INVALID");
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== "xiazi-current-release-v1"
    || candidate.issueDate !== issue.issueDate
    || typeof candidate.releaseId !== "string"
    || !/^rel_\d{8}_[0-9a-f]{24}$/.test(candidate.releaseId)
    || typeof candidate.assetBatchId !== "string"
    || !Array.isArray(candidate.posters)
    || candidate.posters.length !== 18) {
    throw new Error("CURRENT_RELEASE_MANIFEST_INVALID");
  }
  const assetBatchId = assertAssetBatchId(candidate.assetBatchId);
  const allowedOrigins = allowedReleaseAssetOrigins();
  if (allowedOrigins.size === 0) throw new Error("CURRENT_RELEASE_ASSET_ORIGIN_MISSING");
  const expected = new Set(issue.topics.flatMap((topic) => (["zh", "en"] as const)
    .map((locale) => `${topic.id}:${locale}`)));
  const actual = new Set<string>();
  const posters = candidate.posters.map((value) => {
    if (!value || typeof value !== "object") throw new Error("CURRENT_RELEASE_POSTER_INVALID");
    const poster = value as Record<string, unknown>;
    if (typeof poster.topicId !== "string"
      || (poster.locale !== "zh" && poster.locale !== "en")
      || typeof poster.url !== "string"
      || typeof poster.contentHash !== "string"
      || !/^[0-9a-f]{64}$/.test(poster.contentHash)) {
      throw new Error("CURRENT_RELEASE_POSTER_INVALID");
    }
    const slot = `${poster.topicId}:${poster.locale}`;
    const topic = issue.topics.find((item) => item.id === poster.topicId);
    if (!topic || !expected.has(slot) || actual.has(slot)) throw new Error("CURRENT_RELEASE_POSTER_SLOT_INVALID");
    actual.add(slot);
    const parsed = assertImmutableAssetUrl(poster.url, assetBatchId, allowedOrigins);
    if (parsed.locale !== poster.locale || parsed.topicOrSlot !== resolvePosterName(topic.slug)) {
      throw new Error("CURRENT_RELEASE_POSTER_PATH_INVALID");
    }
    return {
      topicId: poster.topicId,
      locale: poster.locale,
      url: poster.url,
      contentHash: poster.contentHash,
    } satisfies CurrentReleasePoster;
  });
  if ([...expected].some((slot) => !actual.has(slot))) throw new Error("CURRENT_RELEASE_MANIFEST_INCOMPLETE");
  return {
    schemaVersion: "xiazi-current-release-v1",
    issueDate: issue.issueDate,
    releaseId: candidate.releaseId,
    assetBatchId,
    posters,
  };
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

function bundledIssue(): LoadedProductionIssue {
  return { issue: parseIssue(bundledCurrentIssue), source: "local" };
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
  if (remote) {
    try {
      return { issue: parseIssue(remote), source: "github" };
    } catch {
      // Fall through to the packaged JSON when GitHub returns an invalid payload.
    }
  }

  const local = await localIssue("current-issue.json");
  if (local) return local;

  return bundledIssue();
}

export async function loadCurrentProductionReleaseManifest(issue: Issue): Promise<CurrentReleaseManifest | null> {
  if (!currentReleaseManifestEnabled()) return null;
  if (prefersLocalJson()) {
    for (const root of productionDataRoots()) {
      try {
        return parseCurrentReleaseManifest(
          JSON.parse(await readFile(path.join(root, "current-release.json"), "utf8")),
          issue,
        );
      } catch {
        // Try the remote production manifest next.
      }
    }
  }
  const remote = await githubJson(
    "contents/data/current-release.json",
    "application/vnd.github.raw+json",
  ).catch(() => null);
  if (!remote) return null;
  return parseCurrentReleaseManifest(remote, issue);
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
  if (remote) {
    try {
      return { issue: parseIssue(remote), source: "github" };
    } catch {
      // Fall through to packaged data when the remote payload is invalid.
    }
  }
  const local = await localIssue(path.join("archive", `${date}.json`));
  if (local) return local;
  const bundled = bundledIssue();
  return bundled.issue.issueDate === date ? bundled : null;
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
  const bundledDate = bundledIssue().issue.issueDate;
  const dates = Array.from(new Set([...remoteDates, ...localDates, bundledDate])).sort((a, b) => b.localeCompare(a));
  return dates.map((date) => ({
    issueDate: date,
    slug: date,
    status: "published",
    source: remoteDates.includes(date) ? "github" : "local",
  }));
}
