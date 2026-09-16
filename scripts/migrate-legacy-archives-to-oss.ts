import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { parseIssue, type Issue } from "@xiazi/contracts";
import { immutableAssetKey } from "@xiazi/domain";

import { resolvePosterName } from "../apps/web/src/lib/posters/assets";
import { createVerifiedImmutableObject, sha256Buffer } from "../apps/web/src/server/storage/immutable-asset-store";
import { OssImmutableAssetStore } from "../apps/web/src/server/storage/oss-immutable-asset-store";

const execFileText = promisify(execFile);
const DATE_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;
const PNG_MAGIC = Buffer.from("89504e470d0a1a0a", "hex");
const LEGACY_SOURCE_NAMES: Record<string, string[]> = {
  "ai-governance-crossroads": ["ai-governance"],
};
const LEGACY_CATEGORIES: Record<string, string> = {
  conflict: "international",
  humanitarian: "international",
  overview: "international",
  politics: "international",
  society: "culture",
};
const LEGACY_SOURCE_TYPES: Record<string, string> = {
  original: "publisher",
  report: "research",
};

type Options = {
  apply: boolean;
  date?: string;
  limit?: number;
  legacyRepo: string;
  legacyRef: string;
  configFile: string;
};

type SourcePoster = {
  topicId: string;
  locale: "zh" | "en";
  slot: string;
  sourcePath: string;
  content?: Buffer;
  contentHash?: string;
};

type MigrationIssue = {
  issue: Issue;
  document: Record<string, unknown>;
};

type LegacyIssueShape = {
  style?: {
    name?: string;
    zhName?: string;
    description?: string;
    introZh?: string;
    introEn?: string;
  };
  topics?: Array<{
    category?: string;
    sources?: Array<{ sourceType?: string }>;
    localizations?: Record<string, {
      headlineFact?: string;
      headlineView?: string;
      headlineFull?: string;
      intro?: string;
      xiaziQuote?: string;
      doudouQuote?: string;
      footerTakeaway?: string;
    }>;
  }>;
};

function existingText(parts: Array<string | undefined>, minimum: number) {
  const available = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  let value = available.join(" ");
  while (value.length < minimum && available.length > 0) value = `${value} ${available[0]}`.trim();
  return value;
}

function normalizeLegacyIssue(value: unknown) {
  const issue = value as LegacyIssueShape;
  if (issue.style?.name && !issue.style.zhName) issue.style.zhName = issue.style.name;
  if (issue.style && !issue.style.description) {
    issue.style.description = [issue.style.introZh, issue.style.introEn].filter(Boolean).join(" ");
  }
  for (const topic of issue.topics || []) {
    if (topic.category && LEGACY_CATEGORIES[topic.category]) topic.category = LEGACY_CATEGORIES[topic.category];
    for (const source of topic.sources || []) {
      if (source.sourceType && LEGACY_SOURCE_TYPES[source.sourceType]) {
        source.sourceType = LEGACY_SOURCE_TYPES[source.sourceType];
      }
    }
    for (const localization of Object.values(topic.localizations || {})) {
      const material = [localization.headlineFull, localization.headlineFact, localization.footerTakeaway];
      if ((localization.headlineFact?.trim().length || 0) < 6 && localization.intro?.trim()) {
        localization.headlineFact = localization.intro.trim();
        localization.headlineFull = `${localization.headlineFact}; ${localization.headlineView || localization.footerTakeaway || "Context"}`;
      }
      if (!localization.headlineView?.trim()) localization.headlineView = existingText(material, 6);
      if (!localization.intro?.trim()) localization.intro = existingText(material, 40);
      if (!localization.xiaziQuote?.trim()) localization.xiaziQuote = existingText(material, 4);
      if (!localization.doudouQuote?.trim()) localization.doudouQuote = existingText(material, 4);
    }
  }
  return value;
}

function parseArgs(argv: string[]): Options {
  const result: Options = {
    apply: false,
    legacyRepo: process.env.XIAZI_LEGACY_REPO || "/Users/yongyuan/Documents/虾子曰全球热点海报工作流",
    legacyRef: process.env.XIAZI_LEGACY_REF || "origin/main",
    configFile: process.env.XIAZI_OSS_PUBLISHER_CONFIG || path.join(os.homedir(), ".config/xiazi/oss-publisher.json"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") result.apply = true;
    else if (arg === "--date") result.date = argv[++index];
    else if (arg === "--limit") result.limit = Number.parseInt(argv[++index] || "", 10);
    else if (arg === "--legacy-repo") result.legacyRepo = path.resolve(argv[++index]);
    else if (arg === "--legacy-ref") result.legacyRef = argv[++index];
    else if (arg === "--config") result.configFile = path.resolve(argv[++index]);
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: tsx scripts/migrate-legacy-archives-to-oss.ts [--apply] [--date YYYY-MM-DD] [--limit N]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (result.date && !/^\d{4}-\d{2}-\d{2}$/.test(result.date)) throw new Error("INVALID_DATE");
  if (result.limit !== undefined && (!Number.isSafeInteger(result.limit) || result.limit < 1)) throw new Error("INVALID_LIMIT");
  return result;
}

async function gitText(repo: string, args: string[]) {
  return (await execFileText("git", args, { cwd: repo, maxBuffer: 20 * 1024 * 1024 })).stdout.trim();
}

async function gitBuffer(repo: string, args: string[]) {
  return new Promise<Buffer>((resolve, reject) => {
    execFile("git", args, { cwd: repo, encoding: "buffer", maxBuffer: 20 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(Buffer.from(stdout));
    });
  });
}

function posterCandidates(issueDate: string, locale: "zh" | "en", slot: string) {
  return [
    `public/archive/${issueDate}/posters/${locale}/${slot}.png`,
    `apps/web/public/archive/${issueDate}/posters/${locale}/${slot}.png`,
  ];
}

async function resolveSourcePath(
  options: Options,
  issueDate: string,
  locale: "zh" | "en",
  slug: string,
  slot: string,
) {
  const sourceNames = [...new Set([slot, slug, ...(LEGACY_SOURCE_NAMES[slug] || [])])];
  for (const sourceName of sourceNames) {
    for (const candidate of posterCandidates(issueDate, locale, sourceName)) {
      try {
        await gitText(options.legacyRepo, ["cat-file", "-e", `${options.legacyRef}:${candidate}`]);
        return candidate;
      } catch {
        // Try the historical tree for files removed from the current branch.
      }
      try {
        const commit = await gitText(options.legacyRepo, ["rev-list", "-n", "1", "--all", "--", candidate]);
        if (commit) {
          await gitText(options.legacyRepo, ["cat-file", "-e", `${commit}:${candidate}`]);
          return `${commit}:${candidate}`;
        }
      } catch {
        // Try the next mirror or historical name.
      }
    }
  }
  throw new Error(`LEGACY_POSTER_NOT_FOUND:${issueDate}:${locale}:${slot}`);
}

async function readSourcePoster(options: Options, sourcePath: string) {
  const spec = sourcePath.includes(":") ? sourcePath : `${options.legacyRef}:${sourcePath}`;
  const content = await gitBuffer(options.legacyRepo, ["show", spec]);
  if (content.length < 24 || !content.subarray(0, 8).equals(PNG_MAGIC)) throw new Error(`LEGACY_POSTER_NOT_PNG:${sourcePath}`);
  const width = content.readUInt32BE(16);
  const height = content.readUInt32BE(20);
  if (width < 600 || height < 1000 || width >= height) throw new Error(`LEGACY_POSTER_DIMENSIONS_INVALID:${sourcePath}:${width}x${height}`);
  return content;
}

async function issuePosters(options: Options, issue: Issue, includeContent: boolean) {
  const posters: SourcePoster[] = [];
  for (const topic of issue.topics) {
    const slot = resolvePosterName(topic.slug);
    for (const locale of ["zh", "en"] as const) {
      const sourcePath = await resolveSourcePath(options, issue.issueDate, locale, topic.slug, slot);
      const poster: SourcePoster = { topicId: topic.id, locale, slot, sourcePath };
      if (includeContent) {
        poster.content = await readSourcePoster(options, sourcePath);
        poster.contentHash = sha256Buffer(poster.content);
      }
      posters.push(poster);
    }
  }
  if (posters.length !== 18 || new Set(posters.map((poster) => `${poster.topicId}:${poster.locale}`)).size !== 18) {
    throw new Error(`LEGACY_POSTER_SET_INCOMPLETE:${issue.issueDate}`);
  }
  return posters;
}

function archiveIdentity(issue: Issue, posters: SourcePoster[]) {
  const digest = createHash("sha256");
  digest.update(issue.issueDate);
  for (const poster of posters) digest.update(`${poster.topicId}:${poster.locale}:${poster.slot}:${poster.contentHash}`);
  const suffix = digest.digest("hex").slice(0, 24);
  const compactDate = issue.issueDate.replaceAll("-", "");
  return {
    releaseId: `rel_${compactDate}_${suffix}`,
    assetBatchId: `asset_archive_${compactDate}_${suffix}`,
  };
}

async function loadIssues(options: Options) {
  const archiveDir = path.resolve("data/archive");
  let dates = (await readdir(archiveDir)).filter((name) => DATE_FILE.test(name)).map((name) => name.slice(0, -5)).sort();
  if (options.date) dates = dates.filter((date) => date === options.date);
  dates = (await Promise.all(dates.map(async (date) => {
    try {
      const manifest = JSON.parse(await readFile(path.resolve("data/release-archive", `${date}.json`), "utf8"));
      if (manifest.posters?.every((poster: { url?: string }) => poster.url?.includes(".oss-cn-wulanchabu.aliyuncs.com/"))) return null;
    } catch {
      // Missing manifest means this date needs migration.
    }
    return date;
  }))).filter((date): date is string => Boolean(date));
  if (options.limit !== undefined) dates = dates.slice(0, options.limit);
  return Promise.all(dates.map(async (date) => {
    const document = normalizeLegacyIssue(
      JSON.parse(await readFile(path.join(archiveDir, `${date}.json`), "utf8")),
    ) as Record<string, unknown>;
    return { issue: parseIssue(document), document } satisfies MigrationIssue;
  }));
}

async function uploadDate(store: OssImmutableAssetStore, migration: MigrationIssue, posters: SourcePoster[]) {
  const { issue } = migration;
  const identity = archiveIdentity(issue, posters);
  const results = new Array<Awaited<ReturnType<typeof createVerifiedImmutableObject>>>(posters.length);
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < posters.length) {
      const index = cursor++;
      const poster = posters[index];
      const topic = issue.topics.find((item) => item.id === poster.topicId);
      if (!topic || !poster.content) throw new Error(`LEGACY_POSTER_TOPIC_INVALID:${poster.topicId}`);
      results[index] = await createVerifiedImmutableObject(store, {
        key: immutableAssetKey(identity.assetBatchId, poster.locale, poster.slot),
        content: poster.content,
        contentType: "image/png",
        assetBatchId: identity.assetBatchId,
        topicId: poster.topicId,
        locale: poster.locale,
        issueDate: issue.issueDate,
        expectedNumber: topic.rank,
        expectedSite: "xiazishuo.com",
        createdAt: new Date().toISOString(),
        uploaderVersion: "xiazi-legacy-archive-oss-v1",
      });
      completed += 1;
      console.log(`OSS ${issue.issueDate} ${completed}/18 ${results[index].created ? "created" : "reused"}`);
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  const manifest = {
    schemaVersion: "xiazi-current-release-v1",
    issueDate: issue.issueDate,
    releaseId: identity.releaseId,
    assetBatchId: identity.assetBatchId,
    posters: results.map(({ object }) => ({
      topicId: object.topicId,
      locale: object.locale,
      contentHash: object.sha256,
      url: object.url,
    })),
  };
  const synchronizedIssue = { ...migration.document, assetVersion: identity.releaseId };
  await writeFile(path.resolve("data/archive", `${issue.issueDate}.json`), `${JSON.stringify(synchronizedIssue, null, 2)}\n`);
  await writeFile(path.resolve("data/release-archive", `${issue.issueDate}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.resolve("data/releases", `${identity.releaseId}.json`), `${JSON.stringify({ issue: synchronizedIssue, manifest }, null, 2)}\n`);
  return identity;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const legacyStatus = await gitText(options.legacyRepo, ["status", "--porcelain=v1", "-uall"]);
  const legacyFingerprint = createHash("sha256").update(legacyStatus).digest("hex");
  const issues = await loadIssues(options);
  console.log(`MIGRATION_TARGETS dates=${issues.length} mode=${options.apply ? "apply" : "dry-run"}`);
  const migratable: MigrationIssue[] = [];
  const incomplete: string[] = [];
  for (const [index, migration] of issues.entries()) {
    const { issue } = migration;
    try {
      await issuePosters(options, issue, false);
      migratable.push(migration);
      console.log(`INVENTORY ${index + 1}/${issues.length} ${issue.issueDate} posters=18`);
    } catch (error) {
      incomplete.push(issue.issueDate);
      console.warn(`INCOMPLETE ${index + 1}/${issues.length} ${issue.issueDate} ${String(error)}`);
    }
  }
  console.log(`INVENTORY_COMPLETE migratable=${migratable.length} incomplete=${incomplete.join(",") || "none"}`);
  if (!options.apply) return;

  const configInfo = await stat(options.configFile);
  if ((configInfo.mode & 0o077) !== 0 || configInfo.uid !== process.getuid?.()) throw new Error("PUBLISHER_CONFIG_MUST_BE_OWNER_ONLY");
  const store = new OssImmutableAssetStore(JSON.parse(await readFile(options.configFile, "utf8")));
  await store.verifyVersioning();
  for (const [index, migration] of migratable.entries()) {
    const { issue } = migration;
    const posters = await issuePosters(options, issue, true);
    const identity = await uploadDate(store, migration, posters);
    console.log(`MIGRATED ${index + 1}/${migratable.length} ${issue.issueDate} ${identity.releaseId}`);
  }
  const finalLegacyStatus = await gitText(options.legacyRepo, ["status", "--porcelain=v1", "-uall"]);
  const finalFingerprint = createHash("sha256").update(finalLegacyStatus).digest("hex");
  if (finalFingerprint !== legacyFingerprint) throw new Error("LEGACY_WORKTREE_CHANGED");
  console.log(`MIGRATION_COMPLETE dates=${migratable.length} incomplete=${incomplete.join(",") || "none"} legacyStatus=${legacyFingerprint}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
