import { describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { getContentRepository } from "@/server/repositories/get-content-repository";
import { JsonContentRepository } from "@/server/repositories/json-content-repository";
import { mapSupabaseIssueForTest } from "@/server/repositories/supabase-content-repository";
import { parseIssue } from "@xiazi/contracts";

const issue = parseIssue(currentIssue);
const firstTopic = issue.topics[0];
const firstLocalization = firstTopic.localizations["zh-CN"];
const firstSource = firstTopic.sources[0];

describe("content repository selector", () => {
  it("defaults to the JSON repository", () => {
    vi.stubEnv("CONTENT_REPOSITORY", "");
    expect(getContentRepository()).toBeInstanceOf(JsonContentRepository);
    vi.unstubAllEnvs();
  });

  it("rejects unknown repository names", () => {
    vi.stubEnv("CONTENT_REPOSITORY", "mystery");
    expect(() => getContentRepository()).toThrow(/Unknown CONTENT_REPOSITORY/);
    vi.unstubAllEnvs();
  });

  it("rejects production Supabase as the primary repository during Phase 4A", () => {
    vi.stubEnv("CONTENT_REPOSITORY", "supabase");
    vi.stubEnv("SUPABASE_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getContentRepository()).toThrow(/Phase 4A forbids production CONTENT_REPOSITORY=supabase/);
    vi.unstubAllEnvs();
  });
});

describe("Supabase issue mapper", () => {
  it("returns a contract-compatible camelCase issue without leaking snake_case", () => {
    const mapped = mapSupabaseIssueForTest({
      id: issue.id,
      slug: issue.slug,
      asset_version: issue.assetVersion || null,
      issue_date: issue.issueDate,
      slot_hour: issue.slotHour,
      beijing_timestamp: issue.beijingTimestamp,
      gmt_timestamp: issue.gmtTimestamp,
      status: issue.status,
      featured_topic_id: issue.featuredTopicId,
      topics: [
        {
          id: firstTopic.id,
          contract_id: firstTopic.id,
          issue_id: issue.id,
          slug: firstTopic.slug,
          rank: firstTopic.rank,
          category: firstTopic.category,
          region: firstTopic.region,
          country_codes: firstTopic.countryCodes,
          event_time: firstTopic.eventTime,
          is_developing: firstTopic.isDeveloping,
          verification_status: firstTopic.verificationStatus,
          score_total: firstTopic.scoreTotal,
          story_id: firstTopic.storyId || null,
          story_status: firstTopic.storyStatus || null,
          followup_day: firstTopic.followupDay || null,
          information_increment_score: firstTopic.informationIncrementScore || null,
          topic_localizations: [
            {
              locale: "zh-CN",
              category_label: firstLocalization.categoryLabel,
              headline_fact: firstLocalization.headlineFact,
              headline_view: firstLocalization.headlineView,
              headline_full: firstLocalization.headlineFull,
              intro: firstLocalization.intro,
              xiazi_quote: firstLocalization.xiaziQuote,
              doudou_quote: firstLocalization.doudouQuote,
              footer_takeaway: firstLocalization.footerTakeaway,
            },
            {
              locale: "en-US",
              category_label: firstTopic.localizations["en-US"].categoryLabel,
              headline_fact: firstTopic.localizations["en-US"].headlineFact,
              headline_view: firstTopic.localizations["en-US"].headlineView,
              headline_full: firstTopic.localizations["en-US"].headlineFull,
              intro: firstTopic.localizations["en-US"].intro,
              xiazi_quote: firstTopic.localizations["en-US"].xiaziQuote,
              doudou_quote: firstTopic.localizations["en-US"].doudouQuote,
              footer_takeaway: firstTopic.localizations["en-US"].footerTakeaway,
            },
          ],
          sources: [
            {
              id: firstSource.id,
              contract_id: firstSource.id,
              topic_id: firstTopic.id,
              title: firstSource.title,
              publisher: firstSource.publisher,
              url: firstSource.url,
              published_at: firstSource.publishedAt,
              source_type: firstSource.sourceType,
              source_tier: firstSource.sourceTier,
              locale: firstSource.locale,
              is_primary: firstSource.isPrimary,
            },
          ],
        },
      ],
    });

    expect(mapped.topics[0].localizations["zh-CN"].headlineFact).toBe(firstLocalization.headlineFact);
    expect(JSON.stringify(mapped)).not.toContain("headline_fact");
  });
});
