import { describe, expect, it } from "vitest";

import { canonicalIssueBundle } from "@/server/publishing/canonical-issue";
import { stagingRehearsalIssue } from "@/server/releases/staging-rehearsal-fixture";

describe("isolated staging rehearsal issue", () => {
  it("satisfies the nine-slot canonical contract without using production URLs", () => {
    const issue = stagingRehearsalIssue({
      issueDate: "2026-07-21",
      sourceOrigin: "https://xiazi-release-v2-web-staging.vercel.app",
    });
    const bundle = canonicalIssueBundle(issue);
    expect(bundle.issue.slug).toBe("2026-07-21");
    expect(bundle.issue.topics).toHaveLength(9);
    expect(bundle.issue.topics[1].slug).toContain("world-cup");
    expect(bundle.issue.topics.flatMap((topic) => topic.sources).every((source) =>
      source.url.startsWith("https://xiazi-release-v2-web-staging.vercel.app/")
      && !source.url.includes("pluto.hk")
      && !source.url.includes("xiazishuo.com"))).toBe(true);
  });
});
