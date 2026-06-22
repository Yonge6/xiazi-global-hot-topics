import { type Issue, parseIssue } from "@xiazi/contracts";

import { contentChecksum, validateIssueForImport } from "../content-sync/issue-bundle";

export type CanonicalIssueBundle = {
  issue: Issue;
  checksum: string;
  publishRequestId: string;
  executionKey: string;
};

export function canonicalIssueBundle(value: unknown): CanonicalIssueBundle {
  const parsed = parseIssue(value);
  const ranked = parseIssue({
    ...parsed,
    topics: parsed.topics.map((topic, index) => ({ ...topic, rank: index + 1 })),
  });
  const { issue } = validateIssueForImport(ranked);
  const checksum = contentChecksum(issue);
  const publishRequestId = `studio-publish:${issue.issueDate}:${checksum}`;
  return {
    issue,
    checksum,
    publishRequestId,
    executionKey: publishRequestId,
  };
}
