import { z } from "zod";

const posterEnvironmentSchema = z.object({
  POSTER_IMAGE_PROVIDER: z.string().min(1),
  POSTER_IMAGE_MODEL: z.string().min(1),
  POSTER_IMAGE_QUALITY: z.string().min(1),
  POSTER_IMAGE_SIZE: z.literal("1920x3840"),
  POSTER_IMAGE_FORMAT: z.literal("png"),
});

export function getPosterConfig() {
  return posterEnvironmentSchema.parse({
    POSTER_IMAGE_PROVIDER: process.env.POSTER_IMAGE_PROVIDER,
    POSTER_IMAGE_MODEL: process.env.POSTER_IMAGE_MODEL,
    POSTER_IMAGE_QUALITY: process.env.POSTER_IMAGE_QUALITY,
    POSTER_IMAGE_SIZE: process.env.POSTER_IMAGE_SIZE,
    POSTER_IMAGE_FORMAT: process.env.POSTER_IMAGE_FORMAT,
  });
}
