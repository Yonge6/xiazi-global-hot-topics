#!/usr/bin/env node

import { createHash } from "node:crypto";
import type { LookupAddress } from "node:dns";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { fetchSafeSource } from "../apps/web/src/server/releases/safe-source-fetch";

type Locale = "zh" | "en";

type Story = {
  slug?: unknown;
  category?: unknown;
  region?: unknown;
  countryCodes?: unknown;
  storyId?: unknown;
  storyStatus?: unknown;
  followupDay?: unknown;
  informationIncrementScore?: unknown;
  zh?: Record<string, unknown>;
  en?: Record<string, unknown>;
  sources?: Array<Record<string, unknown>>;
};

type IssueSpec = {
  issueDate?: unknown;
  assetVersion?: unknown;
  style?: Record<string, unknown>;
  stories?: Story[];
};

type Failure = {
  code: string;
  target: string;
  message: string;
};

type PosterCheck = {
  slot: string;
  file: string;
  bytes: number;
  width: number;
  height: number;
  hash: string;
  perceptualHash: string;
};

const categories = new Set([
  "international",
  "technology",
  "business",
  "science",
  "climate",
  "culture",
  "sports",
]);
const sourceTypes = new Set(["official", "wire", "publisher", "research", "media"]);
const storyStatuses = new Set(["new", "followup", "finished"]);
const localizedMinimums = {
  categoryLabel: 1,
  headlineFact: 6,
  headlineView: 6,
  intro: 40,
  xiaziQuote: 4,
  doudouQuote: 4,
} as const;

function usage() {
  return `Usage:
  node node_modules/tsx/dist/cli.mjs scripts/preflight-daily-publication.ts \\
    --issue-spec PATH --poster-root PATH [--report PATH]

Checks all issue-spec fields, all source URLs, and all 18 PNG files before any
remote release is started. Every deterministic failure is printed in one run.`;
}

function parseArgs(argv: string[]) {
  const options: { issueSpec?: string; posterRoot?: string; report?: string } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--issue-spec") options.issueSpec = argv[++index];
    else if (arg === "--poster-root") options.posterRoot = argv[++index];
    else if (arg === "--report") options.report = argv[++index];
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    }
  }
  if (!options.issueSpec || !options.posterRoot) throw new Error(usage());
  return options as { issueSpec: string; posterRoot: string; report?: string };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateSpec(spec: IssueSpec) {
  const failures: Failure[] = [];
  const stories = Array.isArray(spec.stories) ? spec.stories : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(spec.issueDate))) {
    failures.push({ code: "SPEC_DATE", target: "issueDate", message: "Expected YYYY-MM-DD" });
  }
  if (!text(spec.assetVersion)) {
    failures.push({ code: "SPEC_ASSET_VERSION", target: "assetVersion", message: "Required" });
  }
  if (!text(spec.style?.name) || !text(spec.style?.zhName)) {
    failures.push({ code: "SPEC_STYLE", target: "style", message: "name and zhName are required" });
  }
  if (stories.length !== 9) {
    failures.push({ code: "SPEC_STORY_COUNT", target: "stories", message: `Expected 9, received ${stories.length}` });
  }

  const slugs = new Set<string>();
  const storyIds = new Set<string>();
  stories.forEach((story, index) => {
    const target = `NO.${String(index + 1).padStart(2, "0")}`;
    const slug = text(story.slug);
    const storyId = text(story.storyId);
    if (!slug || slugs.has(slug)) failures.push({ code: "SPEC_SLUG", target, message: "slug is missing or duplicated" });
    if (!storyId || storyIds.has(storyId)) failures.push({ code: "SPEC_STORY_ID", target, message: "storyId is missing or duplicated" });
    slugs.add(slug);
    storyIds.add(storyId);
    if (!categories.has(text(story.category))) failures.push({ code: "SPEC_CATEGORY", target, message: `Invalid category: ${text(story.category) || "missing"}` });
    if (!text(story.region)) failures.push({ code: "SPEC_REGION", target, message: "region is required" });
    if (!Array.isArray(story.countryCodes)) failures.push({ code: "SPEC_COUNTRIES", target, message: "countryCodes must be an array" });
    if (!storyStatuses.has(text(story.storyStatus))) failures.push({ code: "SPEC_STORY_STATUS", target, message: "storyStatus must be new, followup, or finished" });
    if (!Number.isInteger(story.followupDay) || Number(story.followupDay) < 1) failures.push({ code: "SPEC_FOLLOWUP_DAY", target, message: "followupDay must be a positive integer" });
    if (!Number.isFinite(story.informationIncrementScore)) failures.push({ code: "SPEC_INCREMENT_SCORE", target, message: "informationIncrementScore must be a number" });

    for (const locale of ["zh", "en"] as const) {
      const localized = story[locale] || {};
      for (const [field, minimum] of Object.entries(localizedMinimums)) {
        const length = text(localized[field]).length;
        if (length < minimum) {
          failures.push({ code: "SPEC_LOCALIZED_TEXT", target: `${target}:${locale}:${field}`, message: `Minimum ${minimum} characters, received ${length}` });
        }
      }
    }

    const sources = Array.isArray(story.sources) ? story.sources : [];
    if (sources.length < 1) failures.push({ code: "SPEC_SOURCES", target, message: "At least one source is required" });
    sources.forEach((source, sourceIndex) => {
      const sourceTarget = `${target}:source-${sourceIndex + 1}`;
      if (!text(source.title) || !text(source.publisher)) failures.push({ code: "SPEC_SOURCE_LABEL", target: sourceTarget, message: "title and publisher are required" });
      if (!sourceTypes.has(text(source.sourceType))) failures.push({ code: "SPEC_SOURCE_TYPE", target: sourceTarget, message: `Invalid sourceType: ${text(source.sourceType) || "missing"}` });
      try {
        const url = new URL(text(source.url));
        if (url.protocol !== "https:") throw new Error("HTTPS required");
      } catch (error) {
        failures.push({ code: "SPEC_SOURCE_URL", target: sourceTarget, message: error instanceof Error ? error.message : "Invalid URL" });
      }
    });
  });
  return failures;
}

function normalizedPageText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type DohAnswer = { type?: number; data?: string };

async function resolveWithDoh(hostname: string): Promise<LookupAddress[]> {
  const answers = await Promise.all((["A", "AAAA"] as const).map(async (type) => {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`PREFLIGHT_DOH_FAILED:${type}:${response.status}`);
    const body = await response.json() as { Status?: number; Answer?: DohAnswer[] };
    if (body.Status !== 0 && body.Status !== 3) throw new Error(`PREFLIGHT_DOH_INVALID:${type}:${body.Status}`);
    return (body.Answer || []).flatMap((answer): LookupAddress[] => {
      if (answer.type === 1 && answer.data) return [{ address: answer.data, family: 4 }];
      if (answer.type === 28 && answer.data) return [{ address: answer.data, family: 6 }];
      return [];
    });
  }));
  const resolved = answers.flat();
  if (!resolved.length) throw new Error(`PREFLIGHT_DOH_EMPTY:${hostname}`);
  return resolved;
}

async function checkSources(stories: Story[]) {
  const jobs = stories.flatMap((story, storyIndex) =>
    (story.sources || []).map((source, sourceIndex) => ({
      target: `NO.${String(storyIndex + 1).padStart(2, "0")}:source-${sourceIndex + 1}`,
      url: text(source.url),
    })));
  const results = await Promise.all(jobs.map(async ({ target, url }) => {
    try {
      let response: Awaited<ReturnType<typeof fetchSafeSource>>;
      try {
        response = await fetchSafeSource(url, {
          timeoutMs: 15_000,
          maxBytes: 500_000,
          resolver: resolveWithDoh,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/(?:fetch failed|SOURCE_FETCH_TIMEOUT|ECONNRESET|ETIMEDOUT|EAI_AGAIN)/i.test(message)) throw error;
        response = await fetchSafeSource(url, {
          timeoutMs: 15_000,
          maxBytes: 500_000,
          resolver: resolveWithDoh,
        });
      }
      if (response.status < 200 || response.status >= 400) throw new Error(`HTTP ${response.status}`);
      if (response.body.length < 200) throw new Error(`Body too small: ${response.body.length} bytes`);
      const pageText = normalizedPageText(response.body);
      if (pageText.length < 120) throw new Error(`Text too small: ${pageText.length} characters`);
      return { ok: true as const, target, url, finalUrl: response.finalUrl, status: response.status };
    } catch (error) {
      return {
        ok: false as const,
        failure: {
          code: "SOURCE_GATE",
          target,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }));
  return {
    checks: results.flatMap((result) => result.ok ? [result] : []),
    failures: results.flatMap((result) => result.ok ? [] : [result.failure]),
  };
}

async function differenceHash(buffer: Buffer) {
  const pixels = await sharp(buffer).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer();
  let bits = BigInt(0);
  let offset = BigInt(0);
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      if (pixels[row * 9 + column] > pixels[row * 9 + column + 1]) bits |= BigInt(1) << offset;
      offset += BigInt(1);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

function hashDistance(left: string, right: string) {
  let difference = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (difference !== BigInt(0)) {
    count += Number(difference & BigInt(1));
    difference >>= BigInt(1);
  }
  return count;
}

async function checkPosters(posterRoot: string) {
  const jobs = (["zh", "en"] as Locale[]).flatMap((locale) =>
    Array.from({ length: 9 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return { locale, number, file: path.join(posterRoot, locale, `NO.${number}.png`) };
    }));
  const results = await Promise.all(jobs.map(async ({ locale, number, file }) => {
    const slot = `${locale}:NO.${number}`;
    try {
      const buffer = await readFile(file);
      if (buffer.length < 10_000 || buffer.length > 10 * 1024 * 1024) {
        throw new Error(`File size ${buffer.length} is outside 10KB-10MB`);
      }
      const metadata = await sharp(buffer).metadata();
      if (metadata.format !== "png" || metadata.width !== 887 || metadata.height !== 1774) {
        throw new Error(`Expected PNG 887x1774, received ${metadata.format || "unknown"} ${metadata.width || 0}x${metadata.height || 0}`);
      }
      return {
        ok: true as const,
        check: {
          slot,
          file,
          bytes: buffer.length,
          width: metadata.width,
          height: metadata.height,
          hash: createHash("sha256").update(buffer).digest("hex"),
          perceptualHash: await differenceHash(buffer),
        } satisfies PosterCheck,
      };
    } catch (error) {
      return {
        ok: false as const,
        failure: {
          code: "POSTER_GATE",
          target: slot,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }));
  const checks = results.flatMap((result) => result.ok ? [result.check] : []);
  const failures: Failure[] = results.flatMap((result) => result.ok ? [] : [result.failure]);
  const exact = new Map<string, string>();
  for (const check of checks) {
    const duplicate = exact.get(check.hash);
    if (duplicate) failures.push({ code: "POSTER_EXACT_DUPLICATE", target: `${duplicate}|${check.slot}`, message: "Two release slots use the same PNG" });
    else exact.set(check.hash, check.slot);
  }
  for (let left = 0; left < checks.length; left += 1) {
    for (let right = left + 1; right < checks.length; right += 1) {
      const leftNumber = checks[left].slot.slice(-2);
      const rightNumber = checks[right].slot.slice(-2);
      if (leftNumber === rightNumber) continue;
      const distance = hashDistance(checks[left].perceptualHash, checks[right].perceptualHash);
      if (distance <= 4) {
        failures.push({
          code: "POSTER_PERCEPTUAL_DUPLICATE",
          target: `${checks[left].slot}|${checks[right].slot}`,
          message: `Perceptual hash distance ${distance}`,
        });
      }
    }
  }
  return { checks, failures };
}

async function runPreflight(issueSpecPath: string, posterRoot: string) {
  const startedAt = new Date().toISOString();
  let spec: IssueSpec;
  try {
    spec = JSON.parse(await readFile(issueSpecPath, "utf8")) as IssueSpec;
  } catch (error) {
    return {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      issueDate: null,
      counts: { stories: 0, sources: 0, posters: 0, failures: 1 },
      failures: [{ code: "SPEC_READ", target: issueSpecPath, message: error instanceof Error ? error.message : String(error) }],
    };
  }
  const specFailures = validateSpec(spec);
  const sourceResult = specFailures.some((failure) => failure.code === "SPEC_SOURCE_URL")
    ? { checks: [], failures: [{ code: "SOURCE_GATE_SKIPPED", target: "sources", message: "Fix invalid source URLs first" }] }
    : await checkSources(spec.stories || []);
  const posterResult = await checkPosters(posterRoot);
  const failures = [...specFailures, ...sourceResult.failures, ...posterResult.failures];
  return {
    ok: failures.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    issueDate: text(spec.issueDate) || null,
    counts: {
      stories: spec.stories?.length || 0,
      sources: sourceResult.checks.length,
      posters: posterResult.checks.length,
      failures: failures.length,
    },
    failures,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await runPreflight(options.issueSpec, options.posterRoot);
  if (options.report) await writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`);
  if (report.ok) {
    console.log(`PREFLIGHT_OK issue=${report.issueDate} stories=${report.counts.stories} sources=${report.counts.sources} posters=${report.counts.posters}`);
    return;
  }
  console.error(`PREFLIGHT_FAILED count=${report.counts.failures}`);
  for (const failure of report.failures) {
    console.error(`${failure.code}\t${failure.target}\t${failure.message}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
