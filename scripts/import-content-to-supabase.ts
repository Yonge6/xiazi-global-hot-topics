import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { createServiceRoleClient, supabaseScriptConfig } from "./content/env";
import { loadContentIssueFiles, uniqueIssueStats } from "./content/issues";
import { syncIssueBundleToSupabase } from "../apps/web/src/server/content-sync/sync-issue-bundle";

const PRODUCTION_CONFIRMATION = "IMPORT TO PLUTO PRODUCTION";

function projectRefFromUrl(url: string) {
  try {
    return new URL(url).hostname.split(".")[0] || "unknown";
  } catch {
    return "unknown";
  }
}

function urlHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}

async function confirmProductionImport() {
  if (process.env.PLUTO_PRODUCTION_IMPORT_CONFIRM === PRODUCTION_CONFIRMATION) return;
  if (!input.isTTY) {
    throw new Error("Production import requires PLUTO_PRODUCTION_IMPORT_CONFIRM=IMPORT TO PLUTO PRODUCTION in non-interactive environments");
  }
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`Type "${PRODUCTION_CONFIRMATION}" to continue: `);
    if (answer !== PRODUCTION_CONFIRMATION) {
      throw new Error("Production import confirmation phrase did not match");
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const config = supabaseScriptConfig();
  const files = await loadContentIssueFiles();
  const stats = uniqueIssueStats(files);
  console.log(JSON.stringify({
    targetEnv: config.env,
    targetProjectRef: projectRefFromUrl(config.url),
    targetUrlHost: urlHostname(config.url),
    dryRun,
    expected: stats,
    importedFiles: files.length,
  }, null, 2));
  if (dryRun) return;
  if (config.env === "production") await confirmProductionImport();

  const supabase = createServiceRoleClient(config);
  const results: Array<{ date: string; role: string; changed: boolean; contentVersion: number }> = [];

  for (const file of files) {
    for (const warning of file.warnings) console.warn(`warning: ${warning}`);
    const data = await syncIssueBundleToSupabase(supabase, file.issue, file.checksum, {
      actorType: "script",
      actorId: "content-importer",
      changeSummary: `import ${file.role} issue ${file.issue.issueDate}`,
    });
    results.push({
      date: file.issue.issueDate,
      role: file.role,
      changed: data.changed,
      contentVersion: data.contentVersion,
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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
