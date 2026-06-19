import { createApiClient } from "@xiazi/api-client";
import { parseIssue, type Issue } from "@xiazi/contracts";
import { sortTopicsForIssue } from "@xiazi/domain";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function sitePath(path: string) {
  return `${basePath}${path}`;
}

const apiClient = createApiClient();

async function getJson<T>(path: string) {
  return apiClient.getJson<T>(sitePath(path));
}

export async function loadCurrentIssue() {
  const issue = await getJson<unknown>("/api/content/")
    .catch(() => getJson<unknown>("/data/current-issue.json"));
  const parsed = parseIssue(issue);
  return {
    ...parsed,
    topics: sortTopicsForIssue(parsed.topics),
  };
}

export async function loadArchiveDates() {
  return getJson<{ issues: string[] }>("/api/archive/")
    .catch(() => getJson<{ issues: string[] }>("/data/archive/index.json"));
}

export async function loadArchiveIssue(date: string) {
  const detail = await getJson<{ issue: unknown; assetVersion?: string }>(`/api/archive/?date=${encodeURIComponent(date)}`)
    .catch(async () => {
      const issue = await getJson<unknown>(`/data/archive/${date}.json`);
      const parsed = parseIssue(issue);
      return { issue: parsed, assetVersion: parsed.assetVersion };
    });
  const issue = parseIssue(detail.issue);
  return { issue: { ...issue, topics: sortTopicsForIssue(issue.topics) } satisfies Issue, assetVersion: detail.assetVersion };
}
