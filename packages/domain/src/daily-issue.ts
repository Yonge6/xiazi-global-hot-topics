import { createHash } from "node:crypto";
import { parseIssue, type Issue } from "@xiazi/contracts";

function uuid(seed: string) {
  const bytes = createHash("sha256").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Convert the editorial input without inheriting yesterday's fields or writing mirrors.
export function buildDailyIssue(spec: Record<string, any>): Issue {
  const date = spec.issueDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || spec.stories?.length !== 9) throw new Error("DAILY_SPEC_INVALID");
  const id = uuid(`xiazi:issue:${date}`);
  const topics = spec.stories.map((story: Record<string, any>, index: number) => {
    const number = String(index + 1).padStart(2, "0");
    const topicId = uuid(`xiazi:topic:${date}:${number}`);
    const localized = (copy: Record<string, string>, chinese: boolean) => ({
      ...copy,
      headlineFull: `${copy.headlineFact}${chinese ? "；" : "; "}${copy.headlineView}`,
      footerTakeaway: chinese ? `今日关键词：${copy.categoryLabel}。` : `Keyword: ${copy.categoryLabel}.`,
    });
    return {
      id: topicId, issueId: id, slug: story.slug, rank: index + 1,
      category: story.category, region: story.region, countryCodes: story.countryCodes,
      eventTime: null, isDeveloping: story.storyStatus === "followup", verificationStatus: "verified",
      scoreTotal: 98 - index, storyId: story.storyId, storyStatus: story.storyStatus,
      followupDay: story.followupDay, informationIncrementScore: story.informationIncrementScore,
      localizations: { "zh-CN": localized(story.zh, true), "en-US": localized(story.en, false) },
      sources: story.sources.map((source: Record<string, any>, sourceIndex: number) => ({
        id: uuid(`xiazi:source:${date}:${number}:${sourceIndex + 1}:${source.url}`), topicId,
        title: source.title, publisher: source.publisher, url: source.url,
        publishedAt: source.publishedAt || null,
        sourceType: source.sourceType === "media" ? "publisher" : source.sourceType,
        sourceTier: source.sourceType === "official" ? 1 : 2,
        locale: source.locale || "en-US", isPrimary: sourceIndex === 0,
      })),
    };
  });
  return parseIssue({ id, slug: date, issueDate: date, status: "published", style: spec.style,
    slotHour: 4, beijingTimestamp: `${date}T04:00:00+08:00`,
    gmtTimestamp: new Date(`${date}T04:00:00+08:00`).toISOString(),
    featuredTopicId: topics[0].id, topics });
}
