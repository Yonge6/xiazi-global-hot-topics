import { describe, expect, it } from "vitest";

import { mockIssue } from "@/data/mock-issue";
import { bilingualContentSchema } from "@xiazi/contracts";

describe("mock issue", () => {
  it("contains exactly nine ranked topics", () => {
    expect(mockIssue.topics).toHaveLength(9);
    expect(mockIssue.topics.map((topic) => topic.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("contains a World Cup topic in every edition", () => {
    expect(mockIssue.topics.some((topic) => topic.slug.includes("world-cup"))).toBe(true);
  });

  it("uses a Fact/View headline separator in both locales", () => {
    for (const topic of mockIssue.topics) {
      expect(topic.localizations["zh-CN"].headlineFull).toMatch(/[；;]/);
      expect(topic.localizations["en-US"].headlineFull).toMatch(/[；;]/);
    }
  });

  it("passes the AI content boundary schema", () => {
    for (const topic of mockIssue.topics) {
      expect(() => bilingualContentSchema.parse(topic.localizations)).not.toThrow();
      expect(topic.sources.length).toBeGreaterThanOrEqual(1);
    }
  });
});
