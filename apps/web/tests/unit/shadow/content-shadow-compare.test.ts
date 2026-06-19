import { describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import type { ContentRepository, IssueSummary } from "@/server/repositories/content-repository";
import { compareIssueParity } from "@/server/shadow/content-parity";
import { runContentShadowCompare } from "@/server/shadow/content-shadow-compare";
import { parseIssue, type Issue } from "@xiazi/contracts";

const issue = parseIssue(currentIssue);

function cloneIssue(overrides: (draft: Issue) => void = () => {}) {
  const draft = structuredClone(issue) as Issue;
  overrides(draft);
  return draft;
}

class FakeRepository implements ContentRepository {
  constructor(private readonly value: Issue | null, private readonly error?: Error) {}

  async getLatestPublishedIssue(): Promise<Issue> {
    if (this.error) throw this.error;
    if (!this.value) throw new Error("missing latest");
    return this.value;
  }

  async getIssueByDate(): Promise<Issue | null> {
    if (this.error) throw this.error;
    return this.value;
  }

  async listPublishedIssues(): Promise<IssueSummary[]> {
    if (this.error) throw this.error;
    return this.value ? [{ issueDate: this.value.issueDate, slug: this.value.slug, status: this.value.status, source: "local" }] : [];
  }
}

function loggerClient() {
  const insert = vi.fn(async () => ({ error: null }));
  return {
    insert,
    client: {
      from: () => ({
        insert,
      }),
    },
  };
}

describe("content shadow compare", () => {
  it("matches identical JSON and Supabase issues", async () => {
    const logger = loggerClient();
    const result = await runContentShadowCompare({
      jsonRepository: new FakeRepository(issue),
      supabaseRepository: new FakeRepository(issue),
      loggerClient: logger.client as never,
    });

    expect(result.matched).toBe(true);
    expect(result.differenceCount).toBe(0);
    expect(logger.insert).toHaveBeenCalledWith(expect.objectContaining({ matched: true }));
  });

  it("detects missing topics, localization changes, source order changes, and asset version drift", () => {
    const changed = cloneIssue((draft) => {
      draft.assetVersion = "different-asset-version";
      draft.topics[0].localizations["zh-CN"].headlineFact = "不同的事实标题";
      draft.topics.pop();
    });

    const paths = compareIssueParity(issue.issueDate, issue, changed).map((difference) => difference.path);
    expect(paths).toContain("assetVersion");
    expect(paths).toContain("topics[0].localizations.zh-CN.headlineFact");
    expect(paths).toContain("topics[8]");

    const ordered = cloneIssue((draft) => {
      const source = structuredClone(draft.topics[0].sources[0]);
      draft.topics[0].sources = [
        source,
        { ...source, id: "00000000-0000-4000-8000-000000000002", title: `${source.title} second` },
      ];
    });
    const reordered = structuredClone(ordered) as Issue;
    reordered.topics[0].sources.reverse();
    const sourcePaths = compareIssueParity(issue.issueDate, ordered, reordered).map((difference) => difference.path);
    expect(sourcePaths.some((path) => path.includes("topics[0].sources[0]."))).toBe(true);
  });

  it("records Supabase read failures without throwing to callers", async () => {
    const logger = loggerClient();
    const result = await runContentShadowCompare({
      jsonRepository: new FakeRepository(issue),
      supabaseRepository: new FakeRepository(null, new Error("Supabase request timed out")),
      loggerClient: logger.client as never,
      requestId: "test-request",
    });

    expect(result.matched).toBe(false);
    expect(result.errorCode).toBe("SUPABASE_READ_FAILED");
    expect(logger.insert).toHaveBeenCalledWith(expect.objectContaining({
      issue_date: issue.issueDate,
      matched: false,
      error_code: "SUPABASE_READ_FAILED",
      request_id: "test-request",
    }));
  });
});
