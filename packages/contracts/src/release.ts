import type { Issue } from "./content";
import type { StorageVerificationReport } from "./storage";

export type PublicationReleaseStatus =
  | "validating"
  | "ready_for_approval"
  | "active"
  | "superseded"
  | "failed";

export type PublicationHealth = "healthy" | "degraded" | "stale";

export type PublicationReviewStatus = "passed" | "waived";

export type PublicationReviewDecision = {
  reviewStatus: PublicationReviewStatus;
  reviewPassed: boolean;
  reviewWaived: boolean;
  waiverId?: string;
  waiverReason?: string;
  configuredBy?: string;
  configuredAt?: string;
};

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
  reviewStatus: PublicationReviewStatus;
  reviewProvider?: string;
  reviewModel?: string;
  reviewModelVersion?: string;
  reviewProtocolVersion?: string;
  reviewRulesetVersion?: string;
  reviewRequestId?: string;
  reviewInputHash?: string;
  reviewedAt?: string;
  reviewDurationMs?: number;
  rationale: string;
};

export type PosterCheck = {
  topicId: string;
  locale: "zh" | "en";
  url: string;
  contentHash: string;
  sizeBytes: number;
  contentType: "image/png";
  storageProvider: "tencent-cos";
  storageVersionId: string;
  etag: string;
  storageCreatedAt: string;
  uploaderVersion: string;
  perceptualHash: string;
  width: number;
  height: number;
  format: "png";
  verificationMethod: "reviewer" | "deterministic-manifest";
  manifestNumber: number;
  manifestLanguage: "zh" | "en";
  manifestIssueDate: string;
  manifestSite: "xiazishuo.com";
  ocrPerformed: boolean;
  semanticComparisonPerformed: boolean;
  ocrTextHash?: string;
  detectedNumber?: number;
  detectedLanguage?: "zh" | "en";
  titleMatches?: boolean;
  dateMatches?: boolean;
  siteMatches?: boolean;
  themeMatches?: boolean;
  xiaziMatches?: boolean;
  doudoulongMatches?: boolean;
  crossLocaleThemeMatches?: boolean;
  maxDistinctTopicSimilarity?: number;
  batchComparisonHash?: string;
  duplicateOf?: string;
  reviewStatus: PublicationReviewStatus;
  reviewProvider?: string;
  reviewModel?: string;
  reviewModelVersion?: string;
  reviewProtocolVersion?: string;
  reviewRulesetVersion?: string;
  reviewRequestId?: string;
  reviewInputHash?: string;
  reviewedAt?: string;
  reviewDurationMs?: number;
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
  storageVerification: StorageVerificationReport;
  reviewStatus: PublicationReviewStatus;
  reviewPassed: boolean;
  reviewWaived: boolean;
  waiverId?: string;
  waiverReason?: string;
  configuredBy?: string;
  configuredAt?: string;
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
  reviewStatus: PublicationReviewStatus;
  reviewPassed: boolean;
  reviewWaived: boolean;
  waiverId?: string;
  waiverReason?: string;
  configuredBy?: string;
  configuredAt?: string;
  degradationReason?: string;
};

export type ActivePublication = {
  issue: Issue;
  metadata: PublicationMetadata;
};
