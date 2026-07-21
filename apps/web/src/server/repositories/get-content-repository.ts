import type { ContentRepository } from "./content-repository";
import { JsonContentRepository } from "./json-content-repository";
import { SupabaseContentRepository } from "./supabase-content-repository";
import { ReleaseContentRepository } from "../releases/release-content-repository";
import { releaseV2Enabled } from "../releases/release-runtime";

export function getContentRepository(): ContentRepository {
  if (releaseV2Enabled()) return new ReleaseContentRepository();
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
