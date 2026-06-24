import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { Issue } from "@xiazi/contracts";

import {
  contentChecksum,
  validateIssueForImport,
} from "../../apps/web/src/server/content-sync/issue-bundle";
import { stableJson } from "../../apps/web/src/server/shadow/content-parity";

export { stableJson };
export { contentChecksum, validateIssueForImport };

export type IssueFile = {
  path: string;
  role: "archive" | "current";
  issue: Issue;
  checksum: string;
  warnings: string[];
};

async function readIssueFile(filePath: string, role: IssueFile["role"]): Promise<IssueFile> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  const { issue, warnings } = validateIssueForImport(raw);
  return { path: filePath, role, issue, checksum: contentChecksum(issue), warnings };
}

async function firstExistingDataRoot(root: string) {
  const candidates = [
    path.join(root, "data"),
    path.join(root, "apps/web/data"),
  ];
  for (const candidate of candidates) {
    try {
      await readdir(path.join(candidate, "archive"));
      return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return candidates[0];
}

export async function loadContentIssueFiles(root = process.cwd()): Promise<IssueFile[]> {
  const dataRoot = await firstExistingDataRoot(root);
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
