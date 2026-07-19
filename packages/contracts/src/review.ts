import { z } from "zod";

export const REVIEW_PROTOCOL_VERSION = "xiazi-review-v1" as const;
export const SEMANTIC_REVIEW_RULESET_VERSION = "semantic-2026-07-19.1" as const;
export const VISUAL_REVIEW_RULESET_VERSION = "visual-2026-07-19.1" as const;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const localeSchema = z.enum(["zh", "en"]);
const claimLocaleSchema = z.enum(["zh-CN", "en-US"]);
const claimFieldSchema = z.enum(["headlineFact", "intro"]);

export const reviewRequestMetadataSchema = z.object({
  protocolVersion: z.literal(REVIEW_PROTOCOL_VERSION),
  rulesetVersion: z.string().min(1).max(100),
  requestId: z.uuid(),
  requestedAt: z.iso.datetime({ offset: true }),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/),
  inputHash: sha256Schema,
}).strict();

export const reviewResponseMetadataSchema = z.object({
  protocolVersion: z.literal(REVIEW_PROTOCOL_VERSION),
  rulesetVersion: z.string().min(1).max(100),
  provider: z.string().min(1).max(100),
  model: z.string().min(1).max(200),
  modelVersion: z.string().min(1).max(200),
  requestId: z.uuid(),
  inputHash: sha256Schema,
  reviewedAt: z.iso.datetime({ offset: true }),
  durationMs: z.number().int().nonnegative().max(600_000),
}).strict();

export const semanticClaimSchema = z.object({
  field: claimFieldSchema,
  locale: claimLocaleSchema,
  text: z.string().min(1).max(8_000),
}).strict();

export const semanticClaimResultSchema = semanticClaimSchema.extend({
  status: z.enum(["supported", "unsupported", "uncertain"]),
  rationale: z.string().min(1).max(8_000),
  evidenceExcerpt: z.string().min(1).max(4_000).optional(),
  evidenceLocator: z.string().min(1).max(2_000).optional(),
}).strict().refine(
  (value) => Boolean(value.evidenceExcerpt || value.evidenceLocator),
  { message: "Each claim result requires evidenceExcerpt or evidenceLocator" },
);

const semanticSourceSchema = z.object({
  sourceId: z.string().min(1).max(200),
  topicId: z.string().min(1).max(200),
  finalUrl: z.url().max(4_000),
  pageTitle: z.string().min(1).max(1_000),
  snapshotText: z.string().min(120).max(500_000),
  correctionMarkerDetected: z.boolean(),
  retractionMarkerDetected: z.boolean(),
  claims: z.array(semanticClaimSchema).length(4),
}).strict().superRefine((value, context) => {
  const expected = new Set([
    "headlineFact:zh-CN",
    "intro:zh-CN",
    "headlineFact:en-US",
    "intro:en-US",
  ]);
  const actual = new Set(value.claims.map((claim) => `${claim.field}:${claim.locale}`));
  if (actual.size !== 4 || [...expected].some((key) => !actual.has(key))) {
    context.addIssue({ code: "custom", message: "Exactly four unique bilingual factual claims are required" });
  }
});

export const semanticReviewPayloadSchema = z.object({
  releaseCandidateId: z.string().min(1).max(200),
  source: semanticSourceSchema,
}).strict();

export const semanticReviewRequestSchema = z.object({
  metadata: reviewRequestMetadataSchema.extend({
    rulesetVersion: z.literal(SEMANTIC_REVIEW_RULESET_VERSION),
  }),
  payload: semanticReviewPayloadSchema,
}).strict();

export const semanticReviewResponseSchema = z.object({
  metadata: reviewResponseMetadataSchema.extend({
    rulesetVersion: z.literal(SEMANTIC_REVIEW_RULESET_VERSION),
  }),
  result: z.object({
    sourceId: z.string().min(1).max(200),
    topicId: z.string().min(1).max(200),
    correctionStatus: z.enum(["clear", "corrected", "retracted"]),
    rationale: z.string().min(1).max(8_000),
    claimResults: z.array(semanticClaimResultSchema).length(4),
  }).strict(),
}).strict();

export const posterReviewInputSchema = z.object({
  url: z.url().max(4_000),
  topicId: z.string().min(1).max(200),
  locale: localeSchema,
  expectedNumber: z.number().int().min(1).max(9),
  expectedTitle: z.string().min(1).max(2_000),
  expectedDate: z.iso.date(),
  expectedSite: z.literal("xiazishuo.com"),
}).strict();

export const posterVisionResultSchema = z.object({
  topicId: z.string().min(1).max(200),
  locale: localeSchema,
  ocrText: z.string().min(1).max(30_000),
  detectedNumber: z.number().int().min(1).max(9),
  detectedLanguage: localeSchema,
  titleMatches: z.boolean(),
  dateMatches: z.boolean(),
  siteMatches: z.boolean(),
  themeMatches: z.boolean(),
  xiaziMatches: z.boolean(),
  doudoulongMatches: z.boolean(),
  nearDuplicate: z.boolean(),
  needsHumanReview: z.boolean(),
  rationale: z.string().min(1).max(8_000),
}).strict();

export const posterPairComparisonSchema = z.object({
  leftTopicId: z.string().min(1).max(200),
  leftLocale: localeSchema,
  rightTopicId: z.string().min(1).max(200),
  rightLocale: localeSchema,
  semanticSimilarity: z.number().min(0).max(1),
  sameTheme: z.boolean(),
  nearDuplicate: z.boolean(),
  needsHumanReview: z.boolean(),
  rationale: z.string().min(1).max(8_000),
}).strict();

export const visualReviewPayloadSchema = z.object({
  assetBatchId: z.string().min(1).max(200),
  posters: z.array(posterReviewInputSchema).length(18),
}).strict().superRefine((value, context) => {
  const slots = value.posters.map((poster) => `${poster.topicId}:${poster.locale}`);
  if (new Set(slots).size !== 18) {
    context.addIssue({ code: "custom", message: "Exactly 18 unique poster slots are required" });
  }
});

export const visualReviewRequestSchema = z.object({
  metadata: reviewRequestMetadataSchema.extend({
    rulesetVersion: z.literal(VISUAL_REVIEW_RULESET_VERSION),
  }),
  payload: visualReviewPayloadSchema,
}).strict();

function comparisonKey(value: z.infer<typeof posterPairComparisonSchema>) {
  return [
    `${value.leftTopicId}:${value.leftLocale}`,
    `${value.rightTopicId}:${value.rightLocale}`,
  ].sort().join("|");
}

export const visualReviewResponseSchema = z.object({
  metadata: reviewResponseMetadataSchema.extend({
    rulesetVersion: z.literal(VISUAL_REVIEW_RULESET_VERSION),
  }),
  result: z.object({
    assetBatchId: z.string().min(1).max(200),
    reviews: z.array(posterVisionResultSchema).length(18),
    comparisons: z.array(posterPairComparisonSchema).length(153),
  }).strict().superRefine((value, context) => {
    const reviewSlots = value.reviews.map((review) => `${review.topicId}:${review.locale}`);
    if (new Set(reviewSlots).size !== 18) {
      context.addIssue({ code: "custom", message: "Exactly 18 unique poster results are required" });
    }
    const comparisonKeys = value.comparisons.map(comparisonKey);
    if (new Set(comparisonKeys).size !== 153) {
      context.addIssue({ code: "custom", message: "Exactly 153 unique poster comparisons are required" });
    }
  }),
}).strict();

export const reviewerErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1).max(100),
    requestId: z.uuid().nullable(),
    failClosed: z.literal(true),
  }).strict(),
}).strict();

export type ReviewRequestMetadata = z.infer<typeof reviewRequestMetadataSchema>;
export type SemanticReviewPayload = z.infer<typeof semanticReviewPayloadSchema>;
export type SemanticReviewRequest = z.infer<typeof semanticReviewRequestSchema>;
export type SemanticReviewResponse = z.infer<typeof semanticReviewResponseSchema>;
export type SemanticClaimResult = z.infer<typeof semanticClaimResultSchema>;
export type VisualReviewPayload = z.infer<typeof visualReviewPayloadSchema>;
export type VisualReviewRequest = z.infer<typeof visualReviewRequestSchema>;
export type VisualReviewResponse = z.infer<typeof visualReviewResponseSchema>;
export type PosterVisionResult = z.infer<typeof posterVisionResultSchema>;
export type PosterPairComparison = z.infer<typeof posterPairComparisonSchema>;
