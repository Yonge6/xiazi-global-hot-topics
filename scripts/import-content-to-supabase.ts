import { createServiceRoleClient } from "./content/env";
import { loadContentIssueFiles, uniqueIssueStats } from "./content/issues";

const supabase = createServiceRoleClient();
const files = await loadContentIssueFiles();
const stats = uniqueIssueStats(files);
const results: Array<{ date: string; role: string; changed: boolean; contentVersion: number }> = [];

for (const file of files) {
  for (const warning of file.warnings) console.warn(`warning: ${warning}`);
  const { data, error } = await supabase.rpc("upsert_issue_bundle", {
    payload: {
      issue: file.issue,
      contentChecksum: file.checksum,
      changeSummary: `import ${file.role} issue ${file.issue.issueDate}`,
      actorType: "script",
      actorId: "content-importer",
    },
  });
  if (error) throw new Error(`Failed to import ${file.issue.issueDate}: ${error.message}`);
  results.push({
    date: file.issue.issueDate,
    role: file.role,
    changed: Boolean(data?.changed),
    contentVersion: Number(data?.contentVersion || 0),
  });
}

const changed = results.filter((result) => result.changed).length;
console.log(JSON.stringify({
  importedFiles: files.length,
  uniqueIssues: stats.issues,
  topics: stats.topics,
  localizations: stats.localizations,
  sources: stats.sources,
  changed,
  unchanged: results.length - changed,
  results,
}, null, 2));
