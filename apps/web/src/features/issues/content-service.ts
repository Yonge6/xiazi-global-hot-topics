import { parseIssue, type Issue } from "@xiazi/contracts";
import { sortTopicsForIssue } from "@xiazi/domain";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function sitePath(path: string) {
  return `${basePath}${path}`;
}

async function getJson<T>(path: string) {
  const response = await fetch(sitePath(path), { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${path}`);
  return response.json() as Promise<T>;
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
  return getJson<{ issues: Array<{ issueDate: string }> }>("/api/v1/issues/")
    .then((detail) => ({ issues: detail.issues.map((issue) => issue.issueDate) }))
    .catch(() => getJson<{ issues: string[] }>("/api/archive/"))
    .catch(() => getJson<{ issues: string[] }>("/data/archive/index.json"));
}

export async function loadArchiveIssue(date: string) {
  const detail = await getJson<{ issue: unknown; assetVersion?: string }>(`/api/v1/issues/${encodeURIComponent(date)}/`)
    .catch(() => getJson<{ issue: unknown; assetVersion?: string }>(`/api/archive/?date=${encodeURIComponent(date)}`))
    .catch(async () => {
      const issue = await getJson<unknown>(`/data/archive/${date}.json`);
      const parsed = parseIssue(issue);
      return { issue: parsed, assetVersion: parsed.assetVersion };
    });
  const issue = parseIssue(detail.issue);
  return { issue: { ...issue, topics: sortTopicsForIssue(issue.topics) } satisfies Issue, assetVersion: detail.assetVersion };
}
