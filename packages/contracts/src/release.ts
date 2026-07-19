import type { Issue } from "./content";

export type PublicationReleaseStatus =
  | "validating"
  | "ready_for_approval"
  | "active"
  | "superseded"
  | "failed";

export type PublicationHealth = "healthy" | "degraded" | "stale";

export type PosterCandidate = {
  topicId: string;
  locale: "zh" | "en";
  url: string;
};

export type FactualClaim = {
  field: "headlineFact" | "intro";
  locale: "zh-CN" | "en-US";
  text: string;
};

export type FactualClaimReview = FactualClaim & {
  status: "supported" | "unsupported" | "uncertain";
  rationale: string;
};

export type SourceSnapshot = {
  sourceId: string;
  topicId: string;
  url: string;
  finalUrl: string;
  fetchedAt: string;
  httpStatus: number;
  title: string;
  contentHash: string;
  snapshotText: string;
  correctionStatus: "clear" | "corrected" | "retracted";
  supportsClaim: boolean;
  claimResults: FactualClaimReview[];
  reviewProvider: string;
  reviewModel?: string;
  rationale: string;
};

export type PosterCheck = {
  topicId: string;
  locale: "zh" | "en";
  url: string;
  contentHash: string;
  perceptualHash: string;
  width: number;
  height: number;
  format: "png";
  ocrTextHash: string;
  detectedNumber: number;
  detectedLanguage: "zh" | "en";
  titleMatches: boolean;
  dateMatches: boolean;
  siteMatches: boolean;
  themeMatches: boolean;
  xiaziMatches: boolean;
  doudoulongMatches: boolean;
  crossLocaleThemeMatches: boolean;
  maxDistinctTopicSimilarity: number;
  batchComparisonHash: string;
  duplicateOf?: string;
  reviewProvider: string;
  reviewModel?: string;
  checkedAt: string;
};

export type PublicationValidationReport = {
  passed: boolean;
  schemaVersion: string;
  checkedAt: string;
  sourceSnapshotHash: string;
  posterManifestHash: string;
  sourceCount: number;
  posterCount: number;
  failures: string[];
};

export type PublicationMetadata = {
  releaseId: string;
  releaseSchemaVersion: string;
  contentHash: string;
  dataSource: "supabase-release" | "github" | "local";
  deployedAt: string | null;
  publicationHealth: PublicationHealth;
  stale: boolean;
  degradationReason?: string;
};

export type ActivePublication = {
  issue: Issue;
  metadata: PublicationMetadata;
};
