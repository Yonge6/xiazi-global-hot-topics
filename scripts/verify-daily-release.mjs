#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  beijingDate,
  normalizeIssueForArchiveComparison,
  validateIssue,
  validateStoryPool,
} from "./lib/daily-release-validator.mjs";
import { fetchBufferWithRetry } from "./lib/remote-file-fetch.mjs";

const PRODUCTION_ORIGIN = "https://xiazishuo.com";
const RUNTIME_BRAND_ASSETS = [
  "brand/logo/xiazi-global-hot-topics.webp",
  "brand/characters/xiazi/xiazi-master-front.webp",
  "brand/characters/doudou/doudou-master-front.webp",
  "brand/masthead/editorial-atlas-bg-v1.webp",
  "brand/contact/support-appreciation.jpeg",
  "brand/contact/video-channel.jpg",
];
const CURRENT_MIRRORS = [
  "data/current-issue.json",
  "src/data/current-issue.json",
  "public/data/current-issue.json",
  "apps/web/data/current-issue.json",
  "apps/web/src/data/current-issue.json",
  "apps/web/public/data/current-issue.json",
];
const STORY_POOL_MIRRORS = [
  "data/story-pool.json",
  "src/data/story-pool.json",
  "public/data/story-pool.json",
  "apps/web/data/story-pool.json",
  "apps/web/src/data/story-pool.json",
  "apps/web/public/data/story-pool.json",
];

function usage() {
  return `Usage: node scripts/verify-daily-release.mjs [options]

Options:
  --local                 Check local data mirrors, Story Pool, and poster files
  --live                  Check https://xiazishuo.com production surfaces
  --remote-archive        Check the dated GitHub (legacy) or COS (Release V2) poster archive
  --today                 Require today's Asia/Shanghai issueDate
  --date YYYY-MM-DD       Require an explicit issueDate
  --check-sources         Probe recommended-reading URLs (live mode)
  --report PATH           Write a machine-readable JSON report
  --no-strict-schedule    Diagnose an already-late issue without failing the 05:00 rule
  --help                  Show this help

With no mode, --local is used. With no date option, today's Beijing date is required.`;
}

function parseArgs(argv) {
  const options = {
    local: false,
    live: false,
    remoteArchive: false,
    checkSources: false,
    strictSchedule: true,
    expectedDate: null,
    reportPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--local") options.local = true;
    else if (arg === "--live") options.live = true;
    else if (arg === "--remote-archive") options.remoteArchive = true;
    else if (arg === "--check-sources") options.checkSources = true;
    else if (arg === "--no-strict-schedule") options.strictSchedule = false;
    else if (arg === "--today") options.expectedDate = beijingDate();
    else if (arg === "--date") options.expectedDate = argv[++index];
    else if (arg === "--report") options.reportPath = argv[++index];
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    }
  }

  if (!options.local && !options.live && !options.remoteArchive) options.local = true;
  if (!options.expectedDate) options.expectedDate = beijingDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.expectedDate || "")) {
    throw new Error(`Invalid expected date: ${options.expectedDate || "missing"}`);
  }
  if (options.checkSources && !options.live) {
    throw new Error("--check-sources requires --live");
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const startedAt = new Date().toISOString();
const checks = [];

function record(status, id, message, details) {
  checks.push({ status, id, message, ...(details === undefined ? {} : { details }) });
}

function pass(id, message, details) {
  record("pass", id, message, details);
}

function fail(id, message, details) {
  record("fail", id, message, details);
}

function warn(id, message, details) {
  record("warning", id, message, details);
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function beijingClock(timestamp) {
  const value = new Date(timestamp || "");
  if (!Number.isFinite(value.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

async function validateImage(buffer, label) {
  if (buffer.length < 10_000) throw new Error(`${label} is suspiciously small (${buffer.length} bytes)`);
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`${label} has no readable dimensions`);
  if (metadata.width < 800 || metadata.height < 1_500) {
    throw new Error(`${label} is below the minimum original-poster size (${metadata.width}x${metadata.height})`);
  }
  const ratio = metadata.width / metadata.height;
  if (ratio < 0.45 || ratio > 0.56) {
    throw new Error(`${label} is not a portrait poster (${metadata.width}x${metadata.height})`);
  }
  return { bytes: buffer.length, width: metadata.width, height: metadata.height, format: metadata.format };
}

async function runLocalChecks() {
  let issue;
  try {
    issue = await readJson(CURRENT_MIRRORS[0]);
    pass("LOCAL-001", "Loaded the canonical local current issue", { issueDate: issue.issueDate });
  } catch (cause) {
    fail("LOCAL-001", "Cannot load data/current-issue.json", String(cause));
    return;
  }

  const issueErrors = validateIssue(issue, {
    expectedDate: options.expectedDate,
    strictSchedule: options.strictSchedule,
  });
  if (issueErrors.length === 0) pass("LOCAL-002", "Current issue satisfies the automated PRD contract");
  else issueErrors.forEach((item) => fail(item.id, item.message, item.path));

  try {
    const mirrors = await Promise.all(CURRENT_MIRRORS.map(readJson));
    const canonical = stableJson(mirrors[0]);
    const mismatches = CURRENT_MIRRORS.filter((_, index) => stableJson(mirrors[index]) !== canonical);
    if (mismatches.length > 0) throw new Error(`Mismatched mirrors: ${mismatches.join(", ")}`);
    pass("MIRROR-001", "All six current-issue mirrors are identical", CURRENT_MIRRORS);
  } catch (cause) {
    fail("MIRROR-001", "Current-issue mirrors are missing or inconsistent", String(cause));
  }

  const archiveMirrors = CURRENT_MIRRORS.map((file) => file.replace("current-issue.json", `archive/${options.expectedDate}.json`));
  try {
    const archives = await Promise.all(archiveMirrors.map(readJson));
    const canonical = stableJson(issue);
    const mismatches = archiveMirrors.filter((_, index) => stableJson(archives[index]) !== canonical);
    if (mismatches.length > 0) throw new Error(`Mismatched archives: ${mismatches.join(", ")}`);
    pass("MIRROR-002", "All six archive mirrors match the current issue", archiveMirrors);
  } catch (cause) {
    fail("MIRROR-002", "Archive mirrors are missing or inconsistent", String(cause));
  }

  let storyPool;
  try {
    const pools = await Promise.all(STORY_POOL_MIRRORS.map(readJson));
    storyPool = pools[0];
    const canonical = stableJson(storyPool);
    const mismatches = STORY_POOL_MIRRORS.filter((_, index) => stableJson(pools[index]) !== canonical);
    if (mismatches.length > 0) throw new Error(`Mismatched Story Pools: ${mismatches.join(", ")}`);
    pass("MIRROR-003", "All six Story Pool mirrors are identical", { entries: storyPool.length });
  } catch (cause) {
    fail("MIRROR-003", "Story Pool mirrors are missing or inconsistent", String(cause));
  }

  if (storyPool) {
    const poolErrors = validateStoryPool(storyPool, issue);
    if (poolErrors.length === 0) pass("POOL-000", "Story Pool contains and matches all eight independent stories");
    else poolErrors.forEach((item) => fail(item.id, item.message, item.path));
  }

  const assetDetails = [];
  const assetErrors = [];
  for (const locale of ["zh", "en"]) {
    for (const topic of issue.topics || []) {
      const currentPath = `apps/web/public/posters/${locale}/${topic.slug}.png`;
      try {
        const [current, currentStat] = await Promise.all([
          readFile(currentPath),
          stat(currentPath),
        ]);
        const metadata = await validateImage(current, currentPath);
        if (current.length !== currentStat.size) throw new Error("poster size changed while reading");
        assetDetails.push({ locale, slug: topic.slug, sha256: sha256(current), ...metadata });
      } catch (cause) {
        assetErrors.push(`${locale}/${topic.slug}: ${String(cause)}`);
      }
    }
  }
  if (assetErrors.length === 0 && assetDetails.length === 18) {
    pass("ASSET-001", "All 18 current workspace posters decode; historical copies are verified remotely", assetDetails);
  } else {
    fail("ASSET-001", "Current workspace poster integrity failed", assetErrors);
  }

  const requiredStatic = [
    "public/posters/default-poster.jpg",
    ...RUNTIME_BRAND_ASSETS.map((asset) => `apps/web/public/${asset}`),
  ];
  try {
    await Promise.all(requiredStatic.map((file) => stat(file)));
    pass("ASSET-002", "Fallback poster and all runtime brand assets exist", requiredStatic);
  } catch (cause) {
    fail("ASSET-002", "A required fallback or runtime brand asset is missing", String(cause));
  }
}

async function fetchWithRetry(url, init = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        ...init,
        signal: controller.signal,
        headers: { "user-agent": "xiazishuo-release-gate/1.0", ...(init.headers || {}) },
      });
      clearTimeout(timeout);
      if (response.status >= 500 && attempt < attempts) continue;
      return response;
    } catch (cause) {
      clearTimeout(timeout);
      lastError = cause;
      if (attempt === attempts) throw cause;
    }
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

function assertFirstParty(response, label) {
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || finalUrl.hostname !== "xiazishuo.com") {
    throw new Error(`${label} escaped the production origin to ${response.url}`);
  }
}

function assertCosPosterUrl(value, label) {
  const url = new URL(value);
  const cosHost = /\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(url.hostname);
  if (url.protocol !== "https:"
    || !cosHost
    || !url.pathname.startsWith("/release-assets/")
    || /pluto\.hk/i.test(url.toString())) {
    throw new Error(`${label} returned an unapproved COS location`);
  }
  return url;
}

async function fetchVerifiedRemotePoster(url, label, releaseId) {
  const route = await fetchWithRetry(url, { redirect: "manual" });
  assertFirstParty(route, `${label} route`);
  if (route.status !== 307) {
    if (!route.ok || !/^image\//i.test(route.headers.get("content-type") || "")) {
      throw new Error(`${label} route returned HTTP ${route.status}`);
    }
    const buffer = Buffer.from(await route.arrayBuffer());
    return { buffer, declaredHash: sha256(buffer), source: "github-proxy", routeStatus: route.status };
  }
  const location = route.headers.get("location");
  if (!location) throw new Error(`${label} is missing its COS redirect`);
  const destination = assertCosPosterUrl(location, label);
  const declaredHash = route.headers.get("x-xiazi-content-hash") || "";
  if (!/^[0-9a-f]{64}$/.test(declaredHash)) throw new Error(`${label} is missing a valid content hash`);
  if (releaseId && route.headers.get("x-xiazi-release-id") !== releaseId) {
    throw new Error(`${label} returned the wrong releaseId`);
  }
  const source = await fetchWithRetry(destination, { redirect: "error" });
  if (!source.ok || !/^image\//i.test(source.headers.get("content-type") || "")) {
    throw new Error(`${label} COS object returned HTTP ${source.status}`);
  }
  const buffer = Buffer.from(await source.arrayBuffer());
  if (sha256(buffer) !== declaredHash) throw new Error(`${label} COS hash does not match the route proof`);
  return { buffer, declaredHash, source: "tencent-cos", routeStatus: route.status };
}

async function fetchJson(url, label) {
  const response = await fetchWithRetry(url);
  assertFirstParty(response, label);
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return { response, value: await response.json() };
}

async function mapLimit(values, concurrency, worker) {
  const output = new Array(values.length);
  let next = 0;
  async function consume() {
    while (next < values.length) {
      const index = next++;
      output[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, consume));
  return output;
}

async function runLiveChecks() {
  try {
    const details = await mapLimit(RUNTIME_BRAND_ASSETS, 3, async (asset) => {
      const response = await fetchWithRetry(`${PRODUCTION_ORIGIN}/${asset}`);
      assertFirstParty(response, asset);
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !/^image\//i.test(contentType)) {
        throw new Error(`${asset} returned HTTP ${response.status} (${contentType || "missing content-type"})`);
      }
      const bytes = Buffer.byteLength(await response.arrayBuffer());
      if (bytes < 10_000) throw new Error(`${asset} is suspiciously small (${bytes} bytes)`);
      return { asset, bytes, contentType };
    });
    pass("LIVE-007", "All runtime brand images are available from production", details);
  } catch (cause) {
    fail("LIVE-007", "A required production brand image is missing", String(cause));
  }

  let issue;
  try {
    const { response, value } = await fetchJson(`${PRODUCTION_ORIGIN}/api/content/`, "content API");
    issue = value;
    if (!/no-store|no-cache/i.test(response.headers.get("cache-control") || "")) {
      throw new Error("content API is missing a no-store/no-cache directive");
    }
    pass("LIVE-001", "Production content API is reachable and cache-safe", { issueDate: issue.issueDate });
  } catch (cause) {
    fail("LIVE-001", "Production content API failed", String(cause));
    return;
  }

  const issueErrors = validateIssue(issue, {
    expectedDate: options.expectedDate,
    strictSchedule: options.strictSchedule,
  });
  if (issueErrors.length === 0) pass("LIVE-002", "Production issue satisfies the automated PRD contract");
  else issueErrors.forEach((item) => fail(`LIVE-${item.id}`, item.message, item.path));

  for (const locale of ["zh", "en"]) {
    try {
      const response = await fetchWithRetry(`${PRODUCTION_ORIGIN}/${locale}/`);
      assertFirstParty(response, `${locale} page`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (/variant=(?:thumbnail|thumb)/i.test(html)) {
        throw new Error("current issue page still references a thumbnail poster variant");
      }
      const copy = issue.topics?.[0]?.localizations?.[locale === "zh" ? "zh-CN" : "en-US"];
      if (!html.includes(copy?.headlineFact || "__missing__")) throw new Error("NO.01 headline is missing from server-rendered HTML");
      if (!html.includes(issue.issueDate)) throw new Error("issueDate is missing from server-rendered HTML");
      const publishClock = beijingClock(issue.beijingTimestamp);
      const publishLabel = locale === "zh"
        ? `北京时间 ${publishClock} 发布`
        : `Published at ${publishClock} Beijing Time`;
      if (!publishClock || !html.includes(publishLabel)) {
        throw new Error(`displayed publication time does not match API beijingTimestamp (${publishClock || "invalid"})`);
      }
      pass(locale === "zh" ? "LIVE-003" : "LIVE-004", `${locale} page renders the current issue`, { bytes: Buffer.byteLength(html) });
    } catch (cause) {
      fail(locale === "zh" ? "LIVE-003" : "LIVE-004", `${locale} production page failed`, String(cause));
    }
  }

  try {
    const list = await fetchJson(`${PRODUCTION_ORIGIN}/api/archive/`, "archive list API");
    if (!Array.isArray(list.value.issues) || !list.value.issues.includes(options.expectedDate)) {
      throw new Error(`${options.expectedDate} is missing from the archive list`);
    }
    const detail = await fetchJson(`${PRODUCTION_ORIGIN}/api/archive/?date=${options.expectedDate}`, "archive detail API");
    const currentReleaseId = issue.releaseId || issue.assetVersion;
    if (detail.value.assetVersion !== currentReleaseId) {
      throw new Error(`archive releaseId ${detail.value.assetVersion || "missing"} does not match active ${currentReleaseId || "missing"}`);
    }
    if (stableJson(normalizeIssueForArchiveComparison(detail.value.issue))
      !== stableJson(normalizeIssueForArchiveComparison(issue))) {
      throw new Error("archive issue content does not match current production issue");
    }
    pass("LIVE-005", "Archive list and archive detail match the current issue");
  } catch (cause) {
    fail("LIVE-005", "Production archive API failed", String(cause));
  }

  const posterTargets = ["zh", "en"].flatMap((locale) => (issue.topics || []).map((topic) => ({ locale, topic })));
  try {
    const details = await mapLimit(posterTargets, 4, async ({ locale, topic }) => {
      const releaseId = issue.releaseId || issue.assetVersion || issue.issueDate;
      const suffix = `v=${encodeURIComponent(releaseId)}`;
      const currentUrl = `${PRODUCTION_ORIGIN}/api/posters/${locale}/${topic.slug}/?${suffix}`;
      const archiveUrl = `${PRODUCTION_ORIGIN}/api/posters/${locale}/${topic.slug}/?issueDate=${options.expectedDate}&${suffix}`;
      const [currentRemote, archiveRemote] = await Promise.all([
        fetchVerifiedRemotePoster(currentUrl, `${locale}/${topic.slug} current poster`, releaseId),
        fetchVerifiedRemotePoster(archiveUrl, `${locale}/${topic.slug} archive poster`, releaseId),
      ]);
      const current = currentRemote.buffer;
      const archived = archiveRemote.buffer;
      const metadata = await validateImage(current, `${locale}/${topic.slug}`);
      await validateImage(archived, `archive ${locale}/${topic.slug}`);
      if (!current.equals(archived)) throw new Error(`${locale}/${topic.slug} current/archive bytes differ`);
      return { locale, slug: topic.slug, sha256: sha256(current), source: currentRemote.source, ...metadata };
    });
    if (details.length !== 18) throw new Error(`Expected 18 poster pairs, received ${details.length}`);
    pass("LIVE-006", "All 18 live routes resolve to verified remote archive bytes", details);
  } catch (cause) {
    fail("LIVE-006", "Production poster verification failed", String(cause));
  }

  if (options.checkSources) {
    const sources = Array.from(new Map((issue.topics || []).flatMap((topic) => topic.sources || []).map((source) => [source.url, source])).values());
    const sourceResults = await mapLimit(sources, 3, async (source) => {
      try {
        let response = await fetchWithRetry(source.url, { method: "HEAD" }, 2);
        if (response.status === 405) {
          response = await fetchWithRetry(source.url, { headers: { range: "bytes=0-1023" } }, 2);
        }
        return { publisher: source.publisher, url: source.url, status: response.status };
      } catch (cause) {
        return { publisher: source.publisher, url: source.url, status: 0, error: String(cause) };
      }
    });
    const dead = sourceResults.filter((item) => item.status === 404 || item.status === 410);
    const blocked = sourceResults.filter((item) => item.status === 0 || item.status === 401 || item.status === 403 || item.status === 429 || item.status >= 500);
    if (dead.length > 0) fail("SOURCE-LIVE-001", "One or more recommended-reading links are dead", dead);
    else pass("SOURCE-LIVE-001", "No recommended-reading link returned 404 or 410", sourceResults);
    if (blocked.length > 0) warn("SOURCE-LIVE-002", "Some publishers blocked or rate-limited the automated probe; verify these manually", blocked);
  }
}

async function runRemoteArchiveChecks() {
  const legacyCutoff = "2026-07-18";
  if (options.expectedDate <= legacyCutoff) {
    try {
      const issueUrl = `https://raw.githubusercontent.com/Yonge6/xiazi-global-hot-topics/main/data/archive/${options.expectedDate}.json`;
      const issueResponse = await fetchWithRetry(issueUrl, { redirect: "error" });
      if (!issueResponse.ok) throw new Error(`GitHub issue archive returned HTTP ${issueResponse.status}`);
      const issue = await issueResponse.json();
      const targets = ["zh", "en"].flatMap((locale) => issue.topics.map((topic) => ({ locale, topic })));
      const details = await mapLimit(targets, 4, async ({ locale, topic }) => {
        const posterUrl = `https://raw.githubusercontent.com/Yonge6/xiazi-global-hot-topics/main/public/archive/${options.expectedDate}/posters/${locale}/${topic.slug}.png`;
        const remote = await fetchBufferWithRetry(posterUrl, {
          attempts: 3,
          timeoutMs: 90_000,
          maxBytes: 50 * 1024 * 1024,
          init: { redirect: "error", headers: { "user-agent": "xiazishuo-release-gate/1.0" } },
        });
        if (!/^image\//i.test(remote.headers.get("content-type") || "")) {
          throw new Error(`${locale}/${topic.slug} GitHub archive did not return an image`);
        }
        const buffer = remote.buffer;
        return { locale, slug: topic.slug, sha256: sha256(buffer), ...(await validateImage(buffer, posterUrl)) };
      });
      if (details.length !== 18) throw new Error(`Expected 18 GitHub posters, received ${details.length}`);
      pass("ARCHIVE-GITHUB-001", "Legacy issue has 18 valid posters in the remote GitHub archive", details);
    } catch (cause) {
      fail("ARCHIVE-GITHUB-001", "Remote GitHub poster archive verification failed", String(cause));
    }
    return;
  }

  try {
    const detail = await fetchJson(`${PRODUCTION_ORIGIN}/api/archive/?date=${options.expectedDate}`, "archive detail API");
    const issue = detail.value.issue;
    const releaseId = detail.value.assetVersion;
    if (!issue || !/^rel_\d{8}_[0-9a-f]{24}$/.test(releaseId || "")) {
      throw new Error("Release V2 archive is missing its immutable releaseId");
    }
    const targets = ["zh", "en"].flatMap((locale) => issue.topics.map((topic) => ({ locale, topic })));
    const details = await mapLimit(targets, 4, async ({ locale, topic }) => {
      const posterUrl = `${PRODUCTION_ORIGIN}/api/posters/${locale}/${topic.slug}/?issueDate=${options.expectedDate}&v=${encodeURIComponent(releaseId)}`;
      const remote = await fetchVerifiedRemotePoster(posterUrl, `${locale}/${topic.slug} archive poster`, releaseId);
      return { locale, slug: topic.slug, sha256: remote.declaredHash, source: remote.source, ...(await validateImage(remote.buffer, posterUrl)) };
    });
    if (details.length !== 18) throw new Error(`Expected 18 COS posters, received ${details.length}`);
    pass("ARCHIVE-COS-001", "Release V2 issue has 18 hash-verified posters in COS", { releaseId, posters: details });
  } catch (cause) {
    fail("ARCHIVE-COS-001", "Remote COS poster archive verification failed", String(cause));
  }
}

if (options.local) await runLocalChecks();
if (options.live) await runLiveChecks();
if (options.remoteArchive) await runRemoteArchiveChecks();

const summary = {
  passed: checks.filter((check) => check.status === "pass").length,
  warnings: checks.filter((check) => check.status === "warning").length,
  failed: checks.filter((check) => check.status === "fail").length,
};
const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  expectedDate: options.expectedDate,
  productionOrigin: PRODUCTION_ORIGIN,
  modes: { local: options.local, live: options.live, remoteArchive: options.remoteArchive, checkSources: options.checkSources, strictSchedule: options.strictSchedule },
  summary,
  checks,
};

for (const check of checks) {
  const icon = check.status === "pass" ? "PASS" : check.status === "warning" ? "WARN" : "FAIL";
  console.log(`[${icon}] ${check.id} ${check.message}`);
  if (check.status !== "pass" && check.details) console.log(`       ${typeof check.details === "string" ? check.details : JSON.stringify(check.details)}`);
}
console.log(`\nSummary: ${summary.passed} passed, ${summary.warnings} warnings, ${summary.failed} failed`);

if (options.reportPath) {
  const output = path.resolve(options.reportPath);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${output}`);
}

if (summary.failed > 0) process.exitCode = 1;
