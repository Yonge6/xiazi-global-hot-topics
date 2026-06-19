import { JsonContentRepository } from "../apps/web/src/server/repositories/json-content-repository";
import { SupabaseContentRepository } from "../apps/web/src/server/repositories/supabase-content-repository";
import { createServiceRoleClient } from "./content/env";
import { stableJson } from "./content/issues";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === "updatedAt" || key === "revisionId") continue;
      if (key === "assetVersion" && typeof entry === "string" && /^[0-9a-f]{40}$/i.test(entry)) continue;
      result[key] = normalize(entry);
    }
    return result;
  }
  return value;
}

async function main() {
  const jsonRepository = new JsonContentRepository();
  const supabaseRepository = new SupabaseContentRepository(createServiceRoleClient());
  const differences: string[] = [];

  const [jsonSummaries, supabaseSummaries] = await Promise.all([
    jsonRepository.listPublishedIssues(),
    supabaseRepository.listPublishedIssues(),
  ]);
  const supabaseDates = new Set(supabaseSummaries.map((summary) => summary.issueDate));
  const jsonDates = new Set(jsonSummaries.map((summary) => summary.issueDate));

  for (const date of jsonDates) {
    if (!supabaseDates.has(date)) differences.push(`missing issue in supabase: ${date}`);
  }
  for (const date of supabaseDates) {
    if (!jsonDates.has(date)) differences.push(`extra issue in supabase: ${date}`);
  }

  for (const date of [...jsonDates].filter((value) => supabaseDates.has(value)).sort()) {
    const [jsonIssue, supabaseIssue] = await Promise.all([
      jsonRepository.getIssueByDate(date),
      supabaseRepository.getIssueByDate(date),
    ]);
    if (!jsonIssue || !supabaseIssue) {
      differences.push(`missing issue detail: ${date}`);
      continue;
    }
    const left = stableJson(normalize(jsonIssue));
    const right = stableJson(normalize(supabaseIssue));
    if (left !== right) differences.push(`field differences in issue ${date}`);

    const jsonTopicSlugs = new Set(jsonIssue.topics.map((topic) => topic.slug));
    const supabaseTopicSlugs = new Set(supabaseIssue.topics.map((topic) => topic.slug));
    for (const slug of jsonTopicSlugs) if (!supabaseTopicSlugs.has(slug)) differences.push(`missing topic ${date}/${slug}`);
    for (const slug of supabaseTopicSlugs) if (!jsonTopicSlugs.has(slug)) differences.push(`extra topic ${date}/${slug}`);
  }

  console.log(JSON.stringify({
    jsonIssues: jsonSummaries.length,
    supabaseIssues: supabaseSummaries.length,
    differences,
  }, null, 2));
  process.exitCode = differences.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
