import { parseIssue } from "@xiazi/contracts";

import { createServiceRoleClient } from "./content/env";
import { validateIssueForImport } from "./content/issues";

const supabase = createServiceRoleClient();
const { data, error } = await supabase.rpc("list_issue_contracts");

if (error) throw new Error(`Failed to verify Supabase content: ${error.message}`);
if (!Array.isArray(data)) throw new Error("list_issue_contracts must return an array");

const issues = data.map((item) => parseIssue(item));
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

const { data: duplicateAssets, error: duplicateAssetError } = await supabase.rpc("find_duplicate_current_poster_assets");
if (duplicateAssetError && duplicateAssetError.code !== "PGRST202") throw new Error(duplicateAssetError.message);

if ((orphanLocalizations?.length || 0) > 0) throw new Error(`Found ${orphanLocalizations?.length} orphan localizations`);
if ((orphanSources?.length || 0) > 0) throw new Error(`Found ${orphanSources?.length} orphan sources`);
if (Array.isArray(duplicateAssets) && duplicateAssets.length > 0) {
  throw new Error(`Found ${duplicateAssets.length} duplicate current poster asset groups`);
}

console.log(JSON.stringify({
  verifiedIssues: issues.length,
  topics: issues.reduce((sum, issue) => sum + issue.topics.length, 0),
  localizations: issues.reduce((sum, issue) => sum + issue.topics.length * 2, 0),
  sources: issues.reduce((sum, issue) => sum + issue.topics.reduce((sourceSum, topic) => sourceSum + topic.sources.length, 0), 0),
}, null, 2));
