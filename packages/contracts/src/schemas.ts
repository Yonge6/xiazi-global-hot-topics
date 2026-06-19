import { z } from "zod";

export const contentLocaleSchema = z.enum(["zh-CN", "en-US"]);
export const issueStatusSchema = z.enum([
  "draft",
  "researching",
  "selecting",
  "writing",
  "review",
  "generating_art",
  "typesetting",
  "qa",
  "ready",
  "published",
  "failed",
]);
export const verificationStatusSchema = z.enum(["pending", "verified", "disputed", "retracted"]);
export const storyStatusSchema = z.enum(["new", "followup", "finished"]);
export const topicCategorySchema = z.enum([
  "international",
  "technology",
  "business",
  "science",
  "climate",
  "culture",
  "sports",
]);
export const sourceTypeSchema = z.enum(["official", "wire", "publisher", "research"]);
export const sourceTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const localizedTopicSchema = z.object({
  categoryLabel: z.string().min(1),
  headlineFact: z.string().min(6),
  headlineView: z.string().min(6),
  headlineFull: z.string().refine((value) => /[；;]/.test(value), {
    message: "Headline must use a Fact; View structure",
  }),
  intro: z.string().min(40),
  xiaziQuote: z.string().min(4),
  doudouQuote: z.string().min(4),
  footerTakeaway: z.string().min(4),
});

export const bilingualContentSchema = z.object({
  "zh-CN": localizedTopicSchema,
  "en-US": localizedTopicSchema,
});

export const sourceSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  title: z.string(),
  publisher: z.string(),
  url: z.string(),
  publishedAt: z.string().nullable(),
  sourceType: sourceTypeSchema,
  sourceTier: sourceTierSchema,
  locale: contentLocaleSchema,
  isPrimary: z.boolean(),
});

export const topicSchema = z.object({
  id: z.string().min(1),
  issueId: z.string().min(1),
  slug: z.string().min(1),
  rank: z.number().int().positive(),
  category: topicCategorySchema,
  region: z.string(),
  countryCodes: z.array(z.string()),
  eventTime: z.string().nullable(),
  isDeveloping: z.boolean(),
  verificationStatus: verificationStatusSchema,
  scoreTotal: z.number(),
  storyId: z.string().optional(),
  storyStatus: storyStatusSchema.optional(),
  followupDay: z.number().int().positive().optional(),
  informationIncrementScore: z.number().optional(),
  localizations: bilingualContentSchema,
  sources: z.array(sourceSchema),
});

export const issueSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  assetVersion: z.string().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotHour: z.number().int(),
  beijingTimestamp: z.string(),
  gmtTimestamp: z.string(),
  status: issueStatusSchema,
  featuredTopicId: z.string().min(1),
  topics: z.array(topicSchema),
});

export const posterRequestSchema = z.object({
  topicId: z.string().uuid(),
  visualBrief: z.object({
    coreScene: z.string().min(10),
    metaphor: z.string().min(4),
    palette: z.array(z.string()).min(2),
    xiazi: z.string().min(8),
    doudoulong: z.string().min(8),
    textSafeZones: z.array(z.string()).min(1),
    forbiddenElements: z.array(z.string()),
  }),
});

export function parseIssue(value: unknown) {
  return issueSchema.parse(value);
}
