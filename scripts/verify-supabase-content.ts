import { createServiceRoleClient } from "./content/env";
import { validateIssueForImport } from "./content/issues";
import { SupabaseContentRepository } from "../apps/web/src/server/repositories/supabase-content-repository";

async function main() {
  const supabase = createServiceRoleClient();
  const repository = new SupabaseContentRepository(supabase);
  const summaries = await repository.listPublishedIssues();
  const issues = [];
  for (const summary of summaries) {
    const issue = await repository.getIssueByDate(summary.issueDate);
    if (!issue) throw new Error(`Published issue missing during verify: ${summary.issueDate}`);
    issues.push(issue);
  }
  for (const issue of issues) validateIssueForImport(issue);

  const { data: orphanLocalizations, error: orphanLocalizationError } = await supabase
    .from("topic_localizations")
    .select("id, topics!left(id)")
    .is("topics.id", null);
  if (orphanLocalizationError) throw new Error(orphanLocalizationError.message);

  const { data: orphanSources, error: orphanSourceError } = await supabase
    .from("sources")
    .select("id, topics!left(id)")
    .is("topics.id", null);
  if (orphanSourceError) throw new Error(orphanSourceError.message);

  const { data: currentAssets, error: currentAssetError } = await supabase
    .from("poster_assets")
    .select("topic_id, asset_type, locale")
    .eq("is_current", true);
  if (currentAssetError) throw new Error(currentAssetError.message);

  if ((orphanLocalizations?.length || 0) > 0) throw new Error(`Found ${orphanLocalizations?.length} orphan localizations`);
  if ((orphanSources?.length || 0) > 0) throw new Error(`Found ${orphanSources?.length} orphan sources`);
  const assetKeys = new Set<string>();
  let duplicateCurrentAssets = 0;
  for (const asset of currentAssets || []) {
    const key = `${asset.topic_id}:${asset.asset_type}:${asset.locale || ""}`;
    if (assetKeys.has(key)) duplicateCurrentAssets += 1;
    assetKeys.add(key);
  }
  if (duplicateCurrentAssets > 0) {
    throw new Error(`Found ${duplicateCurrentAssets} duplicate current poster asset groups`);
  }

  console.log(JSON.stringify({
    verifiedIssues: issues.length,
    topics: issues.reduce((sum, issue) => sum + issue.topics.length, 0),
    localizations: issues.reduce((sum, issue) => sum + issue.topics.length * 2, 0),
    sources: issues.reduce((sum, issue) => sum + issue.topics.reduce((sourceSum, topic) => sourceSum + topic.sources.length, 0), 0),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
