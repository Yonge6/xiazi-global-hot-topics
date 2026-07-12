import { describe, expect, it } from "vitest";

import type { Topic } from "@xiazi/contracts";
import { sortTopicsForIssue, topicShareDetails } from "../src";

function topic(slug: string, rank: number, category: Topic["category"] = "international"): Topic {
  const baseText = slug.replaceAll("-", " ");
  return {
    id: slug,
    issueId: "issue",
    slug,
    rank,
    category,
    region: "global",
    countryCodes: [],
    eventTime: null,
    isDeveloping: false,
    verificationStatus: "verified",
    scoreTotal: 1,
    localizations: {
      "zh-CN": {
        categoryLabel: "国际",
        headlineFact: `${baseText} 中文事实`,
        headlineView: `${baseText} 中文观点`,
        headlineFull: `${baseText} 中文事实；${baseText} 中文观点`,
        intro: "这是一段用于测试分享文案的中文简介，长度足够覆盖校验和拼接。",
        xiaziQuote: "虾子曰",
        doudouQuote: "豆豆龙说",
        footerTakeaway: "记住它",
      },
      "en-US": {
        categoryLabel: "World",
        headlineFact: `${baseText} fact`,
        headlineView: `${baseText} view`,
        headlineFull: `${baseText} fact; ${baseText} view`,
        intro: "This introduction is long enough to test share text construction and URL generation.",
        xiaziQuote: "Xiazi says",
        doudouQuote: "Doudoulong says",
        footerTakeaway: "Remember it",
      },
    },
    sources: [],
  };
}

describe("sortTopicsForIssue", () => {
  it("sorts topics by their fixed issue rank", () => {
    const ordered = sortTopicsForIssue([
      topic("rank-one", 1),
      topic("world-cup-2026-update", 7, "sports"),
      topic("rank-two", 2),
    ]);

    expect(ordered.map((item) => item.slug)).toEqual([
      "rank-one",
      "rank-two",
      "world-cup-2026-update",
    ]);
  });
});

describe("topicShareDetails", () => {
  it("builds a locale-specific canonical share payload", () => {
    const details = topicShareDetails(topic("sample-story", 1), "en", "https://xiazishuo.com/");

    expect(details.url).toBe("https://xiazishuo.com/en/#sample-story");
    expect(details.text).toContain(details.title);
    expect(details.text).toContain(details.url);
  });
});
