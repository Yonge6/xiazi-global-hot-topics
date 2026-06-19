import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseIssue, type Issue, type LocalizedTopic, type Source, type Topic } from "@xiazi/contracts";

import type { ContentRepository, IssueSummary } from "./content-repository";

type LocalizationRow = {
  locale: "zh-CN" | "en-US";
  category_label: string;
  headline_fact: string;
  headline_view: string;
  headline_full: string;
  intro: string;
  xiazi_quote: string;
  doudou_quote: string;
  footer_takeaway: string;
};

type SourceRow = {
  id: string;
  topic_id: string;
  title: string;
  publisher: string;
  url: string;
  published_at: string | null;
  source_type: Source["sourceType"];
  source_tier: 1 | 2 | 3;
  locale: Source["locale"];
  is_primary: boolean;
};

type TopicRow = {
  id: string;
  issue_id: string;
  slug: string;
  rank: number;
  category: Topic["category"];
  region: string;
  country_codes: string[];
  event_time: string | null;
  is_developing: boolean;
  verification_status: Topic["verificationStatus"];
  score_total: number;
  story_id: string | null;
  story_status: Topic["storyStatus"] | null;
  followup_day: number | null;
  information_increment_score: number | null;
  topic_localizations: LocalizationRow[];
  sources: SourceRow[];
};

type IssueRow = {
  id: string;
  slug: string;
  asset_version: string | null;
  issue_date: string;
  slot_hour: number;
  beijing_timestamp: string;
  gmt_timestamp: string | null;
  status: Issue["status"];
  featured_topic_id: string;
  topics: TopicRow[];
};

function clientFromEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase secret keys must not be exposed through NEXT_PUBLIC variables");
  }
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for SupabaseContentRepository");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function mapLocalization(row: LocalizationRow): LocalizedTopic {
  return {
    categoryLabel: row.category_label,
    headlineFact: row.headline_fact,
    headlineView: row.headline_view,
    headlineFull: row.headline_full,
    intro: row.intro,
    xiaziQuote: row.xiazi_quote,
    doudouQuote: row.doudou_quote,
    footerTakeaway: row.footer_takeaway,
  };
}

function mapIssue(row: IssueRow): Issue {
  const topics = [...(row.topics || [])]
    .sort((a, b) => a.rank - b.rank)
    .map((topic): Topic => {
      const localizations = Object.fromEntries(
        (topic.topic_localizations || []).map((localization) => [localization.locale, mapLocalization(localization)]),
      ) as Topic["localizations"];
      const sources = [...(topic.sources || [])]
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.source_tier - b.source_tier || a.id.localeCompare(b.id))
        .map((source): Source => ({
          id: source.id,
          topicId: topic.id,
          title: source.title,
          publisher: source.publisher,
          url: source.url,
          publishedAt: source.published_at,
          sourceType: source.source_type,
          sourceTier: source.source_tier,
          locale: source.locale,
          isPrimary: source.is_primary,
        }));
      return {
        id: topic.id,
        issueId: row.id,
        slug: topic.slug,
        rank: topic.rank,
        category: topic.category,
        region: topic.region,
        countryCodes: topic.country_codes || [],
        eventTime: topic.event_time,
        isDeveloping: topic.is_developing,
        verificationStatus: topic.verification_status,
        scoreTotal: Number(topic.score_total),
        ...(topic.story_id ? { storyId: topic.story_id } : {}),
        ...(topic.story_status ? { storyStatus: topic.story_status } : {}),
        ...(topic.followup_day ? { followupDay: topic.followup_day } : {}),
        ...(topic.information_increment_score !== null ? { informationIncrementScore: Number(topic.information_increment_score) } : {}),
        localizations,
        sources,
      };
    });

  return parseIssue({
    id: row.id,
    slug: row.slug,
    ...(row.asset_version ? { assetVersion: row.asset_version } : {}),
    issueDate: row.issue_date,
    slotHour: row.slot_hour,
    beijingTimestamp: row.beijing_timestamp,
    gmtTimestamp: row.gmt_timestamp || row.beijing_timestamp,
    status: row.status,
    featuredTopicId: row.featured_topic_id,
    topics,
  });
}

export class SupabaseContentRepository implements ContentRepository {
  constructor(private readonly supabase: SupabaseClient = clientFromEnv()) {}

  private selectIssue() {
    return this.supabase
      .from("issues")
      .select(`
        id,
        slug,
        asset_version,
        issue_date,
        slot_hour,
        beijing_timestamp,
        gmt_timestamp,
        status,
        featured_topic_id,
        topics (
          id,
          issue_id,
          slug,
          rank,
          category,
          region,
          country_codes,
          event_time,
          is_developing,
          verification_status,
          score_total,
          story_id,
          story_status,
          followup_day,
          information_increment_score,
          topic_localizations (
            locale,
            category_label,
            headline_fact,
            headline_view,
            headline_full,
            intro,
            xiazi_quote,
            doudou_quote,
            footer_takeaway
          ),
          sources (
            id,
            topic_id,
            title,
            publisher,
            url,
            published_at,
            source_type,
            source_tier,
            locale,
            is_primary
          )
        )
      `);
  }

  async getLatestPublishedIssue(): Promise<Issue> {
    const { data, error } = await this.selectIssue()
      .eq("status", "published")
      .order("issue_date", { ascending: false })
      .limit(1)
      .single();
    if (error) throw new Error(`Supabase latest issue failed: ${error.message}`);
    return mapIssue(data as unknown as IssueRow);
  }

  async getIssueByDate(date: string): Promise<Issue | null> {
    const { data, error } = await this.selectIssue()
      .eq("issue_date", date)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(`Supabase issue ${date} failed: ${error.message}`);
    return data ? mapIssue(data as unknown as IssueRow) : null;
  }

  async listPublishedIssues(): Promise<IssueSummary[]> {
    const { data, error } = await this.supabase
      .from("issues")
      .select("issue_date, slug, status")
      .eq("status", "published")
      .order("issue_date", { ascending: false });
    if (error) throw new Error(`Supabase issue list failed: ${error.message}`);
    return (data || []).map((row) => ({
      issueDate: row.issue_date,
      slug: row.slug,
      status: row.status,
      source: "supabase",
    }));
  }
}

export const mapSupabaseIssueForTest = mapIssue;
