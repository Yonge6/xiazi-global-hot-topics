import { createHash } from "node:crypto";

import { parseIssue, type Issue } from "@xiazi/contracts";

import { stableJson } from "../shadow/content-parity";

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
  const overview = issue.topics.filter((topic) => topic.slug === "overview");
  if (overview.length > 1) {
    throw new Error(`${issue.issueDate}: only one overview topic is allowed`);
  }
  if (overview.length === 1 && overview[0].rank !== 1) {
    throw new Error(`${issue.issueDate}: overview topic must rank first`);
  }

  const worldCup = issue.topics.filter((topic) => topic.category === "sports" && topic.slug.includes("world-cup"));
  const expectedWorldCupRank = overview.length === 1 ? 2 : 1;
  if (worldCup.length > 0 && !worldCup.some((topic) => topic.rank === expectedWorldCupRank)) {
    throw new Error(`${issue.issueDate}: World Cup topic must be the first news topic`);
  }
  if (worldCup.length === 0) warnings.push(`${issue.issueDate}: no World Cup topic found`);
  assertSameInstant(issue);

  return { issue, warnings };
}
