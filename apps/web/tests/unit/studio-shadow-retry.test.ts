import { beforeEach, describe, expect, it, vi } from "vitest";

import currentIssue from "@/data/current-issue.json";
import { contentChecksum } from "@/server/content-sync/issue-bundle";
import { retryStudioShadowPublish } from "@/server/publishing/retry-shadow-publish";
import { parseIssue } from "@xiazi/contracts";

const mocks = vi.hoisted(() => ({
  serviceClient: {},
  readGitHubPrimaryIssue: vi.fn(),
  publishSupabaseShadow: vi.fn(),
  getStudioPublishRun: vi.fn(),
  incrementStudioPublishRunRetry: vi.fn(),
  updateStudioPublishRun: vi.fn(),
}));

vi.mock("@/server/content-sync/supabase-service-client", () => ({
  createSupabaseServiceClientFromEnv: () => mocks.serviceClient,
}));

vi.mock("@/server/publishing/publish-github-primary", () => ({
  readGitHubPrimaryIssue: mocks.readGitHubPrimaryIssue,
}));

vi.mock("@/server/publishing/publish-supabase-shadow", async () => {
  const actual = await vi.importActual<typeof import("@/server/publishing/publish-supabase-shadow")>(
    "@/server/publishing/publish-supabase-shadow",
  );
  return {
    ...actual,
    publishSupabaseShadow: mocks.publishSupabaseShadow,
  };
});

vi.mock("@/server/publishing/studio-publish-runs", () => ({
  getStudioPublishRun: mocks.getStudioPublishRun,
  incrementStudioPublishRunRetry: mocks.incrementStudioPublishRunRetry,
  updateStudioPublishRun: mocks.updateStudioPublishRun,
}));

const issue = parseIssue(currentIssue);
const checksum = contentChecksum(issue);
const publishRequestId = `studio-publish:${issue.issueDate}:${checksum}`;

describe("Studio shadow retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStudioPublishRun.mockResolvedValue({
      publishRequestId,
      issueDate: issue.issueDate,
      checksum,
      retryCount: 0,
    });
    mocks.incrementStudioPublishRunRetry.mockResolvedValue(null);
    mocks.readGitHubPrimaryIssue.mockResolvedValue(issue);
    mocks.publishSupabaseShadow.mockResolvedValue({
      status: "skipped",
      changed: false,
      contentVersion: 1,
      compareStatus: "matched",
      differenceCount: 0,
      differencePaths: [],
    });
    mocks.updateStudioPublishRun.mockResolvedValue({ retryCount: 1 });
  });

  it("retries only Supabase shadow write and compare from GitHub primary content", async () => {
    const result = await retryStudioShadowPublish(publishRequestId);

    expect(mocks.readGitHubPrimaryIssue).toHaveBeenCalledWith(issue.issueDate);
    expect(mocks.publishSupabaseShadow).toHaveBeenCalledWith(
      expect.objectContaining({ issueDate: issue.issueDate }),
      checksum,
      publishRequestId,
      mocks.serviceClient,
      "retry",
    );
    expect(result.shadow.status).toBe("skipped");
    expect(result.compare.status).toBe("matched");
    expect(result.retryCount).toBe(1);
  });

  it("fails safely when GitHub primary content no longer matches the original checksum", async () => {
    const changed = structuredClone(issue);
    changed.topics[0].localizations["zh-CN"].headlineFact = "一个不同的标题";
    mocks.readGitHubPrimaryIssue.mockResolvedValue(changed);

    await expect(retryStudioShadowPublish(publishRequestId)).rejects.toThrow(/checksum/);
    expect(mocks.publishSupabaseShadow).not.toHaveBeenCalled();
    expect(mocks.updateStudioPublishRun).toHaveBeenCalledWith(expect.anything(), publishRequestId, expect.objectContaining({
      shadowStatus: "failed",
      compareStatus: "failed",
      errorCode: "SHADOW_RETRY_FAILED",
    }));
  });
});
