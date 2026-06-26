import type { Issue } from "@xiazi/contracts";

import type { ContentRepository } from "../repositories/content-repository";

export type ContentParityDifference = {
  issueDate: string;
  path: string;
  message: string;
};

export type ContentParityResult = {
  jsonIssues: number;
  supabaseIssues: number;
  differences: ContentParityDifference[];
};

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sourceSortKey(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const source = value as Record<string, unknown>;
  if (typeof source.id === "string") return source.id;
  if (typeof source.url === "string") return source.url;
  return stableJson(source);
}

export function normalizeIssueForParity(value: unknown): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map(normalizeIssueForParity);
    const sourceLike = normalized.every((entry) =>
      entry
      && typeof entry === "object"
      && "url" in entry
      && "sourceType" in entry
      && "publisher" in entry,
    );
    return sourceLike ? normalized.sort((left, right) => sourceSortKey(left).localeCompare(sourceSortKey(right))) : normalized;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === "updatedAt" || key === "revisionId") continue;
      if (key === "assetVersion" && typeof entry === "string" && /^[0-9a-f]{40}$/i.test(entry)) continue;
      result[key] = normalizeIssueForParity(entry);
    }
    return result;
  }
  return value;
}

function pathFor(parent: string, key: string | number) {
  return typeof key === "number" ? `${parent}[${key}]` : parent ? `${parent}.${key}` : key;
}

function valueKind(value: unknown) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

export function diffNormalizedValues(left: unknown, right: unknown, path = ""): string[] {
  if (stableJson(left) === stableJson(right)) return [];
  if (valueKind(left) !== valueKind(right)) return [path || "$"];
  if (Array.isArray(left) && Array.isArray(right)) {
    const paths: string[] = [];
    const max = Math.max(left.length, right.length);
    for (let index = 0; index < max; index += 1) {
      if (index >= left.length || index >= right.length) {
        paths.push(pathFor(path, index));
      } else {
        paths.push(...diffNormalizedValues(left[index], right[index], pathFor(path, index)));
      }
    }
    return paths;
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const keys = new Set([
      ...Object.keys(left as Record<string, unknown>),
      ...Object.keys(right as Record<string, unknown>),
    ]);
    return [...keys].sort().flatMap((key) =>
      diffNormalizedValues(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
        pathFor(path, key),
      ),
    );
  }
  return [path || "$"];
}

export function compareIssueParity(issueDate: string, jsonIssue: Issue, supabaseIssue: Issue) {
  const left = normalizeIssueForParity(jsonIssue);
  const right = normalizeIssueForParity(supabaseIssue);
  return diffNormalizedValues(left, right).map((path) => ({
    issueDate,
    path,
    message: `field difference at ${issueDate}:${path}`,
  }));
}

export async function compareContentRepositories(
  jsonRepository: ContentRepository,
  supabaseRepository: ContentRepository,
  options: { issueDate?: string } = {},
): Promise<ContentParityResult> {
  const differences: ContentParityDifference[] = [];
  if (options.issueDate) {
    const [jsonIssue, supabaseIssue] = await Promise.all([
      jsonRepository.getIssueByDate(options.issueDate),
      supabaseRepository.getIssueByDate(options.issueDate),
    ]);
    if (!jsonIssue) {
      differences.push({ issueDate: options.issueDate, path: "$", message: `missing issue in json: ${options.issueDate}` });
    }
    if (!supabaseIssue) {
      differences.push({ issueDate: options.issueDate, path: "$", message: `missing issue in supabase: ${options.issueDate}` });
    }
    if (jsonIssue && supabaseIssue) {
      differences.push(...compareIssueParity(options.issueDate, jsonIssue, supabaseIssue));
    }
    return {
      jsonIssues: jsonIssue ? 1 : 0,
      supabaseIssues: supabaseIssue ? 1 : 0,
      differences,
    };
  }

  const [jsonSummaries, supabaseSummaries] = await Promise.all([
    jsonRepository.listPublishedIssues(),
    supabaseRepository.listPublishedIssues(),
  ]);
  const supabaseDates = new Set(supabaseSummaries.map((summary) => summary.issueDate));
  const jsonDates = new Set(jsonSummaries.map((summary) => summary.issueDate));

  for (const date of jsonDates) {
    if (!supabaseDates.has(date)) differences.push({ issueDate: date, path: "$", message: `missing issue in supabase: ${date}` });
  }
  for (const date of supabaseDates) {
    if (!jsonDates.has(date)) differences.push({ issueDate: date, path: "$", message: `extra issue in supabase: ${date}` });
  }

  for (const date of [...jsonDates].filter((value) => supabaseDates.has(value)).sort()) {
    const [jsonIssue, supabaseIssue] = await Promise.all([
      jsonRepository.getIssueByDate(date),
      supabaseRepository.getIssueByDate(date),
    ]);
    if (!jsonIssue || !supabaseIssue) {
      differences.push({ issueDate: date, path: "$", message: `missing issue detail: ${date}` });
      continue;
    }
    differences.push(...compareIssueParity(date, jsonIssue, supabaseIssue));
  }

  return {
    jsonIssues: jsonSummaries.length,
    supabaseIssues: supabaseSummaries.length,
    differences,
  };
}
