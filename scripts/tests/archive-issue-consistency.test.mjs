import assert from "node:assert/strict";
import test from "node:test";

import { normalizeIssueForArchiveComparison } from "../lib/daily-release-validator.mjs";

const archiveIssue = {
  id: "issue-2026-07-21",
  issueDate: "2026-07-21",
  assetVersion: "rel_20260721_example",
  topics: [{ id: "topic-1", slug: "overview" }],
};

test("runtime release metadata does not make archive content unequal", () => {
  const activeIssue = {
    ...archiveIssue,
    releaseId: archiveIssue.assetVersion,
    contentHash: "a".repeat(64),
    dataSource: "supabase",
    deployedAt: "2026-07-21T14:08:29.704Z",
    publicationHealth: "healthy",
    releaseSchemaVersion: "release-v2.1",
    reviewStatus: "waived",
    reviewPassed: false,
    reviewWaived: true,
    stale: false,
    waiverId: "owner-risk-acceptance-2026-07",
  };

  assert.deepEqual(
    normalizeIssueForArchiveComparison(activeIssue),
    normalizeIssueForArchiveComparison(archiveIssue),
  );
});

test("archive comparison still detects changed issue content", () => {
  const changedArchive = {
    ...archiveIssue,
    topics: [{ id: "topic-1", slug: "different-story" }],
  };

  assert.notDeepEqual(
    normalizeIssueForArchiveComparison(changedArchive),
    normalizeIssueForArchiveComparison(archiveIssue),
  );
});
