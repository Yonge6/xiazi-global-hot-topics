import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseIssue, type Issue } from "@xiazi/contracts";

export type IssueFile = {
  path: string;
  role: "archive" | "current";
  issue: Issue;
  checksum: string;
  warnings: string[];
};

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentChecksum(issue: Issue): string {
  return createHash("sha256").update(stableJson(issue)).digest("hex");
}

function assertSameInstant(issue: Issue) {
  const beijing = new Date(issue.beijingTimestamp).getTime();
  const gmt = new Date(issue.gmtTimestamp).getTime();
  if (!Number.isFinite(beijing) || !Number.isFinite(gmt) || beijing !== gmt) {
    throw new Error(`${issue.issueDate}: beijingTimestamp and gmtTimestamp must represent the same instant`);
  }
}

export function validateIssueForImport(value: unknown): { issue: Issue; warnings: string[] } {
  const issue = parseIssue(value);
  const warnings: string[] = [];
  if (issue.topics.length !== 9) throw new Error(`${issue.issueDate}: expected exactly 9 topics`);
  if (issue.slug !== issue.issueDate) throw new Error(`${issue.issueDate}: issue slug must match issueDate`);

  const ranks = issue.topics.map((topic) => topic.rank).sort((a, b) => a - b);
  if (ranks.join(",") !== "1,2,3,4,5,6,7,8,9") {
    throw new Error(`${issue.issueDate}: ranks must be exactly 1-9`);
  }

  const slugs = new Set<string>();
  const topicIds = new Set<string>();
  for (const topic of issue.topics) {
    if (slugs.has(topic.slug)) throw new Error(`${issue.issueDate}: duplicate topic slug ${topic.slug}`);
    slugs.add(topic.slug);
    topicIds.add(topic.id);
    if (!topic.localizations["zh-CN"] || !topic.localizations["en-US"]) {
      throw new Error(`${issue.issueDate}/${topic.slug}: both zh-CN and en-US are required`);
    }
    if (topic.sources.length < 1) throw new Error(`${issue.issueDate}/${topic.slug}: at least one source is required`);
    for (const source of topic.sources) {
      const url = new URL(source.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`${issue.issueDate}/${topic.slug}: invalid source URL ${source.url}`);
      }
    }
  }

  if (!topicIds.has(issue.featuredTopicId)) {
    throw new Error(`${issue.issueDate}: featuredTopicId must belong to this issue`);
  }
  const worldCup = issue.topics.filter((topic) => topic.category === "sports" && topic.slug.includes("world-cup"));
  if (worldCup.length > 0 && !worldCup.some((topic) => topic.rank === 1)) {
    throw new Error(`${issue.issueDate}: World Cup topic must rank first`);
  }
  if (worldCup.length === 0) warnings.push(`${issue.issueDate}: no World Cup topic found`);
  assertSameInstant(issue);

  return { issue, warnings };
}

async function readIssueFile(filePath: string, role: IssueFile["role"]): Promise<IssueFile> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  const { issue, warnings } = validateIssueForImport(raw);
  return { path: filePath, role, issue, checksum: contentChecksum(issue), warnings };
}

export async function loadContentIssueFiles(root = process.cwd()): Promise<IssueFile[]> {
  const dataRoot = path.join(root, "apps/web/data");
  const archiveRoot = path.join(dataRoot, "archive");
  const archiveFiles = (await readdir(archiveRoot))
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort();
  const archives = await Promise.all(
    archiveFiles.map((file) => readIssueFile(path.join(archiveRoot, file), "archive")),
  );
  const current = await readIssueFile(path.join(dataRoot, "current-issue.json"), "current");
  return [...archives, current];
}

export function uniqueIssueStats(files: IssueFile[]) {
  const issues = new Map<string, Issue>();
  for (const file of files) issues.set(file.issue.issueDate, file.issue);
  const topics = [...issues.values()].reduce((sum, issue) => sum + issue.topics.length, 0);
  const localizations = [...issues.values()].reduce((sum, issue) => sum + issue.topics.length * 2, 0);
  const sources = [...issues.values()].reduce(
    (sum, issue) => sum + issue.topics.reduce((topicSum, topic) => topicSum + topic.sources.length, 0),
    0,
  );
  return { issues: issues.size, topics, localizations, sources };
}
