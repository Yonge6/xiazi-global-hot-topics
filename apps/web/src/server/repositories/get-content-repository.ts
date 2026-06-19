import type { ContentRepository } from "./content-repository";
import { JsonContentRepository } from "./json-content-repository";
import { SupabaseContentRepository } from "./supabase-content-repository";

export function getContentRepository(): ContentRepository {
  const repository = process.env.CONTENT_REPOSITORY || "json";
  if (repository === "json") return new JsonContentRepository();
  if (repository === "supabase") {
    if (process.env.NODE_ENV === "production" && process.env.SUPABASE_ENV === "production") {
      throw new Error("Phase 4A forbids production CONTENT_REPOSITORY=supabase");
    }
    return new SupabaseContentRepository();
  }
  throw new Error(`Unknown CONTENT_REPOSITORY: ${repository}`);
}
