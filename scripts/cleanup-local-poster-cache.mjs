#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildPosterSparsePatterns,
  DEFAULT_LOCAL_ISSUE_RETENTION,
  selectRetainedIssues,
} from "./lib/local-poster-retention.mjs";

const execFile = promisify(execFileCallback);

function parseArgs(argv) {
  const result = { apply: false, retain: DEFAULT_LOCAL_ISSUE_RETENTION };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") result.apply = true;
    else if (arg === "--retain") result.retain = Number.parseInt(argv[++index] || "", 10);
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/cleanup-local-poster-cache.mjs [--retain 3] [--apply]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return result;
}

async function git(args) {
  return execFile("git", args, { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 });
}

async function loadIssues() {
  const archiveDir = path.resolve("data/archive");
  const files = (await readdir(archiveDir))
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
  return Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(archiveDir, name), "utf8"))));
}

const options = parseArgs(process.argv.slice(2));
const retainedIssues = selectRetainedIssues(await loadIssues(), options.retain);
const retention = buildPosterSparsePatterns(retainedIssues);
const report = {
  apply: options.apply,
  retainedIssueCount: retainedIssues.length,
  retainedDates: retention.dates,
  retainedSlugCount: retention.slugs.length,
  historicalArchiveSource: "github-or-cos",
  appsWebArchiveMirror: "excluded-from-local-checkout",
};

if (!options.apply) {
  console.log(JSON.stringify({ ...report, sparsePatternCount: retention.patterns.length }, null, 2));
  process.exit(0);
}

const status = await git([
  "status", "--porcelain", "--untracked-files=all", "--",
  "public/posters", "public/archive", "apps/web/public/posters", "apps/web/public/archive",
]);
if (status.stdout.trim()) throw new Error("LOCAL_POSTER_RETENTION_DIRTY_PATHS");

await git(["sparse-checkout", "init", "--no-cone"]);
const sparsePath = (await git(["rev-parse", "--git-path", "info/sparse-checkout"])).stdout.trim();
await writeFile(sparsePath, `${retention.patterns.join("\n")}\n`, "utf8");
await git(["read-tree", "-mu", "HEAD"]);

const after = await git(["status", "--porcelain"]);
if (after.stdout.trim()) throw new Error("LOCAL_POSTER_RETENTION_DIRTY_AFTER_APPLY");
console.log(JSON.stringify(report, null, 2));
