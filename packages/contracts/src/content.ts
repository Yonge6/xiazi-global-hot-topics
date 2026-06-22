export type IssueStatus =
  | "draft" | "researching" | "selecting" | "writing" | "review"
  | "generating_art" | "typesetting" | "qa" | "ready" | "published" | "failed";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type VerificationStatus = "pending" | "verified" | "disputed" | "retracted";
export type StoryStatus = "new" | "followup" | "finished";
export type PosterAssetType = "poster_zh" | "poster_en" | "thumbnail";
export type ContentLocale = "zh-CN" | "en-US";
export type AppLanguage = "zh" | "en";

export interface LocalizedTopic {
  categoryLabel: string;
  headlineFact: string;
  headlineView: string;
  headlineFull: string;
  intro: string;
  xiaziQuote: string;
  doudouQuote: string;
  footerTakeaway: string;
}

export interface Source {
  id: string;
  topicId: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string | null;
  sourceType: "official" | "wire" | "publisher" | "research";
  sourceTier: 1 | 2 | 3;
  locale: ContentLocale;
  isPrimary: boolean;
}

export interface Topic {
  id: string;
  issueId: string;
  slug: string;
  rank: number;
  category: "international" | "technology" | "business" | "science" | "climate" | "culture" | "sports";
  region: string;
  countryCodes: string[];
  eventTime: string | null;
  isDeveloping: boolean;
  verificationStatus: VerificationStatus;
  scoreTotal: number;
  storyId?: string;
  storyStatus?: StoryStatus;
  followupDay?: number;
  informationIncrementScore?: number;
  localizations: Record<ContentLocale, LocalizedTopic>;
  sources: Source[];
}

export interface Issue {
  id: string;
  slug: string;
  assetVersion?: string;
  issueDate: string;
  slotHour: number;
  beijingTimestamp: string;
  gmtTimestamp: string;
  status: IssueStatus;
  featuredTopicId: string;
  topics: Topic[];
}

export interface Poster {
  id: string;
  topicId: string;
  assetType: PosterAssetType;
  locale: ContentLocale | null;
  storagePath: string;
  width: number;
  height: number;
  format: "png" | "webp" | "svg";
  model: string | null;
  quality: string | null;
  status: "pending" | "generating" | "ready" | "failed";
}

export interface Job {
  id: string;
  issueId: string | null;
  topicId: string | null;
  jobType: string;
  status: JobStatus;
  idempotencyKey: string;
  attempt: number;
  input: unknown;
  output: unknown;
  error: unknown;
}
