import { describe, expect, it } from "vitest";

import { issueSchema } from "../src";

const validIssue = {
  id: "issue-2026-06-19",
  slug: "2026-06-19",
  issueDate: "2026-06-19",
  slotHour: 5,
  beijingTimestamp: "2026-06-19T05:00:00+08:00",
  gmtTimestamp: "2026-06-18T21:00:00Z",
  status: "published",
  featuredTopicId: "topic-1",
  topics: [
    {
      id: "topic-1",
      issueId: "issue-2026-06-19",
      slug: "world-cup-2026-sample",
      rank: 1,
      category: "sports",
      region: "global",
      countryCodes: ["US"],
      eventTime: null,
      isDeveloping: false,
      verificationStatus: "verified",
      scoreTotal: 99,
      localizations: {
        "zh-CN": {
          categoryLabel: "体育",
          headlineFact: "世界杯样例事实标题",
          headlineView: "世界杯样例观点标题",
          headlineFull: "世界杯样例事实标题；世界杯样例观点标题",
          intro: "这是一段超过四十个字符的中文简介，用来验证共享 contracts 包的运行时校验。",
          xiaziQuote: "虾子曰一句",
          doudouQuote: "豆豆龙说",
          footerTakeaway: "记住这一点",
        },
        "en-US": {
          categoryLabel: "Sports",
          headlineFact: "World Cup sample factual headline",
          headlineView: "World Cup sample viewpoint headline",
          headlineFull: "World Cup sample factual headline; World Cup sample viewpoint headline",
          intro: "This introduction is intentionally long enough to satisfy the shared contract runtime validation.",
          xiaziQuote: "Xiazi says",
          doudouQuote: "Doudoulong says",
          footerTakeaway: "Remember this",
        },
      },
      sources: [
        {
          id: "source-1",
          topicId: "topic-1",
          title: "Official note",
          publisher: "FIFA",
          url: "https://example.com",
          publishedAt: null,
          sourceType: "official",
          sourceTier: 1,
          locale: "en-US",
          isPrimary: true,
        },
      ],
    },
  ],
};

describe("issueSchema", () => {
  it("accepts a complete bilingual issue", () => {
    expect(issueSchema.parse(validIssue).topics).toHaveLength(1);
  });

  it("rejects malformed issue dates", () => {
    expect(() => issueSchema.parse({ ...validIssue, issueDate: "06/19/2026" })).toThrow();
  });
});
