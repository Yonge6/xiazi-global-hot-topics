import type { Issue } from "@xiazi/contracts";

const categories = [
  "international",
  "sports",
  "technology",
  "business",
  "science",
  "climate",
  "culture",
  "international",
  "business",
] as const;

const labels = [
  ["今日总览", "Overview"],
  ["世界杯日报", "World Cup Daily"],
  ["AI热点", "Artificial Intelligence"],
  ["OPC一人公司", "OPC Solo Company"],
  ["来源安全", "Source Safety"],
  ["视觉验收", "Visual Review"],
  ["不可变资产", "Immutable Assets"],
  ["原子发布", "Atomic Publication"],
  ["回滚演练", "Rollback Rehearsal"],
] as const;

export const stagingFixtureClaims = labels.map(([zhLabel, enLabel], index) => {
  const number = index + 1;
  return {
    zhLabel,
    enLabel,
    zhHeadline: `STAGING ONLY：第${number}槽用于验证${zhLabel}发布硬门`,
    zhIntro: `这是一条仅用于独立测试环境的确定性演练内容。它验证第${number}槽的中文标题、介绍、来源快照、海报编号和人工发布门，不代表真实新闻，也不会进入生产站点。`,
    enHeadline: `STAGING ONLY: slot ${number} verifies the ${enLabel} release gate`,
    enIntro: `This deterministic item exists only in the isolated staging environment. It verifies the slot ${number} English title, introduction, source snapshot, poster number, and human approval gate; it is not live news and cannot enter production.`,
  };
});

export function stagingRehearsalIssue(input: { issueDate: string; sourceOrigin: string }): Issue {
  const issueId = `staging-issue-${input.issueDate}`;
  const beijingTimestamp = `${input.issueDate}T05:00:00+08:00`;
  const topics = stagingFixtureClaims.map((claim, index) => {
    const rank = index + 1;
    const topicId = `staging-topic-${String(rank).padStart(2, "0")}`;
    return {
      id: topicId,
      issueId,
      slug: rank === 1 ? "overview"
        : rank === 2 ? "world-cup-staging-slot-02"
          : `staging-slot-${String(rank).padStart(2, "0")}`,
      rank,
      category: categories[index],
      region: "Isolated staging",
      countryCodes: [],
      eventTime: null,
      isDeveloping: false,
      verificationStatus: "verified" as const,
      scoreTotal: 100 - index,
      storyId: `staging-story-${String(rank).padStart(2, "0")}`,
      storyStatus: "new" as const,
      localizations: {
        "zh-CN": {
          categoryLabel: claim.zhLabel,
          headlineFact: claim.zhHeadline,
          headlineView: "技术演练必须以失败关闭和可审计证据为准。",
          headlineFull: `${claim.zhHeadline}；技术演练必须以失败关闭和可审计证据为准。`,
          intro: claim.zhIntro,
          xiaziQuote: "演练只证明机器门真实有效，不替代未来刊物的编辑判断。",
          doudouQuote: "先在隔离环境把每一种失败走一遍，再讨论生产开关。",
          footerTakeaway: `STAGING ONLY · NO.${String(rank).padStart(2, "0")}`,
        },
        "en-US": {
          categoryLabel: claim.enLabel,
          headlineFact: claim.enHeadline,
          headlineView: "a technical rehearsal succeeds only through fail-closed, auditable evidence.",
          headlineFull: `${claim.enHeadline}; a technical rehearsal succeeds only through fail-closed, auditable evidence.`,
          intro: claim.enIntro,
          xiaziQuote: "The rehearsal proves that machine gates work; it does not replace editorial judgment for a future issue.",
          doudouQuote: "Exercise every failure in isolation before anyone discusses a production switch.",
          footerTakeaway: `STAGING ONLY · NO.${String(rank).padStart(2, "0")}`,
        },
      },
      sources: [{
        id: `staging-source-${String(rank).padStart(2, "0")}`,
        topicId,
        title: `Release V2 staging source fixture ${rank}`,
        publisher: "Xiazi Release V2 Staging Harness",
        url: `${input.sourceOrigin}/api/staging/source-fixture/${topicId}`,
        publishedAt: `${input.issueDate}T00:00:00.000Z`,
        sourceType: "official" as const,
        sourceTier: 1 as const,
        locale: "en-US" as const,
        isPrimary: true,
      }],
    };
  });
  return {
    id: issueId,
    slug: input.issueDate,
    issueDate: input.issueDate,
    slotHour: 5,
    beijingTimestamp,
    gmtTimestamp: new Date(beijingTimestamp).toISOString(),
    status: "ready",
    featuredTopicId: topics[0].id,
    topics,
  };
}
