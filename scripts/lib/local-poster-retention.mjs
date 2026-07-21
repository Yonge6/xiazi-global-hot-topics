export const DEFAULT_LOCAL_ISSUE_RETENTION = 3;

export function selectRetainedIssues(issues, retain = DEFAULT_LOCAL_ISSUE_RETENTION) {
  if (!Number.isSafeInteger(retain) || retain < 1 || retain > 14) {
    throw new Error("LOCAL_POSTER_RETENTION_INVALID");
  }
  const normalized = issues
    .filter((issue) => /^\d{4}-\d{2}-\d{2}$/.test(issue?.issueDate || "") && Array.isArray(issue?.topics))
    .sort((left, right) => right.issueDate.localeCompare(left.issueDate));
  const unique = [];
  const dates = new Set();
  for (const issue of normalized) {
    if (dates.has(issue.issueDate)) continue;
    dates.add(issue.issueDate);
    unique.push(issue);
    if (unique.length === retain) break;
  }
  if (unique.length === 0) throw new Error("LOCAL_POSTER_RETENTION_NO_ISSUES");
  return unique;
}

export function buildPosterSparsePatterns(retainedIssues) {
  const dates = retainedIssues.map((issue) => issue.issueDate).sort();
  const currentIssue = [...retainedIssues].sort((left, right) => right.issueDate.localeCompare(left.issueDate))[0];
  const slugs = [...new Set(currentIssue.topics.map((topic) => topic.slug))]
    .filter((slug) => /^[a-z0-9-]+$/.test(slug))
    .sort();
  if (dates.length === 0 || slugs.length === 0) throw new Error("LOCAL_POSTER_RETENTION_EMPTY");

  const patterns = [
    "/*",
    "!/public/archive/*/",
    "!/apps/web/public/archive/*/",
  ];
  for (const date of dates) patterns.push(`/public/archive/${date}/`);

  const posterRoots = ["/public/posters", "/apps/web/public/posters"];
  for (const root of posterRoots) {
    patterns.push(
      `!${root}/zh/*.png`,
      `!${root}/en/*.png`,
      `!${root}/thumb/zh/*.webp`,
      `!${root}/thumb/en/*.webp`,
      `!${root}/zh/thumb/*.webp`,
      `!${root}/en/thumb/*.webp`,
    );
    for (const slug of slugs) {
      patterns.push(
        `${root}/zh/${slug}.png`,
        `${root}/en/${slug}.png`,
        `${root}/thumb/zh/${slug}.webp`,
        `${root}/thumb/en/${slug}.webp`,
        `${root}/zh/thumb/${slug}.webp`,
        `${root}/en/thumb/${slug}.webp`,
      );
    }
  }
  return { patterns, dates, slugs };
}
