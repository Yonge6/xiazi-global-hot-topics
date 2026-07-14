import type { ContentRepository } from "./content-repository";
import { JsonContentRepository } from "./json-content-repository";
import { SupabasePrimaryWithJsonFallbackRepository } from "./supabase-primary-with-json-fallback-repository";

function productionSupabasePrimaryReadsAllowed() {
  return process.env.SUPABASE_PRIMARY_READS_ENABLED === "true"
    && process.env.JSON_READ_FALLBACK_ENABLED === "true";
}

export function getContentRepository(): ContentRepository {
  const repository = process.env.CONTENT_REPOSITORY || "json";
  if (repository === "json") return new JsonContentRepository();
  if (repository === "supabase") {
    if (
      process.env.NODE_ENV === "production"
      && process.env.SUPABASE_ENV === "production"
      && !productionSupabasePrimaryReadsAllowed()
    ) {
      console.warn("Production Supabase primary read blocked by guard; falling back to JSON");
      return new JsonContentRepository();
    }
    return new SupabasePrimaryWithJsonFallbackRepository();
  }
  throw new Error(`Unknown CONTENT_REPOSITORY: ${repository}`);
}
