import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { parseIssue } from "@xiazi/contracts";

function readAppFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("overview plus eight-story product rules", () => {
  const issue = parseIssue(currentIssue);
  const overviewTopics = issue.topics.filter((topic) => topic.slug === "overview");
  const newsTopics = issue.topics.filter((topic) => topic.slug !== "overview");

  it("keeps the issue contract at nine ranked content cards", () => {
    expect(issue.topics).toHaveLength(9);
    expect(issue.topics.map((topic) => topic.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("contains exactly one overview and eight non-overview news topics", () => {
    expect(overviewTopics).toHaveLength(1);
    expect(overviewTopics[0].rank).toBe(1);
    expect(newsTopics).toHaveLength(8);
    expect(newsTopics.some((topic) => topic.slug.includes("world-cup"))).toBe(true);
  });

  it("uses eight-story public copy without regressing to nine-story wording", () => {
    const masthead = readAppFile("src/components/issue-masthead.tsx");
    const about = readAppFile("src/components/about-section.tsx");
    const gallery = readAppFile("src/components/topic-gallery.tsx");
    const joined = [masthead, about, gallery].join("\n");

    expect(masthead).toContain("每天看懂世界上最重要的 8 件事");
    expect(masthead).toContain("8 Global Stories");
    expect(gallery).toContain("1 张今日总览、8 件全球热点");
    expect(gallery).toContain("1 daily overview, 8 global stories");
    const nine = String(9);
    expect(joined).not.toContain(["每天看懂 ", nine, " 件重要的事"].join(""));
    expect(joined).not.toContain(["每天看懂", nine, "件重要的事"].join(""));
    expect(joined).not.toContain(["all ", "nine ", "stories"].join(""));
    expect(joined).not.toContain(["Nine ", "important ", "stories"].join(""));
  });
});
