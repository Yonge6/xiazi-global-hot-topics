import assert from "node:assert/strict";
import test from "node:test";

import { buildPosterSparsePatterns, selectRetainedIssues } from "../lib/local-poster-retention.mjs";

const issues = [
  { issueDate: "2026-07-19", topics: [{ slug: "older-topic" }] },
  { issueDate: "2026-07-21", topics: [{ slug: "today-topic" }] },
  { issueDate: "2026-07-20", topics: [{ slug: "recent-topic" }] },
  { issueDate: "2026-07-18", topics: [{ slug: "expired-topic" }] },
];

test("retains only the requested number of latest issues", () => {
  assert.deepEqual(
    selectRetainedIssues(issues, 3).map((issue) => issue.issueDate),
    ["2026-07-21", "2026-07-20", "2026-07-19"],
  );
});

test("keeps recent GitHub archives and excludes the apps/web archive mirror", () => {
  const result = buildPosterSparsePatterns(selectRetainedIssues(issues, 3));
  assert.ok(result.patterns.includes("!/public/archive/*/"));
  assert.ok(result.patterns.includes("/public/archive/2026-07-21/"));
  assert.ok(result.patterns.includes("!/apps/web/public/archive/*/"));
  assert.ok(!result.patterns.includes("/apps/web/public/archive/2026-07-21/"));
  assert.ok(result.patterns.includes("/apps/web/public/posters/zh/today-topic.png"));
  assert.ok(!result.patterns.includes("/apps/web/public/posters/zh/recent-topic.png"));
  assert.ok(!result.patterns.includes("/public/posters/zh/expired-topic.png"));
});

test("rejects an unsafe retention window", () => {
  assert.throws(() => selectRetainedIssues(issues, 0), /LOCAL_POSTER_RETENTION_INVALID/);
  assert.throws(() => selectRetainedIssues(issues, 15), /LOCAL_POSTER_RETENTION_INVALID/);
});
