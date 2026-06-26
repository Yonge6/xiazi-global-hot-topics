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

  it("detects missing topics, localization changes, source field changes, and asset version drift", () => {
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
    expect(sourcePaths).toHaveLength(0);

    const sourceChanged = structuredClone(ordered) as Issue;
    sourceChanged.topics[0].sources[1].title = "Changed source title";
    const changedSourcePaths = compareIssueParity(issue.issueDate, ordered, sourceChanged).map((difference) => difference.path);
    expect(changedSourcePaths.some((path) => path.endsWith(".title"))).toBe(true);
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
      trigger_type: "manual",
    }));
  });

  it("syncs a missing latest issue before comparing", async () => {
    const logger = loggerClient();
    let synced: Issue | null = null;
    const supabaseRepository = {
      async getLatestPublishedIssue() {
        if (!synced) throw new Error("missing latest");
        return synced;
      },
      async getIssueByDate() {
        return synced;
      },
      async listPublishedIssues() {
        return synced ? [{ issueDate: synced.issueDate, slug: synced.slug, status: synced.status, source: "supabase" as const }] : [];
      },
    };

    const result = await runContentShadowCompare({
      jsonRepository: new FakeRepository(issue),
      supabaseRepository,
      loggerClient: logger.client as never,
      serviceClient: {} as never,
      requestId: "cron-request",
      triggerType: "cron",
      syncBeforeCompare: true,
      syncIssueBundle: async (_client, sourceIssue, checksum) => {
        synced = sourceIssue;
        return {
          issueDate: sourceIssue.issueDate,
          checksum,
          executionKey: `shadow-sync:${sourceIssue.issueDate}:${checksum}`,
          changed: true,
          contentVersion: 1,
          syncStatus: "inserted",
        };
      },
    });

    expect(result.matched).toBe(true);
    expect(result.syncStatus).toBe("inserted");
    expect(result.triggerType).toBe("cron");
    expect(logger.insert).toHaveBeenCalledWith(expect.objectContaining({
      trigger_type: "cron",
      sync_status: "inserted",
      sync_changed: true,
      compare_status: "matched",
      error_code: null,
    }));
  });

  it("skips writes when Supabase already has the same checksum", async () => {
    const logger = loggerClient();
    const result = await runContentShadowCompare({
      jsonRepository: new FakeRepository(issue),
      supabaseRepository: new FakeRepository(issue),
      loggerClient: logger.client as never,
      serviceClient: {} as never,
      triggerType: "manual",
      syncBeforeCompare: true,
      syncIssueBundle: async (_client, sourceIssue, checksum) => ({
        issueDate: sourceIssue.issueDate,
        checksum,
        executionKey: `shadow-sync:${sourceIssue.issueDate}:${checksum}`,
        changed: false,
        contentVersion: 1,
        syncStatus: "skipped",
      }),
    });

    expect(result.matched).toBe(true);
    expect(result.syncStatus).toBe("skipped");
    expect(result.syncChanged).toBe(false);
  });

  it("marks updates when Supabase has an older content version", async () => {
    const logger = loggerClient();
    const result = await runContentShadowCompare({
      jsonRepository: new FakeRepository(issue),
      supabaseRepository: new FakeRepository(issue),
      loggerClient: logger.client as never,
      serviceClient: {} as never,
      triggerType: "cron",
      syncBeforeCompare: true,
      syncIssueBundle: async (_client, sourceIssue, checksum) => ({
        issueDate: sourceIssue.issueDate,
        checksum,
        executionKey: `shadow-sync:${sourceIssue.issueDate}:${checksum}`,
        changed: true,
        contentVersion: 2,
        syncStatus: "updated",
      }),
    });

    expect(result.syncStatus).toBe("updated");
    expect(result.syncChanged).toBe(true);
    expect(result.matched).toBe(true);
  });

  it("does not read Supabase for compare when sync fails", async () => {
    const logger = loggerClient();
    const supabaseRepository = new FakeRepository(issue);
    const readSpy = vi.spyOn(supabaseRepository, "getIssueByDate");

    const result = await runContentShadowCompare({
      jsonRepository: new FakeRepository(issue),
      supabaseRepository,
      loggerClient: logger.client as never,
      serviceClient: {} as never,
      syncBeforeCompare: true,
      syncIssueBundle: async () => {
        throw new Error("write failed");
      },
    });

    expect(readSpy).not.toHaveBeenCalled();
    expect(result.matched).toBe(false);
    expect(result.errorCode).toBe("SUPABASE_SYNC_FAILED");
    expect(result.syncStatus).toBe("failed");
  });

  it("reports validation and compare failures with distinct codes", async () => {
    const broken = cloneIssue((draft) => {
      draft.topics = draft.topics.slice(0, 8);
    });
    const validation = await runContentShadowCompare({
      jsonRepository: new FakeRepository(broken),
      supabaseRepository: new FakeRepository(issue),
      loggerClient: null,
      serviceClient: null,
      syncBeforeCompare: true,
    });
    expect(validation.errorCode).toBe("ISSUE_VALIDATION_FAILED");

    const different = cloneIssue((draft) => {
      draft.topics[0].localizations["en-US"].headlineView = "changed";
    });
    const mismatch = await runContentShadowCompare({
      jsonRepository: new FakeRepository(issue),
      supabaseRepository: new FakeRepository(different),
      loggerClient: null,
      serviceClient: null,
    });
    expect(mismatch.errorCode).toBe("CONTENT_MISMATCH");
    expect(mismatch.compareStatus).toBe("mismatch");
  });
});
