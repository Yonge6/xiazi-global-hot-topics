import { describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { getContentRepository } from "@/server/repositories/get-content-repository";
import { JsonContentRepository } from "@/server/repositories/json-content-repository";
import { mapSupabaseIssueForTest } from "@/server/repositories/supabase-content-repository";
import { SupabasePrimaryWithJsonFallbackRepository } from "@/server/repositories/supabase-primary-with-json-fallback-repository";
import { withReadTimeout } from "@/server/repositories/read-health";
import { parseIssue } from "@xiazi/contracts";
import type { ContentRepository } from "@/server/repositories/content-repository";

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

  it("guards production Supabase primary reads unless both rollout switches are enabled", () => {
    vi.stubEnv("CONTENT_REPOSITORY", "supabase");
    vi.stubEnv("SUPABASE_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    expect(getContentRepository()).toBeInstanceOf(JsonContentRepository);
    vi.unstubAllEnvs();
  });

  it("returns Supabase primary with JSON fallback when the Phase 4C switches are enabled", () => {
    vi.stubEnv("CONTENT_REPOSITORY", "supabase");
    vi.stubEnv("SUPABASE_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_PRIMARY_READS_ENABLED", "true");
    vi.stubEnv("JSON_READ_FALLBACK_ENABLED", "true");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    expect(getContentRepository()).toBeInstanceOf(SupabasePrimaryWithJsonFallbackRepository);
    vi.unstubAllEnvs();
  });
});

class FakeRepository implements ContentRepository {
  constructor(
    private readonly value = issue,
    private readonly options: { fail?: boolean; missing?: boolean; never?: boolean } = {},
  ) {}

  private async read() {
    if (this.options.never) return new Promise<never>(() => {});
    if (this.options.fail) throw new Error("read failed");
    return this.value;
  }

  async getLatestPublishedIssue() {
    return this.read();
  }

  async getIssueByDate() {
    if (this.options.missing) return null;
    return this.read();
  }

  async listPublishedIssues() {
    if (this.options.fail) throw new Error("archive failed");
    return [{ issueDate: this.value.issueDate, slug: this.value.slug, status: this.value.status, source: "supabase" as const }];
  }
}

describe("Supabase primary with JSON fallback repository", () => {
  it("uses Supabase when primary reads succeed", async () => {
    const repository = new SupabasePrimaryWithJsonFallbackRepository(
      new FakeRepository({ ...issue, slug: "from-supabase" }),
      new FakeRepository({ ...issue, slug: "from-json" }),
    );

    await expect(repository.getLatestPublishedIssue()).resolves.toMatchObject({ slug: "from-supabase" });
  });

  it("falls back to JSON when Supabase is missing a dated issue", async () => {
    const repository = new SupabasePrimaryWithJsonFallbackRepository(
      new FakeRepository(issue, { missing: true }),
      new FakeRepository({ ...issue, slug: "from-json" }),
    );

    await expect(repository.getIssueByDate(issue.issueDate)).resolves.toMatchObject({ slug: "from-json" });
  });

  it("falls back to JSON when Supabase fails", async () => {
    const repository = new SupabasePrimaryWithJsonFallbackRepository(
      new FakeRepository(issue, { fail: true }),
      new FakeRepository({ ...issue, slug: "from-json" }),
    );

    await expect(repository.getLatestPublishedIssue()).resolves.toMatchObject({ slug: "from-json" });
  });

  it("falls back to JSON when Supabase latest is stale", async () => {
    const repository = new SupabasePrimaryWithJsonFallbackRepository(
      new FakeRepository({ ...issue, issueDate: "2026-01-01", slug: "stale-supabase" }),
      new FakeRepository({ ...issue, slug: "from-json" }),
    );

    await expect(repository.getLatestPublishedIssue()).resolves.toMatchObject({ slug: "from-json" });
  });

  it("classifies stalled Supabase reads as timeout failures", async () => {
    await expect(withReadTimeout(new Promise<never>(() => {}), 1)).rejects.toThrow("SUPABASE_TIMEOUT");
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
