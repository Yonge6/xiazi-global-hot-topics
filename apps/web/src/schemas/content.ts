import { z } from "zod";

export const localizedTopicSchema = z.object({
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
